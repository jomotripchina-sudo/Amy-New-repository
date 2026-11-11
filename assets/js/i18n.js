(function initializeWorkbenchLanguage(window, document) {
  "use strict";

  const storageKey = "amz-workbench-language";
  const translations = Object.freeze({
    "登录｜AMZ 运营工作台": "Sign in | AMZ Operations Workspace",
    "AMZ 运营工作台登录、申请使用与运营工具入口": "Sign in, request access, and open tools in the AMZ Operations Workspace.",
    "AMZ 运营工作台": "AMZ Operations Workspace",
    "隐私政策": "Privacy Policy",
    "AMZ 运营工作台登录入口": "AMZ Operations Workspace sign-in",
    "安全登录入口": "Secure sign-in",
    "界面语言": "Display language",
    "切换到简体中文": "Switch to Simplified Chinese",
    "工作台介绍": "Workspace overview",
    "我的运营工作台": "My Operations Workspace",
    "一个入口，驱动全部运营动作。": "One workspace for every operation.",
    "将分析、执行、复盘，统一至可扩展的可靠工作流中。让工作流随业务一起成长。": "Bring analysis, execution, and review into one reliable workflow that grows with your business.",
    "运营工作流能力": "Operations workflow",
    "分析": "Analyze",
    "执行": "Execute",
    "复盘": "Review",
    "登录 AMZ 运营工作台": "Sign in to AMZ Operations Workspace",
    "使用工作台账号进入已授权的运营模块。": "Sign in to access your authorized operations tools.",
    "选择要进入的空间": "Choose a workspace",
    "数据、任务与报告彼此隔离": "Data, tasks, and reports stay separate",
    "选择业务空间": "Choose a workspace",
    "测试空间": "Test workspace",
    "个人空间": "Personal workspace",
    "公司空间": "Company workspace",
    "登录或申请使用": "Sign in or request access",
    "登录": "Sign in",
    "申请使用": "Request access",
    "当前已登录：": "Signed in as: ",
    "进入已选空间": "Enter selected workspace",
    "切换账号": "Switch account",
    "邮箱": "Email",
    "密码": "Password",
    "请输入密码": "Enter your password",
    "忘记密码？": "Forgot password?",
    "申请邮箱": "Email address",
    "管理员批准后，邀请邮件会发送到该邮箱。": "After approval, an invitation will be sent to this email address.",
    "网站": "Website",
    "提交使用申请": "Submit access request",
    "登录邮箱": "Account email",
    "我们会向该邮箱发送一次性密码重置链接。": "We'll send a one-time password reset link to this email address.",
    "发送重置邮件": "Send reset email",
    "返回登录": "Back to sign in",
    "设置新密码": "Set a new password",
    "至少 8 位": "At least 8 characters",
    "确认新密码": "Confirm new password",
    "再次输入新密码": "Enter your new password again",
    "保存新密码": "Save new password",
    "账号数据相互隔离，登录后仅可查看本人任务与报告。": "Account data is isolated. After signing in, you can only access your own tasks and reports.",
    "AMZ 运营工作台 · 账号数据相互隔离": "AMZ Operations Workspace · Account data stays isolated",
    "粤ICP备2026126692号-1": "Guangdong ICP filing no. 2026126692-1",
    "已登录 AMZ 运营工作台": "Signed in to AMZ Operations Workspace",
    "选择空间后，使用工作台账号直接进入对应的运营工具。": "Choose a workspace, then sign in to open its operations tools.",
    "申请使用 AMZ 运营工作台": "Request access to AMZ Operations Workspace",
    "提交申请后不会立即创建账号；管理员批准后，我们会向申请邮箱发送邀请。": "Submitting a request does not create an account right away. An administrator will review it and send an invitation.",
    "找回工作台密码": "Reset your workspace password",
    "输入登录邮箱，我们会发送密码重置链接。": "Enter your account email to receive a password reset link.",
    "设置工作台新密码": "Set a new workspace password",
    "请输入新的登录密码，保存后重新登录。": "Enter a new password, then sign in again.",
    "请选择一个空间，直接进入对应的运营工具。": "Choose a workspace to open its operations tools.",
    "请先选择测试空间、个人空间或公司空间。": "Choose a test, personal, or company workspace first.",
    "当前账号的三个业务空间尚未初始化，请稍后重试或联系管理员执行空间迁移。": "Your three workspaces are not set up yet. Try again later or contact an administrator.",
    "空间暂时无法进入，请稍后重试。": "This workspace is temporarily unavailable. Try again later.",
    "当前账号": "Current account",
    "已验证登录状态。请选择一个空间后进入。": "Your sign-in is verified. Choose a workspace to continue.",
    "空间已选定，点击进入已选空间。": "Workspace selected. Choose Enter selected workspace to continue.",
    "空间已选定，请继续登录。": "Workspace selected. Continue signing in.",
    "正在进入…": "Opening…",
    "已退出当前账号，请使用其他账号登录。": "You have signed out. Sign in with another account.",
    "重置链接已验证，请设置新密码。": "Reset link verified. Set a new password.",
    "密码设置链接无效或已过期，请返回登录页重新操作。": "This password setup link is invalid or expired. Return to sign-in and try again.",
    "正在安全登录…": "Signing in securely…",
    "登录状态未建立，请重新登录。": "Your sign-in session could not be created. Please sign in again.",
    "正在提交申请…": "Submitting request…",
    "申请已提交。管理员批准后，邀请邮件会发送到申请邮箱。": "Request submitted. An invitation will be sent to your email after approval.",
    "申请暂时无法提交，请稍后重试。": "Your request could not be submitted. Try again later.",
    "正在发送…": "Sending…",
    "如果该邮箱已注册，密码重置邮件已经发送。请检查收件箱和垃圾邮件。": "If this email is registered, a password reset email has been sent. Check your inbox and spam folder.",
    "重置链接无效或已过期，请返回登录页重新发送。": "This reset link is invalid or expired. Return to sign-in to request another one.",
    "正在保存…": "Saving…",
    "新密码已保存，请使用新密码登录。": "Your new password has been saved. Sign in with it to continue.",
    "请输入有效的申请邮箱。": "Enter a valid email address.",
    "密码至少需要 8 位。": "Your password must be at least 8 characters.",
    "两次输入的密码不一致。": "The passwords do not match.",
    "邮箱或密码不正确，请重新输入。": "The email or password is incorrect. Please try again.",
    "邮箱还没有完成验证，请先查看验证邮件。": "Your email has not been verified. Check your verification email first.",
    "这个邮箱已经注册，请直接登录。": "This email is already registered. Please sign in.",
    "操作太频繁，请稍后再试。": "Too many attempts. Try again later.",
    "网络连接失败，请检查网络后重试。": "Network connection failed. Check your connection and try again.",
    "注册没有成功，请稍后重试。": "Registration failed. Try again later.",
    "重置邮件暂时无法发送，请稍后重试。": "The reset email could not be sent. Try again later.",
    "新密码暂时无法保存，请重新打开邮件里的链接再试。": "Your new password could not be saved. Reopen the link in your email and try again.",
    "登录没有成功，请稍后重试。": "Sign-in failed. Try again later.",
    "请求超时，请稍后重试。": "The request timed out. Try again later.",
    "登录状态已失效，请重新登录。": "Your sign-in session has expired. Please sign in again.",
    "前台配置尚未生成。请先完成阶段 7 的本地配置步骤。": "The workspace configuration has not been created. Complete the local setup first.",
    "前台配置仍是占位值。请先完成阶段 7 的本地配置步骤。": "The workspace configuration still contains placeholders. Complete the local setup first.",
    "前台只允许使用 Supabase 公开钥匙。": "Only a public Supabase key can be used in the workspace frontend.",
    "前台依赖加载失败，请刷新页面重试。": "A workspace dependency failed to load. Refresh the page and try again."
  });

  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const textStates = new WeakMap();
  const attributeStates = new WeakMap();
  let locale = "zh-CN";

  function lookup(value) {
    return translations[normalize(value)] || value;
  }

  function resolveInitialLocale() {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "en" || stored === "zh-CN") return stored;
    } catch {
      // Continue with the browser language when storage is unavailable.
    }
    return String(window.navigator.language || "").toLowerCase().startsWith("en") ? "en" : "zh-CN";
  }

  function preserveWhitespace(original, translated) {
    const leading = String(original).match(/^\s*/)?.[0] || "";
    const trailing = String(original).match(/\s*$/)?.[0] || "";
    return `${leading}${translated}${trailing}`;
  }

  function translateTextNode(node) {
    const current = node.nodeValue || "";
    if (!current.trim()) return;
    const state = textStates.get(node);
    const original = state && current === state.rendered ? state.original : current;
    const translated = locale === "en" ? lookup(normalize(original)) : original;
    const rendered = translated === original ? original : preserveWhitespace(original, translated);
    textStates.set(node, { original, rendered });
    if (current !== rendered) node.nodeValue = rendered;
  }

  function translateAttribute(element, name) {
    if (!element.hasAttribute(name)) return;
    const current = element.getAttribute(name) || "";
    const states = attributeStates.get(element) || new Map();
    const state = states.get(name);
    const original = state && current === state.rendered ? state.original : current;
    const translated = locale === "en" ? lookup(original) : original;
    states.set(name, { original, rendered: translated });
    attributeStates.set(element, states);
    if (current !== translated) element.setAttribute(name, translated);
  }

  function translateSubtree(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (["SCRIPT", "STYLE", "TEXTAREA"].includes(node.tagName)) return;
    ["aria-label", "placeholder", "title", "alt"].forEach((name) => translateAttribute(node, name));
    if (node.tagName === "META" && node.getAttribute("name") === "description") {
      translateAttribute(node, "content");
    }
    node.childNodes.forEach(translateSubtree);
  }

  function updateLanguageControls() {
    document.querySelectorAll("[data-language]").forEach((button) => {
      const active = button.dataset.language === locale;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setLocale(nextLocale) {
    if (nextLocale !== "en" && nextLocale !== "zh-CN") return;
    locale = nextLocale;
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    try {
      window.localStorage.setItem(storageKey, locale);
    } catch {
      // The current page still switches language without persisted storage.
    }
    translateSubtree(document.documentElement);
    updateLanguageControls();
    document.dispatchEvent(new CustomEvent("workbench:languagechange", { detail: { locale } }));
  }

  locale = resolveInitialLocale();
  const languageToggle = document.querySelector("#language-toggle");
  if (languageToggle) {
    languageToggle.hidden = false;
    languageToggle.addEventListener("click", (event) => {
      const button = event.target.closest("[data-language]");
      if (button) setLocale(button.dataset.language);
    });
  }

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "characterData") {
        translateTextNode(record.target);
        return;
      }
      if (record.type === "attributes") {
        translateAttribute(record.target, record.attributeName);
        return;
      }
      record.addedNodes.forEach(translateSubtree);
    });
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "placeholder", "title", "alt", "content"]
  });

  document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  translateSubtree(document.documentElement);
  updateLanguageControls();

  window.WorkbenchI18n = Object.freeze({
    getLocale: () => locale,
    t: (value) => locale === "en" ? lookup(value) : value,
    setLocale
  });
})(window, document);
