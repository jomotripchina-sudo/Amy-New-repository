(function registerKeywordToolApi(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KeywordToolApi = api;
})(typeof window !== "undefined" ? window : globalThis, function createKeywordToolApi() {
  "use strict";

  function validateApiBaseUrl(value) {
    let url;
    try {
      url = new URL(String(value || "").trim());
    } catch {
      throw new Error("安全 API 尚未配置，请联系管理员完成子域名和证书部署。");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port !== "18080" || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("安全 API 地址配置不正确，页面已停止调用。");
    }
    return url.origin;
  }

  function apiBaseUrl() {
    const config = KeywordToolApp.getConfig();
    return validateApiBaseUrl(config.apiBaseUrl);
  }

  function assertWorkspaceId(workspaceId) {
    const value = String(workspaceId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error("业务空间地址无效，请返回登录页重新选择空间。");
    }
    return value;
  }

  function assertAccessRequestId(requestId) {
    const value = String(requestId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error("访问申请编号无效，请刷新审批列表后重试。");
    }
    return value;
  }

  function assertTaskId(taskId) {
    const value = String(taskId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value)) {
      throw new Error("任务地址无效，请返回工具页重新打开报告。");
    }
    return value;
  }

  async function readFileAsBase64(file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(new Error("报表文件读取失败。")));
      reader.readAsDataURL(file);
    });
    const separator = String(dataUrl).indexOf(",");
    if (separator < 0) throw new Error("报表文件读取失败。");
    return String(dataUrl).slice(separator + 1);
  }

  async function request(session, path, options = {}) {
    const token = String(session?.access_token || "").trim();
    if (!token) throw new Error("登录状态已失效，请重新登录。");
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "omit",
      cache: "no-store",
      redirect: "error"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `API 请求失败：HTTP ${response.status}`);
      error.code = payload?.error?.code || "API_REQUEST_FAILED";
      throw error;
    }
    return payload;
  }

  async function publicRequest(path, body) {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
      cache: "no-store",
      redirect: "error"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `API 请求失败：HTTP ${response.status}`);
      error.code = payload?.error?.code || "API_REQUEST_FAILED";
      throw error;
    }
    return payload;
  }

  async function listWorkspaces(session) {
    return request(session, "/v1/workspaces");
  }

  async function listSources(session, workspaceId) {
    return request(session, `/v1/workspaces/${encodeURIComponent(assertWorkspaceId(workspaceId))}/sources`);
  }

  async function createTask(session, workspaceId, { asin, competitorAsins = [], coreKeyword = "", reportStartDate, reportEndDate, file }) {
    return request(session, `/v1/workspaces/${encodeURIComponent(assertWorkspaceId(workspaceId))}/tasks`, {
      method: "POST",
      body: {
        asin,
        competitorAsins,
        coreKeyword,
        reportStartDate,
        reportEndDate,
        file: {
          name: file.name,
          contentBase64: await readFileAsBase64(file)
        }
      }
    });
  }

  async function listTasks(session, workspaceId) {
    return request(session, `/v1/workspaces/${encodeURIComponent(assertWorkspaceId(workspaceId))}/tasks`);
  }

  async function getTask(session, workspaceId, taskId) {
    return request(session, `/v1/workspaces/${encodeURIComponent(assertWorkspaceId(workspaceId))}/tasks/${encodeURIComponent(taskId)}`);
  }

  async function updateAdvertisingData(session, workspaceId, taskId, payload) {
    return request(session, `/v1/workspaces/${encodeURIComponent(assertWorkspaceId(workspaceId))}/tasks/${encodeURIComponent(assertTaskId(taskId))}/advertising-data`, {
      method: "POST",
      body: payload
    });
  }

  async function previewVocProducts(session, workspaceId, payload) {
    return request(session, `/v1/workspaces/${encodeURIComponent(assertWorkspaceId(workspaceId))}/voc/product-preview`, {
      method: "POST",
      body: payload
    });
  }

  async function createVocTask(session, workspaceId, payload) {
    return request(session, `/v1/workspaces/${encodeURIComponent(assertWorkspaceId(workspaceId))}/voc/tasks`, {
      method: "POST",
      body: payload
    });
  }

  async function deleteVocTask(session, workspaceId, taskId) {
    return request(session, `/v1/workspaces/${encodeURIComponent(assertWorkspaceId(workspaceId))}/voc/tasks/${encodeURIComponent(assertTaskId(taskId))}`, {
      method: "DELETE"
    });
  }

  async function submitAccessRequest(email, website = "") {
    return publicRequest("/v1/access-requests", { email, website });
  }

  async function getAccessProfile(session) {
    return request(session, "/v1/access-profile");
  }

  async function listAccessRequests(session) {
    return request(session, "/v1/admin/access-requests");
  }

  async function approveAccessRequest(session, requestId) {
    return request(session, `/v1/admin/access-requests/${encodeURIComponent(assertAccessRequestId(requestId))}/approve`, { method: "POST" });
  }

  async function rejectAccessRequest(session, requestId) {
    return request(session, `/v1/admin/access-requests/${encodeURIComponent(assertAccessRequestId(requestId))}/reject`, { method: "POST" });
  }

  return Object.freeze({
    validateApiBaseUrl,
    assertWorkspaceId,
    assertAccessRequestId,
    assertTaskId,
    submitAccessRequest,
    getAccessProfile,
    listAccessRequests,
    approveAccessRequest,
    rejectAccessRequest,
    listWorkspaces,
    listSources,
    createTask,
    listTasks,
    getTask,
    updateAdvertisingData,
    previewVocProducts,
    createVocTask,
    deleteVocTask
  });
});
