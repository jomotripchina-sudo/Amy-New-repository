(function registerKeywordToolApp(window) {
  "use strict";

  let client;

  function getConfig() {
    const config = window.KEYWORD_TOOL_CONFIG;
    if (!config || !config.supabaseUrl || !config.supabasePublishableKey) {
      throw new Error("前台配置尚未生成。请先完成阶段 7 的本地配置步骤。");
    }
    if (String(config.supabaseUrl).includes("__SUPABASE_") || String(config.supabasePublishableKey).includes("__SUPABASE_")) {
      throw new Error("前台配置仍是占位值。请先完成阶段 7 的本地配置步骤。");
    }
    if (!String(config.supabasePublishableKey).startsWith("sb_publishable_")) {
      throw new Error("前台只允许使用 Supabase 公开钥匙。");
    }
    return config;
  }

  function getClient() {
    if (client) return client;
    const config = getConfig();
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("前台依赖加载失败，请刷新页面重试。");
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  }

  async function requireSession(loginHref) {
    const supabaseClient = getClient();
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session) {
      const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const loginUrl = new URL(loginHref, window.location.href);
      loginUrl.searchParams.set("returnTo", target);
      window.location.replace(loginUrl.href);
      return null;
    }
    return data.session;
  }

  async function signOutAndRedirect(loginHref) {
    const button = document.querySelector("[data-sign-out]");
    if (button) button.disabled = true;
    try {
      await getClient().auth.signOut();
    } finally {
      window.location.replace(loginHref);
    }
  }

  function setMessage(element, type, text) {
    if (!element) return;
    if (!text) {
      element.hidden = true;
      element.textContent = "";
      element.className = "message";
      return;
    }
    element.hidden = false;
    element.className = `message message--${type}`;
    element.textContent = text;
  }

  function bindSignOut(loginHref) {
    const button = document.querySelector("[data-sign-out]");
    if (!button) return;
    button.addEventListener("click", () => signOutAndRedirect("/login/"));
  }

  window.KeywordToolApp = Object.freeze({
    getConfig,
    getClient,
    requireSession,
    signOutAndRedirect,
    setMessage,
    bindSignOut
  });
})(window);
