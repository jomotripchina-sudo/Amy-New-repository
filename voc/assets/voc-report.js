(async function initializeVocReport() {
  "use strict";

  const TASK_TABLE = "voc_tasks";
  const state = document.querySelector("#voc-report-state");
  const spinner = document.querySelector("#voc-report-spinner");
  const title = document.querySelector("#voc-report-title");
  const text = document.querySelector("#voc-report-text");
  const retry = document.querySelector("#voc-report-retry");
  const meta = document.querySelector("#voc-report-meta");
  const frame = document.querySelector("#voc-report-frame");
  const workspaceName = document.querySelector("#workspace-name");
  const userEmail = document.querySelector("#user-email");
  const returnLink = document.querySelector("#return-voc");
  const brandLink = document.querySelector("#voc-report-brand");

  function showState(heading, message, options = {}) {
    state.hidden = false;
    frame.hidden = true;
    title.textContent = heading;
    text.textContent = message;
    spinner.hidden = !options.loading;
    retry.hidden = !options.retry;
    meta.hidden = true;
  }

  function addMeta(label, value) {
    const item = document.createElement("div");
    const name = document.createElement("span");
    const content = document.createElement("strong");
    name.textContent = label;
    content.textContent = value;
    item.append(name, content);
    meta.append(item);
  }

  let session;
  try {
    session = await KeywordToolApp.requireSession("../../");
    if (!session) return;
  } catch (error) {
    showState("页面配置未完成", error.message);
    return;
  }

  const query = new URLSearchParams(window.location.search);
  const workspaceId = query.get("workspace");
  const taskId = query.get("task");
  if (!KeywordToolCore.isUuid(workspaceId) || !KeywordToolCore.isUuid(taskId)) {
    showState("报告地址无效", "请从用户洞察任务列表重新打开报告。");
    return;
  }

  try {
    const result = await KeywordToolApi.listWorkspaces(session);
    const workspace = result.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) throw new Error("该业务空间不存在或不属于当前账号。");
    workspaceName.textContent = `空间 · ${workspace.name}`;
  } catch (error) {
    showState("业务空间核验失败", KeywordToolCore.friendlyDataError(error, "请返回登录页后重试。"));
    return;
  }

  const taskUrl = `../?workspace=${encodeURIComponent(workspaceId)}`;
  returnLink.href = taskUrl;
  brandLink.href = taskUrl;
  userEmail.textContent = session.user.email || "已登录";
  KeywordToolApp.bindSignOut("../../");
  retry.addEventListener("click", loadReport);

  async function loadReport() {
    showState("正在加载用户洞察报告", "正在核对任务和业务空间，请稍候。", { loading: true });
    retry.disabled = true;
    try {
      const { data, error } = await KeywordToolApp.getClient()
        .from(TASK_TABLE)
        .select("id,workspace_id,asins,site,target_review_count,review_scope,status,failure_reason,report_path,created_at,completed_at")
        .eq("id", taskId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        showState("没有找到这份报告", "任务不存在，或者它不属于当前登录账号。");
        return;
      }
      if (data.status === "失败") {
        showState("任务处理失败", data.failure_reason || "后台没有返回具体失败原因。");
        return;
      }
      if (data.status !== "完成") {
        showState("报告还在生成", `当前状态：${data.status}。请稍后再打开。`, { retry: true });
        return;
      }
      if (!data.report_path) {
        showState("模块 0 空跑完成", "任务链路已经从排队走到完成；真实评论洞察报告将在模块 3 接入。" );
        spinner.hidden = true;
        const badge = document.createElement("span");
        badge.className = "voc-placeholder-badge";
        badge.textContent = "报告占位 · 数据尚未抓取";
        title.before(badge);
        meta.replaceChildren();
        addMeta("ASIN", (data.asins || []).join(" + "));
        addMeta("站点", data.site);
        addMeta("目标评论", `每个 ASIN ${data.target_review_count} 条`);
        addMeta("评论范围", data.review_scope);
        meta.hidden = false;
        return;
      }
      if (!KeywordToolCore.isAllowedReportUrl(data.report_path, KeywordToolApp.getConfig().reportAllowedHosts)) {
        showState("报告路径未通过安全校验", "后台返回了非预期地址，页面已阻止加载。" );
        return;
      }
      const response = await fetch(data.report_path, { cache: "no-store", credentials: "omit", redirect: "error" });
      if (!response.ok) throw new Error(`报告获取失败：HTTP ${response.status}`);
      const html = await response.text();
      if (!html.trim()) throw new Error("报告内容为空");
      frame.addEventListener("load", () => {
        state.hidden = true;
        frame.hidden = false;
      }, { once: true });
      frame.srcdoc = html;
    } catch (error) {
      showState("报告加载失败", KeywordToolCore.friendlyDataError(error, "报告暂时无法加载，请稍后重试。"), { retry: true });
    } finally {
      retry.disabled = false;
    }
  }

  await loadReport();
})();
