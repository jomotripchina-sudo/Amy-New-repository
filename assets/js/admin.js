(async function initializeApprovalPage() {
  "use strict";

  const adminEmail = document.querySelector("#admin-email");
  const backToTool = document.querySelector("#back-to-tool");
  const refreshButton = document.querySelector("#refresh-requests");
  const message = document.querySelector("#approval-message");
  const loadingState = document.querySelector("#approval-loading");
  const emptyState = document.querySelector("#approval-empty");
  const table = document.querySelector("#approval-table");
  const tableBody = document.querySelector("#approval-body");
  const count = document.querySelector("#approval-count");

  const statusLabels = Object.freeze({
    pending: "待审批",
    inviting: "邀请发送中",
    invited: "已邀请",
    rejected: "已拒绝",
    invite_failed: "邀请失败"
  });
  const statusClasses = Object.freeze({
    pending: "status--pending",
    inviting: "status--working",
    invited: "status--completed",
    rejected: "status--rejected",
    invite_failed: "status--failed"
  });

  let session;
  let loading = false;
  try {
    session = await KeywordToolApp.requireSession("../");
    if (!session) return;
    adminEmail.textContent = session.user.email || "已登录";
    KeywordToolApp.bindSignOut("../");
  } catch (error) {
    denyPage(error.message || "登录状态无法核验。");
    return;
  }

  const workspaceId = new URLSearchParams(window.location.search).get("workspace");
  if (KeywordToolCore.isUuid(workspaceId)) {
    backToTool.href = `../tool/?workspace=${encodeURIComponent(workspaceId)}`;
  }

  try {
    const profile = await KeywordToolApi.getAccessProfile(session);
    if (!profile.approval_admin) {
      denyPage("当前账号没有申请审批权限。");
      return;
    }
  } catch (error) {
    denyPage(KeywordToolCore.friendlyDataError(error, "管理员身份暂时无法核验，请返回工具页后重试。"));
    return;
  }

  refreshButton.addEventListener("click", loadRequests);
  await loadRequests();

  function denyPage(text) {
    loadingState.hidden = true;
    table.hidden = true;
    emptyState.hidden = true;
    refreshButton.disabled = true;
    KeywordToolApp.setMessage(message, "error", text);
  }

  function createCell(text, className) {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function createActionButton(label, kind, request) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn btn--compact ${kind === "approve" ? "btn--primary" : "btn--secondary"}`;
    button.textContent = label;
    button.addEventListener("click", () => decideRequest(request, kind, button));
    return button;
  }

  function renderRequests(requests) {
    tableBody.replaceChildren();
    count.textContent = `最近 ${requests.length} 条`;
    requests.forEach((request) => {
      const row = document.createElement("tr");
      row.dataset.requestId = request.id;
      row.append(createCell(request.email || "—", "approval-email"));
      row.append(createCell(KeywordToolCore.formatDateTime(request.requested_at), "report-date-value"));

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `status-badge ${statusClasses[request.status] || "status--pending"}`;
      badge.textContent = statusLabels[request.status] || request.status || "未知";
      statusCell.append(badge);
      row.append(statusCell);

      const actionCell = document.createElement("td");
      actionCell.className = "approval-actions";
      if (["pending", "rejected", "invite_failed"].includes(request.status)) {
        actionCell.append(createActionButton("批准并发送邀请", "approve", request));
      }
      if (["pending", "invite_failed"].includes(request.status)) {
        actionCell.append(createActionButton("拒绝", "reject", request));
      }
      if (!actionCell.childElementCount) actionCell.textContent = "—";
      row.append(actionCell);
      tableBody.append(row);
    });
  }

  async function loadRequests() {
    if (loading) return;
    loading = true;
    refreshButton.disabled = true;
    refreshButton.setAttribute("aria-busy", "true");
    KeywordToolApp.setMessage(message, "info", "");
    try {
      const { requests } = await KeywordToolApi.listAccessRequests(session);
      const list = Array.isArray(requests) ? requests : [];
      renderRequests(list);
      loadingState.hidden = true;
      emptyState.hidden = list.length !== 0;
      table.hidden = list.length === 0;
      return true;
    } catch (error) {
      loadingState.hidden = true;
      table.hidden = true;
      emptyState.hidden = true;
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyDataError(error, "申请列表加载失败，请稍后重试。"));
      return false;
    } finally {
      loading = false;
      refreshButton.disabled = false;
      refreshButton.removeAttribute("aria-busy");
    }
  }

  async function decideRequest(request, kind, clickedButton) {
    const approving = kind === "approve";
    const prompt = approving
      ? `确认批准 ${request.email} 并立即发送邀请邮件？`
      : `确认拒绝 ${request.email} 的使用申请？`;
    if (!window.confirm(prompt)) return;

    const row = clickedButton.closest("tr");
    row.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    KeywordToolApp.setMessage(message, "info", approving ? "正在发送邀请，请不要重复操作。" : "正在拒绝申请…");
    try {
      if (approving) {
        await KeywordToolApi.approveAccessRequest(session, request.id);
      } else {
        await KeywordToolApi.rejectAccessRequest(session, request.id);
      }
      const refreshed = await loadRequests();
      if (refreshed) {
        KeywordToolApp.setMessage(message, "success", approving ? "申请已批准，邀请邮件已发送。" : "申请已拒绝。");
      }
    } catch (error) {
      row.querySelectorAll("button").forEach((button) => { button.disabled = false; });
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyDataError(error, error.message || "审批操作失败，请刷新后重试。"));
    }
  }
})();
