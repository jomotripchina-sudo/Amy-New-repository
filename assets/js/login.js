(async function initializeLoginPage() {
  "use strict";

  const tabsContainer = document.querySelector("#auth-tabs");
  const tabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
  const workspacePicker = document.querySelector("#workspace-picker");
  const workspaceOptions = Array.from(document.querySelectorAll("[data-workspace-key]"));
  const authenticatedEntry = document.querySelector("#authenticated-entry");
  const authenticatedEmail = document.querySelector("#authenticated-email");
  const enterSelectedWorkspaceButton = document.querySelector("#enter-selected-workspace");
  const changeAccountButton = document.querySelector("#change-account");
  const forms = {
    login: document.querySelector("#login-form"),
    apply: document.querySelector("#apply-form"),
    forgot: document.querySelector("#forgot-form"),
    recovery: document.querySelector("#recovery-form")
  };
  const forgotButton = document.querySelector("[data-forgot-password]");
  const returnLoginButton = document.querySelector("[data-return-login]");
  const message = document.querySelector("#auth-message");
  const title = document.querySelector("#auth-title");
  const intro = document.querySelector("#auth-intro");

  const modeCopy = {
    login: ["登录 AMZ 运营工作台", "选择空间后，使用工作台账号直接进入对应的运营工具。"],
    apply: ["申请使用 AMZ 运营工作台", "提交申请后不会立即创建账号；管理员批准后，我们会向申请邮箱发送邀请。"],
    forgot: ["找回工作台密码", "输入登录邮箱，我们会发送密码重置链接。"],
    recovery: ["设置工作台新密码", "请输入新的登录密码，保存后重新登录。"]
  };

  let supabaseClient;
  let activeSession = null;
  let selectedWorkspaceKey = "";
  let recoverySessionReady = false;

  function showMode(mode, options = {}) {
    if (!forms[mode]) return;
    const usesAuthTabs = mode === "login" || mode === "apply";
    Object.entries(forms).forEach(([name, form]) => { form.hidden = name !== mode || Boolean(activeSession); });
    tabsContainer.hidden = !usesAuthTabs || Boolean(activeSession);
    workspacePicker.hidden = mode !== "login" && !activeSession;
    authenticatedEntry.hidden = !activeSession;
    title.textContent = activeSession ? "已登录 AMZ 运营工作台" : modeCopy[mode][0];
    intro.textContent = activeSession ? "请选择一个空间，直接进入对应的运营工具。" : modeCopy[mode][1];
    tabs.forEach((tab) => {
      const active = tab.dataset.authTab === mode;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    if (!options.keepMessage) KeywordToolApp.setMessage(message, "info", "");
  }

  function setWorkspaceSelection(workspaceKey) {
    selectedWorkspaceKey = workspaceKey;
    workspaceOptions.forEach((option) => {
      const selected = option.dataset.workspaceKey === workspaceKey;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-checked", String(selected));
    });
  }

  function requireWorkspaceSelection() {
    if (selectedWorkspaceKey) return true;
    KeywordToolApp.setMessage(message, "error", "请先选择测试空间、个人空间或公司空间。");
    workspacePicker.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  async function openSelectedWorkspace(session) {
    if (!requireWorkspaceSelection()) return false;
    try {
      const { workspaces } = await KeywordToolApi.listWorkspaces(session);
      const workspace = workspaces.find((item) => item.workspace_key === selectedWorkspaceKey);
      if (!workspace?.id) {
        throw new Error("当前账号的三个业务空间尚未初始化，请稍后重试或联系管理员执行空间迁移。");
      }
      window.location.replace(`./tool/?workspace=${encodeURIComponent(workspace.id)}`);
      return true;
    } catch (error) {
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyDataError(error, "空间暂时无法进入，请稍后重试。"));
      return false;
    }
  }

  function activateExistingSession(session) {
    activeSession = session;
    authenticatedEmail.textContent = session.user?.email || "当前账号";
    showMode("login", { keepMessage: true });
    KeywordToolApp.setMessage(message, "info", "已验证登录状态。请选择一个空间后进入。");
  }

  function credentialSetupRequestedByUrl() {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const flowType = query.get("type") || hash.get("type");
    return query.get("mode") === "recovery" || flowType === "recovery" || flowType === "invite";
  }

  function cleanRecoveryUrl(keepRecoveryMode) {
    const clean = new URL("./", window.location.href);
    if (keepRecoveryMode) clean.searchParams.set("mode", "recovery");
    window.history.replaceState({}, "", clean.href);
  }

  workspaceOptions.forEach((option) => option.addEventListener("click", () => {
    setWorkspaceSelection(option.dataset.workspaceKey);
    KeywordToolApp.setMessage(message, "info", activeSession ? "空间已选定，点击进入已选空间。" : "空间已选定，请继续登录。");
  }));
  tabs.forEach((tab) => tab.addEventListener("click", () => showMode(tab.dataset.authTab)));
  forgotButton.addEventListener("click", () => {
    forms.forgot.elements.email.value = forms.login.elements.email.value.trim();
    showMode("forgot");
    forms.forgot.elements.email.focus();
  });
  returnLoginButton.addEventListener("click", () => showMode("login"));
  enterSelectedWorkspaceButton.addEventListener("click", async () => {
    enterSelectedWorkspaceButton.disabled = true;
    enterSelectedWorkspaceButton.textContent = "正在进入…";
    await openSelectedWorkspace(activeSession);
    enterSelectedWorkspaceButton.disabled = false;
    enterSelectedWorkspaceButton.textContent = "进入已选空间";
  });
  changeAccountButton.addEventListener("click", async () => {
    changeAccountButton.disabled = true;
    try {
      const { error } = await supabaseClient.auth.signOut({ scope: "local" });
      if (error) throw error;
      activeSession = null;
      showMode("login", { keepMessage: true });
      KeywordToolApp.setMessage(message, "success", "已退出当前账号，请使用其他账号登录。");
    } catch (error) {
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyAuthError(error, "login"));
    } finally {
      changeAccountButton.disabled = false;
    }
  });

  const urlRequestsCredentialSetup = credentialSetupRequestedByUrl();
  try {
    supabaseClient = KeywordToolApp.getClient();
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recoverySessionReady = Boolean(session);
        cleanRecoveryUrl(true);
        showMode("recovery");
        KeywordToolApp.setMessage(message, "info", "重置链接已验证，请设置新密码。");
      }
    });
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (urlRequestsCredentialSetup) {
      recoverySessionReady = Boolean(data.session);
      showMode("recovery");
      if (recoverySessionReady) cleanRecoveryUrl(true);
      if (!recoverySessionReady) {
        KeywordToolApp.setMessage(message, "error", "密码设置链接无效或已过期，请返回登录页重新操作。");
        forms.recovery.querySelector("button[type='submit']").disabled = true;
      }
    } else if (data.session) {
      activateExistingSession(data.session);
    } else {
      showMode("login");
    }
  } catch (error) {
    KeywordToolApp.setMessage(message, "error", error.message);
    document.querySelectorAll("button[type='submit']").forEach((button) => { button.disabled = true; });
    return;
  }

  forms.login.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireWorkspaceSelection()) return;
    const button = forms.login.querySelector("button[type='submit']");
    const email = forms.login.elements.email.value.trim();
    const password = forms.login.elements.password.value;
    button.disabled = true;
    button.textContent = "正在安全登录…";
    KeywordToolApp.setMessage(message, "info", "");
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("登录状态未建立，请重新登录。");
      await openSelectedWorkspace(data.session);
    } catch (error) {
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyAuthError(error, "login"));
    } finally {
      button.disabled = false;
      button.textContent = "登录";
    }
  });

  forms.apply.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = forms.apply.querySelector("button[type='submit']");
    const emailResult = KeywordToolCore.validateAccessRequestEmail(forms.apply.elements.email.value);
    if (!emailResult.ok) {
      forms.apply.elements.email.setCustomValidity(emailResult.message);
      forms.apply.elements.email.reportValidity();
      KeywordToolApp.setMessage(message, "error", emailResult.message);
      return;
    }
    button.disabled = true;
    button.textContent = "正在提交申请…";
    KeywordToolApp.setMessage(message, "info", "");
    try {
      const result = await KeywordToolApi.submitAccessRequest(emailResult.value, forms.apply.elements.website.value);
      forms.apply.reset();
      KeywordToolApp.setMessage(message, "success", result.message || "申请已提交。管理员批准后，邀请邮件会发送到申请邮箱。");
    } catch (error) {
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyDataError(error, error.message || "申请暂时无法提交，请稍后重试。"));
    } finally {
      button.disabled = false;
      button.textContent = "提交使用申请";
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
      KeywordToolApp.setMessage(message, "success", "如果该邮箱已注册，密码重置邮件已经发送。请检查收件箱和垃圾邮件。");
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
      KeywordToolApp.setMessage(message, "error", "重置链接无效或已过期，请返回登录页重新发送。");
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
      KeywordToolApp.setMessage(message, "success", "新密码已保存，请使用新密码登录。");
    } catch (error) {
      KeywordToolApp.setMessage(message, "error", KeywordToolCore.friendlyAuthError(error, "recovery"));
    } finally {
      button.disabled = false;
      button.textContent = "保存新密码";
    }
  });
})();
