(async function initializeLoginPage() {
  "use strict";

  const tabsContainer = document.querySelector("#auth-tabs");
  const tabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
  const forms = {
    login: document.querySelector("#login-form"),
    signup: document.querySelector("#signup-form"),
    forgot: document.querySelector("#forgot-form"),
    recovery: document.querySelector("#recovery-form")
  };
  const forgotButton = document.querySelector("[data-forgot-password]");
  const returnLoginButton = document.querySelector("[data-return-login]");
  const message = document.querySelector("#auth-message");
  const title = document.querySelector("#auth-title");
  const intro = document.querySelector("#auth-intro");

  const modeCopy = {
    login: ["登录 AMZ 运营工作台", "使用工作台账号进入已授权的运营模块。"],
    signup: ["创建工作台账号", "注册后即可使用当前开放的运营模块。"],
    forgot: ["找回工作台密码", "输入登录邮箱，我们会发送密码重置链接。"],
    recovery: ["设置工作台新密码", "请输入新的登录密码，保存后重新登录。"]
  };

  function showMode(mode, options = {}) {
    if (!forms[mode]) return;
    Object.entries(forms).forEach(([name, form]) => { form.hidden = name !== mode; });
    const usesTabs = mode === "login" || mode === "signup";
    tabsContainer.hidden = !usesTabs;
    title.textContent = modeCopy[mode][0];
    intro.textContent = modeCopy[mode][1];
    tabs.forEach((tab) => {
      const active = tab.dataset.authTab === mode;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    if (!options.keepMessage) KeywordToolApp.setMessage(message, "info", "");
  }

  function recoveryRequestedByUrl() {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return query.get("mode") === "recovery" || hash.get("type") === "recovery";
  }

  function cleanRecoveryUrl(keepRecoveryMode) {
    const clean = new URL("./", window.location.href);
    if (keepRecoveryMode) clean.searchParams.set("mode", "recovery");
    window.history.replaceState({}, "", clean.href);
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => showMode(tab.dataset.authTab)));
  forgotButton.addEventListener("click", () => {
    forms.forgot.elements.email.value = forms.login.elements.email.value.trim();
    showMode("forgot");
    forms.forgot.elements.email.focus();
  });
  returnLoginButton.addEventListener("click", () => showMode("login"));

  let supabaseClient;
  let recoverySessionReady = false;
  const urlRequestsRecovery = recoveryRequestedByUrl();
  try {
    supabaseClient = KeywordToolApp.getClient();
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recoverySessionReady = Boolean(session);
        cleanRecoveryUrl(true);
        showMode("recovery");
        KeywordToolApp.setMessage(message, "info", "重置链接已验证，请设置新密码。" );
      }
    });
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (urlRequestsRecovery) {
      recoverySessionReady = Boolean(data.session);
      showMode("recovery");
      if (!recoverySessionReady) {
        KeywordToolApp.setMessage(message, "error", "重置链接无效或已过期，请返回登录页重新发送。" );
        forms.recovery.querySelector("button[type='submit']").disabled = true;
      }
    } else if (data.session) {
      window.location.replace("./tool/");
      return;
    }
  } catch (error) {
    KeywordToolApp.setMessage(message, "error", error.message);
    document.querySelectorAll("button[type='submit']").forEach((button) => { button.disabled = true; });
    return;
  }

  forms.login.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = forms.login.querySelector("button[type='submit']");
    const email = forms.login.elements.email.value.trim();
    const password = forms.login.elements.password.value;
    button.disabled = true;
    button.textContent = "正在安全登录…";
    KeywordToolApp.setMessage(message, "info", "");
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.replace("./tool/");
    } catch (error) {
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyAuthError(error, "login"));
      button.disabled = false;
      button.textContent = "登录";
    }
  });

  forms.signup.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = forms.signup.querySelector("button[type='submit']");
    const email = forms.signup.elements.email.value.trim();
    const password = forms.signup.elements.password.value;
    const confirmation = forms.signup.elements.password_confirmation.value;
    const passwordResult = KeywordToolCore.validatePasswordPair(password, confirmation);
    if (!passwordResult.ok) {
      KeywordToolApp.setMessage(message, "error", passwordResult.message);
      return;
    }
    button.disabled = true;
    button.textContent = "正在创建账号…";
    KeywordToolApp.setMessage(message, "info", "");
    try {
      const emailRedirectTo = new URL("./", window.location.href).href;
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo }
      });
      if (error) throw error;
      if (data.session) {
        window.location.replace("./tool/");
        return;
      }
      forms.signup.reset();
      KeywordToolApp.setMessage(message, "success", "注册成功。请查看邮箱里的验证邮件，完成验证后再登录。" );
      button.disabled = false;
      button.textContent = "注册";
    } catch (error) {
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyAuthError(error, "signup"));
      button.disabled = false;
      button.textContent = "注册";
    }
  });

  forms.forgot.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = forms.forgot.querySelector("button[type='submit']");
    const email = forms.forgot.elements.email.value.trim();
    button.disabled = true;
    button.textContent = "正在发送…";
    KeywordToolApp.setMessage(message, "info", "");
    try {
      const redirectTo = new URL("./?mode=recovery", window.location.href).href;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      KeywordToolApp.setMessage(message, "success", "如果该邮箱已注册，密码重置邮件已经发送。请检查收件箱和垃圾邮件。" );
    } catch (error) {
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyAuthError(error, "reset"));
    } finally {
      button.disabled = false;
      button.textContent = "发送重置邮件";
    }
  });

  forms.recovery.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = forms.recovery.querySelector("button[type='submit']");
    const password = forms.recovery.elements.password.value;
    const confirmation = forms.recovery.elements.password_confirmation.value;
    const passwordResult = KeywordToolCore.validatePasswordPair(password, confirmation);
    if (!passwordResult.ok) {
      KeywordToolApp.setMessage(message, "error", passwordResult.message);
      return;
    }
    if (!recoverySessionReady) {
      KeywordToolApp.setMessage(message, "error", "重置链接无效或已过期，请返回登录页重新发送。" );
      return;
    }
    button.disabled = true;
    button.textContent = "正在保存…";
    KeywordToolApp.setMessage(message, "info", "");
    try {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      await supabaseClient.auth.signOut({ scope: "local" });
      recoverySessionReady = false;
      forms.recovery.reset();
      cleanRecoveryUrl(false);
      showMode("login", { keepMessage: true });
      KeywordToolApp.setMessage(message, "success", "新密码已保存，请使用新密码登录。" );
    } catch (error) {
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyAuthError(error, "recovery"));
    } finally {
      button.disabled = false;
      button.textContent = "保存新密码";
    }
  });
})();
