(function registerVocCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VocCore = api;
})(typeof window !== "undefined" ? window : globalThis, function createVocCore() {
  "use strict";

  const COUNTS = Object.freeze([100, 200, 300, 500]);
  const SCOPES = Object.freeze(["含变体评论", "仅本ASIN"]);
  const SITES = Object.freeze(["US", "CA", "GB", "DE"]);
  const STATUSES = Object.freeze(["排队中", "抓评论", "标注中", "生成报告", "完成", "失败"]);

  function normalizeAsin(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function parseAsins(value) {
    const values = String(value || "")
      .split(/[+,，;；\s]+/)
      .map(normalizeAsin)
      .filter(Boolean);
    return [...new Set(values)];
  }

  function validateAsins(value) {
    const rawValues = String(value || "").split(/[+,，;；\s]+/).map(normalizeAsin).filter(Boolean);
    const values = parseAsins(value);
    if (!values.length) return { ok: false, values, message: "请至少输入 1 个 ASIN。" };
    if (rawValues.length !== values.length) return { ok: false, values, message: "ASIN 不能重复。" };
    if (values.length > 10) return { ok: false, values, message: "一次最多提交 10 个 ASIN。" };
    const invalid = values.find((asin) => !/^[A-Z0-9]{10}$/.test(asin));
    if (invalid) return { ok: false, values, message: `${invalid} 不是有效的 10 位 ASIN。` };
    return { ok: true, values, message: "" };
  }

  function validateDraft({ asins, site, targetReviewCount, reviewScope }) {
    const asinResult = validateAsins(asins);
    if (!asinResult.ok) return asinResult;
    const normalizedSite = String(site || "").trim().toUpperCase();
    if (!SITES.includes(normalizedSite)) return { ok: false, message: "请选择有效站点。" };
    const count = Number(targetReviewCount);
    if (!COUNTS.includes(count)) return { ok: false, message: "请选择评论条数档位。" };
    if (!SCOPES.includes(reviewScope)) return { ok: false, message: "请选择评论范围。" };
    return { ok: true, values: asinResult.values, site: normalizedSite, targetReviewCount: count, reviewScope, message: "" };
  }

  function statusClass(status) {
    return ({
      "排队中": "voc-status--queued",
      "抓评论": "voc-status--collecting",
      "标注中": "voc-status--annotating",
      "生成报告": "voc-status--reporting",
      "完成": "voc-status--completed",
      "失败": "voc-status--failed"
    })[status] || "voc-status--unknown";
  }

  function progressLabel(task) {
    const done = Number(task?.annotated_count || 0);
    const total = Number(task?.annotation_total || 0);
    if (total > 0) return `${done} / ${total}`;
    if (task?.status === "完成") return "本段空跑完成";
    return "—";
  }

  function median(values) {
    const valid = values.filter((value) => Number.isFinite(value) && value >= 0).sort((left, right) => left - right);
    if (!valid.length) return null;
    const middle = Math.floor(valid.length / 2);
    return valid.length % 2 ? valid[middle] : Math.round((valid[middle - 1] + valid[middle]) / 2);
  }

  function durationMs(start, end) {
    const result = new Date(end).valueOf() - new Date(start).valueOf();
    return Number.isFinite(result) && result >= 0 ? result : null;
  }

  function historicalStageDurations(tasks, stage) {
    const fields = {
      collecting: ["started_at", "annotation_started_at"],
      annotating: ["annotation_started_at", "report_started_at"],
      reporting: ["report_started_at", "completed_at"]
    }[stage];
    if (!fields) return [];
    return (Array.isArray(tasks) ? tasks : [])
      .filter((task) => task?.status === "完成")
      .map((task) => durationMs(task[fields[0]], task[fields[1]]))
      .filter((value) => value !== null);
  }

  function formatEtaDuration(value) {
    const minutes = Math.max(1, Math.ceil(Number(value) / 60_000));
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
  }

  function estimateEta(task, tasks, now = Date.now()) {
    if (task?.status === "完成") return { available: true, label: "已完成", ms: 0, source: "completed" };
    if (task?.status === "失败") return { available: false, label: "—", ms: null, source: "failed" };
    const allTasks = Array.isArray(tasks) ? tasks : [];
    const stageByStatus = { "抓评论": "collecting", "标注中": "annotating", "生成报告": "reporting" };
    if (task?.status === "排队中") {
      const stages = ["collecting", "annotating", "reporting"].map((stage) => median(historicalStageDurations(allTasks, stage)));
      if (stages.some((value) => value === null)) return { available: false, label: "正在积累测算数据", ms: null, source: "history" };
      const ahead = allTasks.filter((item) => item?.id !== task.id && !["完成", "失败"].includes(item?.status) && new Date(item.created_at).valueOf() < new Date(task.created_at).valueOf()).length;
      const ms = stages.reduce((total, value) => total + value, 0) * (ahead + 1);
      return { available: true, label: `前方 ${ahead} 个任务 · 约 ${formatEtaDuration(ms)}`, ms, source: "queue" };
    }
    const stage = stageByStatus[task?.status];
    if (!stage) return { available: false, label: "正在积累测算数据", ms: null, source: "unknown" };
    const startedAt = task[`${stage === "collecting" ? "started" : stage === "annotating" ? "annotation_started" : "report_started"}_at`];
    const elapsed = Number(now) - new Date(startedAt).valueOf();
    if (stage === "annotating") {
      const total = Number(task.annotation_total || 0);
      const done = Number(task.annotated_count || 0);
      if (total > 0 && done > 0 && Number.isFinite(elapsed) && elapsed > 0) {
        const ms = Math.max(0, Math.round((total - done) * (elapsed / done)));
        return { available: true, label: `约 ${formatEtaDuration(ms)}`, ms, source: "current-progress" };
      }
    }
    const typical = median(historicalStageDurations(allTasks, stage));
    if (typical === null || !Number.isFinite(elapsed) || elapsed < 0) return { available: false, label: "正在积累测算数据", ms: null, source: "history" };
    const ms = Math.max(0, typical - elapsed);
    return { available: true, label: `约 ${formatEtaDuration(ms)}`, ms, source: "history" };
  }

  return Object.freeze({ COUNTS, SCOPES, SITES, STATUSES, normalizeAsin, parseAsins, validateAsins, validateDraft, statusClass, progressLabel, estimateEta });
});
