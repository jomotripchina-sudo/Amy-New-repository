(async function initializeReportPage() {
  "use strict";

  const state = document.querySelector("#report-state");
  const stateTitle = document.querySelector("#report-state-title");
  const stateText = document.querySelector("#report-state-text");
  const stateSpinner = document.querySelector("#report-spinner");
  const reportFrame = document.querySelector("#report-frame");
  const taskAsin = document.querySelector("#task-asin");
  const taskStatus = document.querySelector("#task-status");
  const taskCreated = document.querySelector("#task-created");
  const taskIdLabel = document.querySelector("#task-id");
  const userEmail = document.querySelector("#user-email");
  const workspaceName = document.querySelector("#workspace-name");
  const returnTool = document.querySelector("#return-tool");
  const retryButton = document.querySelector("#retry-report");

  function showState(title, text, options = {}) {
    state.hidden = false;
    reportFrame.hidden = true;
    stateTitle.textContent = title;
    stateText.textContent = text;
    stateSpinner.hidden = !options.loading;
    retryButton.hidden = !options.retry;
  }

  let session;
  try {
    session = await KeywordToolApp.requireSession("../");
    if (!session) return;
  } catch (error) {
    showState("页面配置未完成", error.message);
    return;
  }

  const query = new URLSearchParams(window.location.search);
  const workspaceId = query.get("workspace");
  if (!KeywordToolCore.isUuid(workspaceId)) {
    showState("业务空间地址无效", "请先从登录页选择对应业务空间。" );
    return;
  }
  let workspace;
  try {
    const { workspaces } = await KeywordToolApi.listWorkspaces(session);
    workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      showState("业务空间不可用", "该业务空间不存在或不属于当前登录账号。" );
      return;
    }
  } catch (error) {
    showState("业务空间核验失败", KeywordToolCore.friendlyDataError(error, "请返回登录页后重试。"));
    return;
  }
  workspaceName.textContent = `空间 · ${workspace.name}`;
  returnTool.href = `../tool/?workspace=${encodeURIComponent(workspaceId)}`;
  const taskId = query.get("task");
  if (!KeywordToolCore.isUuid(taskId)) {
    showState("报告地址无效", "任务号缺失或格式不正确，请返回工具页重新打开报告。" );
    return;
  }
  userEmail.textContent = session.user.email || "已登录";
  taskIdLabel.textContent = KeywordToolCore.truncateIdentifier(taskId);
  taskIdLabel.title = taskId;
  KeywordToolApp.bindSignOut("../");
  retryButton.addEventListener("click", loadReport);

  function colorizeRecommendations(html) {
    const documentFromReport = new DOMParser().parseFromString(html, "text/html");
    const style = documentFromReport.createElement("style");
    style.textContent = [
      ".recommendation{border-left:3px solid transparent}",
      ".recommendation--action{color:#155bbb;background:#e7f1ff;border-left-color:#2675e8}",
      ".recommendation--maintain{color:#08734f;background:#e7f8f0;border-left-color:#16a36f}",
      ".recommendation--cautious{color:#a53030;background:#ffeded;border-left-color:#e13333}",
      ".recommendation--optimize{color:#925008;background:#fff2df;border-left-color:#e08a00}",
      ".recommendation--stop{color:#596577;background:#eef1f5;border-left-color:#7b8794}"
    ].join("");
    documentFromReport.head.append(style);
    documentFromReport.querySelectorAll(".recommendation").forEach((cell) => {
      const className = KeywordToolCore.strategyClass(cell.textContent);
      if (className) cell.classList.add(className);
    });
    return `<!doctype html>${documentFromReport.documentElement.outerHTML}`;
  }

  async function loadReport() {
    showState("正在加载作战报告", "正在核对任务权限并获取最新报告，请稍候。", { loading: true });
    retryButton.disabled = true;
    try {
      const { task } = await KeywordToolApi.getTask(session, workspaceId, taskId);
      if (!task) {
        showState("没有找到这份报告", "任务不存在，或者它不属于当前登录账号。" );
        return;
      }

      taskAsin.textContent = task.asin;
      taskCreated.textContent = KeywordToolCore.formatDateTime(task.created_at);
      taskStatus.textContent = task.status;
      taskStatus.className = `status-badge ${KeywordToolCore.statusClass(task.status)}`;

      if (task.status === "失败") {
        showState("任务处理失败", task.failure_reason || "后台没有返回具体失败原因，请稍后重试或联系管理员。" );
        return;
      }
      if (task.status !== "已完成" || !task.report_url) {
        showState("报告还在生成", `当前状态：${task.status}。后台通常需要 10–30 分钟，你可以稍后再打开。`, { retry: true });
        return;
      }
      if (!KeywordToolCore.isAllowedReportUrl(task.report_url, KeywordToolApp.getConfig().reportHostSuffix)) {
        showState("报告链接未通过安全校验", "后台返回了非预期的报告地址，页面已阻止加载。请联系管理员检查。" );
        return;
      }

      const response = await fetch(task.report_url, { method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
      if (!response.ok) throw new Error(`报告获取失败：HTTP ${response.status}`);
      const html = await response.text();
      if (!html.trim()) throw new Error("报告内容为空");
      reportFrame.addEventListener("load", () => {
        state.hidden = true;
        reportFrame.hidden = false;
      }, { once: true });
      reportFrame.srcdoc = colorizeRecommendations(html);
    } catch (error) {
      showState("报告加载失败", KeywordToolCore.friendlyDataError(error, "报告暂时无法在线加载，请检查网络后重试。"), { retry: true });
    } finally {
      retryButton.disabled = false;
    }
  }

  await loadReport();
})();
