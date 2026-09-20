(function registerKeywordToolCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KeywordToolCore = api;
})(typeof window !== "undefined" ? window : globalThis, function createKeywordToolCore() {
  "use strict";

  const ASIN_PATTERN = /^B0[A-Z0-9]{8}$/;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const ALLOWED_EXTENSIONS = new Set(["xlsx", "csv"]);

  function normalizeAsin(value) {
    return String(value || "").trim().toUpperCase();
  }

  function validateAsin(value) {
    const normalized = normalizeAsin(value);
    if (!normalized) return { ok: false, value: normalized, message: "请输入 ASIN。" };
    if (!ASIN_PATTERN.test(normalized)) {
      return { ok: false, value: normalized, message: "ASIN 应为 10 位，并以 B0 开头。" };
    }
    return { ok: true, value: normalized, message: "" };
  }

  function validateCompetitorAsins(value, targetAsin, options = {}) {
    const tokens = (Array.isArray(value) ? value : String(value || "").split(/[\s,，;；]+/))
      .map(normalizeAsin)
      .filter(Boolean);
    const values = [];
    const seen = new Set();
    const normalizedTarget = normalizeAsin(targetAsin);
    for (const asin of tokens) {
      if (!ASIN_PATTERN.test(asin)) {
        return { ok: false, values, count: values.length, message: `竞品 ASIN ${asin} 格式不正确。` };
      }
      if (asin === normalizedTarget) {
        return { ok: false, values, count: values.length, message: "指定竞品不能与自己的 ASIN 相同。" };
      }
      if (seen.has(asin)) continue;
      seen.add(asin);
      values.push(asin);
      if (values.length > 5) {
        return { ok: false, values, count: values.length, message: "指定竞品最多 5 个。" };
      }
    }
    const minimum = Number.isInteger(options.minimum) ? Math.max(0, Math.min(5, options.minimum)) : 0;
    if (values.length < minimum) {
      return { ok: false, values, count: values.length, message: `请填写 ${minimum}–5 家竞对 ASIN。` };
    }
    return { ok: true, values, count: values.length, message: "" };
  }

  function validateCoreKeyword(value) {
    const normalized = String(value || "").trim().replace(/\s+/g, " ");
    if (normalized.length > 120) {
      return { ok: false, value: normalized, message: "核心关键词不能超过 120 个字符。" };
    }
    if (/[\u0000-\u001f\u007f]/.test(normalized)) {
      return { ok: false, value: normalized, message: "核心关键词包含不支持的控制字符。" };
    }
    return { ok: true, value: normalized, message: "" };
  }

  function fileExtension(filename) {
    const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function validateReportFile(file, maxBytes) {
    if (!file) return { ok: false, message: "请选择广告报表。" };
    const extension = fileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return { ok: false, message: "仅支持 .xlsx 或 .csv 报表。" };
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return { ok: false, message: "报表为空，请重新选择文件。" };
    }
    if (Number.isFinite(maxBytes) && file.size > maxBytes) {
      return { ok: false, message: `报表不能超过 ${formatBytes(maxBytes)}。` };
    }
    return { ok: true, extension, message: "" };
  }

  function validateReportPeriod(startDate, endDate) {
    const startValue = String(startDate || "").trim();
    const endValue = String(endDate || "").trim();
    if (!startValue || !endValue) {
      return { ok: false, startDate: startValue, endDate: endValue, message: "请选择报告开始日期和报告结束日期。" };
    }
    const isRealIsoDate = (value) => {
      if (!ISO_DATE_PATTERN.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    if (!isRealIsoDate(startValue) || !isRealIsoDate(endValue)) {
      return { ok: false, startDate: startValue, endDate: endValue, message: "报告日期格式不正确，请重新选择。" };
    }
    if (startValue > endValue) {
      return { ok: false, startDate: startValue, endDate: endValue, message: "报告开始日期不能晚于报告结束日期。" };
    }
    return { ok: true, startDate: startValue, endDate: endValue, message: "" };
  }

  function validatePasswordPair(password, confirmation) {
    const value = String(password || "");
    if (value.length < 8) return { ok: false, message: "密码至少需要 8 位。" };
    if (value !== String(confirmation || "")) return { ok: false, message: "两次输入的密码不一致。" };
    return { ok: true, message: "" };
  }

  function validateAccessRequestEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, value: email, message: "请输入有效的申请邮箱。" };
    }
    return { ok: true, value: email, message: "" };
  }

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return "—";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date).replaceAll("/", "-");
  }

  function statusClass(status) {
    return ({
      "待处理": "status--pending",
      "进行中": "status--working",
      "已完成": "status--completed",
      "失败": "status--failed"
    })[status] || "status--pending";
  }

  function strategyClass(recommendation) {
    const text = String(recommendation || "");
    if (["否定精准", "暂停", "停止投放", "止损"].some((term) => text.includes(term))) return "recommendation--stop";
    if (["降低竞价", "谨慎投放"].some((term) => text.includes(term))) return "recommendation--cautious";
    if (["守住放大", "加投", "防守"].some((term) => text.includes(term))) return "recommendation--action";
    if (["长尾", "检查主图", "检查价格", "检查评价", "页面转化", "优化"].some((term) => text.includes(term))) return "recommendation--optimize";
    if (["保持", "维持"].some((term) => text.includes(term))) return "recommendation--maintain";
    return "";
  }

  function friendlyAuthError(error, mode) {
    const message = String(error && error.message ? error.message : error || "").toLowerCase();
    if (message.includes("invalid login credentials")) return "邮箱或密码不正确，请重新输入。";
    if (message.includes("email not confirmed")) return "邮箱还没有完成验证，请先查看验证邮件。";
    if (message.includes("user already registered") || message.includes("already been registered")) return "这个邮箱已经注册，请直接登录。";
    if (message.includes("password") && message.includes("characters")) return "密码至少需要 8 位。";
    if (message.includes("rate limit") || message.includes("too many")) return "操作太频繁，请稍后再试。";
    if (message.includes("failed to fetch") || message.includes("network")) return "网络连接失败，请检查网络后重试。";
    if (mode === "signup") return "注册没有成功，请稍后重试。";
    if (mode === "reset") return "重置邮件暂时无法发送，请稍后重试。";
    if (mode === "recovery") return "新密码暂时无法保存，请重新打开邮件里的链接再试。";
    return "登录没有成功，请稍后重试。";
  }

  function friendlyDataError(error, fallback) {
    const message = String(error && error.message ? error.message : error || "").toLowerCase();
    if (message.includes("jwt") || message.includes("session") || message.includes("unauthorized")) {
      return "登录状态已失效，请重新登录。";
    }
    if (message.includes("failed to fetch") || message.includes("network")) {
      return "网络连接失败，请稍后重试。";
    }
    if (message.includes("row-level security") || message.includes("permission")) {
      return "当前账号没有执行此操作的权限。";
    }
    return fallback || "操作没有成功，请稍后重试。";
  }

  function isUuid(value) {
    return UUID_PATTERN.test(String(value || ""));
  }

  function isAllowedReportUrl(value, allowedHosts) {
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase();
      const hosts = Array.isArray(allowedHosts) ? allowedHosts : [allowedHosts];
      return url.protocol === "https:" && hosts.some((entry) => {
        const host = String(entry || "").trim().toLowerCase();
        if (!host) return false;
        if (host.startsWith(".")) return hostname.endsWith(host) && hostname !== host.slice(1);
        return hostname === host;
      });
    } catch {
      return false;
    }
  }

  function truncateIdentifier(value) {
    const text = String(value || "");
    if (text.length <= 16) return text;
    return `${text.slice(0, 8)}…${text.slice(-6)}`;
  }

  return Object.freeze({
    normalizeAsin,
    validateAsin,
    validateCompetitorAsins,
    validateCoreKeyword,
    fileExtension,
    validateReportFile,
    validateReportPeriod,
    validatePasswordPair,
    validateAccessRequestEmail,
    formatBytes,
    formatDateTime,
    statusClass,
    strategyClass,
    friendlyAuthError,
    friendlyDataError,
    isUuid,
    isAllowedReportUrl,
    truncateIdentifier
  });
});
