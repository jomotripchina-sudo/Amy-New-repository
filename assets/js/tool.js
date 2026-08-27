(async function initializeToolPage() {
  "use strict";

  const form = document.querySelector("#task-form");
  const asinInput = document.querySelector("#asin");
  const fileInput = document.querySelector("#report-file");
  const fileName = document.querySelector("#file-name");
  const reportStartInput = document.querySelector("#report-start-date");
  const reportEndInput = document.querySelector("#report-end-date");
  const submitButton = document.querySelector("#submit-task");
  const feedback = document.querySelector("#submit-feedback");
  const refreshButton = document.querySelector("#refresh-tasks");
  const taskBody = document.querySelector("#task-body");
  const taskTable = document.querySelector("#task-table");
  const loadingState = document.querySelector("#task-loading");
  const emptyState = document.querySelector("#task-empty");
  const taskCount = document.querySelector("#task-count");
  const userEmail = document.querySelector("#user-email");
  const workspaceName = document.querySelector("#workspace-name");
  const workspaceDescription = document.querySelector("#workspace-description");

  let session;
  let refreshTimer;
  let refreshing = false;

  try {
    session = await KeywordToolApp.requireSession("../");
    if (!session) return;
  } catch (error) {
    KeywordToolApp.setMessage(feedback, "error", error.message);
    form.querySelectorAll("input, button").forEach((control) => { control.disabled = true; });
    return;
  }

  const config = KeywordToolApp.getConfig();
  const workspaceId = new URLSearchParams(window.location.search).get("workspace");
  if (!KeywordToolCore.isUuid(workspaceId)) {
    window.location.replace("../");
    return;
  }
  let workspace;
  try {
    const { workspaces } = await KeywordToolApi.listWorkspaces(session);
    workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      window.location.replace("../");
      return;
    }
  } catch (error) {
    KeywordToolApp.setMessage(feedback, "error", KeywordToolCore.friendlyDataError(error, "业务空间暂时无法核验，请返回登录页重试。"));
    form.querySelectorAll("input, button").forEach((control) => { control.disabled = true; });
    return;
  }
  workspaceName.textContent = `空间 · ${workspace.name}`;
  let sourceSummary = "手动上传（可用） · 店铺 API（未连接）";
  try {
    const { sources } = await KeywordToolApi.listSources(session, workspaceId);
    sourceSummary = sources.map((source) => {
      const state = source.connection_status === "ready" ? "可用" : source.connection_status === "connected" ? "已连接" : "未连接";
      return `${source.label}（${state}）`;
    }).join(" · ") || sourceSummary;
  } catch {
    // Source status is explanatory only; task creation still receives its own server-side validation.
  }
  workspaceDescription.textContent = `当前空间：${workspace.name}。数据入口：${sourceSummary}。此处仅显示该空间的任务、报表与数据来源。`;
  userEmail.textContent = session.user.email || "已登录";
  KeywordToolApp.bindSignOut("../");

  asinInput.addEventListener("input", () => {
    asinInput.value = KeywordToolCore.normalizeAsin(asinInput.value).slice(0, 10);
    asinInput.setCustomValidity("");
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    fileName.textContent = file ? `${file.name} · ${KeywordToolCore.formatBytes(file.size)}` : "点击选择 .xlsx 或 .csv 文件";
    KeywordToolApp.setMessage(feedback, "info", "");
  });

  [reportStartInput, reportEndInput].forEach((input) => {
    input.addEventListener("input", () => {
      reportStartInput.setCustomValidity("");
      reportEndInput.setCustomValidity("");
      KeywordToolApp.setMessage(feedback, "info", "");
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const asinResult = KeywordToolCore.validateAsin(asinInput.value);
    const file = fileInput.files && fileInput.files[0];
    const fileResult = KeywordToolCore.validateReportFile(file, config.maxUploadBytes);
    const dateResult = KeywordToolCore.validateReportPeriod(reportStartInput.value, reportEndInput.value);
    if (!asinResult.ok) {
      asinInput.setCustomValidity(asinResult.message);
      asinInput.reportValidity();
      KeywordToolApp.setMessage(feedback, "error", asinResult.message);
      return;
    }
    if (!fileResult.ok) {
      KeywordToolApp.setMessage(feedback, "error", fileResult.message);
      return;
    }
    if (!dateResult.ok) {
      const dateControl = reportStartInput.value ? reportEndInput : reportStartInput;
      dateControl.setCustomValidity(dateResult.message);
      dateControl.reportValidity();
      KeywordToolApp.setMessage(feedback, "error", dateResult.message);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "正在安全提交…";
    KeywordToolApp.setMessage(feedback, "info", "正在通过已登录账号安全提交广告报表，请不要关闭页面。" );
    try {
      await KeywordToolApi.createTask(session, workspaceId, {
        asin: asinResult.value,
        reportStartDate: dateResult.startDate,
        reportEndDate: dateResult.endDate,
        file
      });

      form.reset();
      fileName.textContent = "点击选择 .xlsx 或 .csv 文件";
      KeywordToolApp.setMessage(feedback, "success", "任务提交成功。后台会自动处理，你可以留在本页查看进度。" );
      await refreshTasks();
    } catch (error) {
      KeywordToolApp.setMessage(feedback, "error", KeywordToolCore.friendlyDataError(error, error.message || "报表提交失败，请检查网络和文件后重试。"));
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "提交分析任务";
    }
  });

  refreshButton.addEventListener("click", refreshTasks);

  function createCell(text, className) {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function renderTasks(tasks) {
    taskBody.replaceChildren();
    taskCount.textContent = `最近 ${tasks.length} 条`;
    tasks.forEach((task) => {
      const row = document.createElement("tr");
      const timeCell = document.createElement("td");
      const time = document.createElement("span");
      time.textContent = KeywordToolCore.formatDateTime(task.created_at);
      const id = document.createElement("span");
      id.className = "task-id";
      id.title = task.id;
      id.textContent = KeywordToolCore.truncateIdentifier(task.id);
      timeCell.append(time, id);
      row.append(timeCell);
      row.append(createCell(task.asin, "asin-value"));
      row.append(createCell(task.report_start_date || "—", "report-date-value"));
      row.append(createCell(task.report_end_date || "—", "report-date-value"));

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `status-badge ${KeywordToolCore.statusClass(task.status)}`;
      badge.textContent = task.status;
      statusCell.append(badge);
      row.append(statusCell);

      const reasonCell = document.createElement("td");
      if (task.failure_reason) {
        const reason = document.createElement("span");
        reason.className = "failure-text";
        reason.title = task.failure_reason;
        reason.textContent = task.failure_reason;
        reasonCell.append(reason);
      } else {
        reasonCell.textContent = "—";
      }
      row.append(reasonCell);

      const actionCell = document.createElement("td");
      if (task.status === "已完成" && task.report_url) {
        const link = document.createElement("a");
        link.className = "mini-link";
        link.href = `../report/?workspace=${encodeURIComponent(workspaceId)}&task=${encodeURIComponent(task.id)}`;
        link.textContent = "查看报告";
        actionCell.append(link);
      } else {
        actionCell.textContent = "—";
      }
      row.append(actionCell);
      taskBody.append(row);
    });
  }

  async function refreshTasks() {
    if (refreshing) return;
    refreshing = true;
    refreshButton.disabled = true;
    refreshButton.setAttribute("aria-busy", "true");
    try {
      const { tasks } = await KeywordToolApi.listTasks(session, workspaceId);
      renderTasks(tasks);
      loadingState.hidden = true;
      emptyState.querySelector("p").textContent = "还没有任务，提交第一份广告报表吧。";
      emptyState.hidden = tasks.length !== 0;
      taskTable.hidden = tasks.length === 0;
    } catch (error) {
      loadingState.hidden = true;
      taskTable.hidden = true;
      emptyState.hidden = false;
      emptyState.querySelector("p").textContent = KeywordToolCore.friendlyDataError(error, "任务列表加载失败，请点击刷新重试。");
    } finally {
      refreshing = false;
      refreshButton.disabled = false;
      refreshButton.removeAttribute("aria-busy");
    }
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshTasks();
    }, config.refreshIntervalMs);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshTasks();
  });

  await refreshTasks();
  scheduleRefresh();
})();
