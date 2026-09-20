(async function initializeVocPage() {
  "use strict";

  const TASK_TABLE = "voc_tasks";
  const REFRESH_INTERVAL_MS = 10_000;
  const TASK_SELECT_BASE = "id,workspace_id,asins,site,target_review_count,review_scope,status,annotated_count,annotation_total,failure_reason,report_path,product_snapshot,started_at,annotation_started_at,report_started_at,completed_at,created_at,updated_at";
  const TASK_SELECT_WITH_POLARITY = "id,workspace_id,asins,site,target_review_count,review_scope,status,annotated_count,annotation_total,positive_count,neutral_count,negative_count,failure_reason,report_path,product_snapshot,started_at,annotation_started_at,report_started_at,completed_at,created_at,updated_at";
  const SITE_OPTIONS = Object.freeze({
    US: Object.freeze({ flagSrc: "./assets/flags/us.svg", label: "美国站" }),
    CA: Object.freeze({ flagSrc: "./assets/flags/ca.svg", label: "加拿大站" }),
    GB: Object.freeze({ flagSrc: "./assets/flags/gb.svg", label: "英国站" }),
    DE: Object.freeze({ flagSrc: "./assets/flags/de.svg", label: "德国站" })
  });
  const form = document.querySelector("#voc-task-form");
  const asinInput = document.querySelector("#voc-asins");
  const asinTokenInput = document.querySelector("#voc-asin-token-input");
  const asinTokens = document.querySelector("#voc-asin-tokens");
  const asinEntry = document.querySelector("#voc-asin-entry");
  const asinCount = document.querySelector("#voc-asin-count");
  const siteInput = document.querySelector("#voc-site");
  const siteTrigger = document.querySelector("#voc-site-trigger");
  const siteFlag = document.querySelector("#voc-site-flag");
  const siteLabelText = document.querySelector("#voc-site-label");
  const siteMenu = document.querySelector("#voc-site-menu");
  const submitButton = document.querySelector("#voc-submit");
  const feedback = document.querySelector("#voc-feedback");
  const preview = document.querySelector("#voc-preview");
  const previewList = document.querySelector("#voc-preview-list");
  const previewTitle = document.querySelector("#voc-preview-title");
  const previewSummary = document.querySelector("#voc-preview-summary");
  const previewConfig = document.querySelector("#voc-preview-config");
  const previewSelectAll = document.querySelector("#voc-preview-select-all");
  const previewClear = document.querySelector("#voc-preview-clear");
  const previewSelectionCount = document.querySelector("#voc-preview-selection-count");
  const previewClose = document.querySelector("#voc-preview-close");
  const previewCancel = document.querySelector("#voc-preview-cancel");
  const confirmButton = document.querySelector("#voc-confirm");
  const refreshButton = document.querySelector("#voc-refresh");
  const loading = document.querySelector("#voc-loading");
  const empty = document.querySelector("#voc-empty");
  const table = document.querySelector("#voc-table");
  const body = document.querySelector("#voc-task-body");
  const count = document.querySelector("#voc-task-count");
  const workspaceName = document.querySelector("#workspace-name");
  const userEmail = document.querySelector("#user-email");
  const keywordToolLink = document.querySelector("#keyword-tool-link");
  const brandLink = document.querySelector("#voc-brand-link");
  let refreshing = false;
  let refreshTimer;
  let previewSignature = null;
  let previewProducts = [];
  let previewSelection = new Set();
  let asinValues = [];

  function setUnavailable(message) {
    KeywordToolApp.setMessage(feedback, "error", message);
    form.querySelectorAll("input, textarea, select, button").forEach((control) => { control.disabled = true; });
  }

  let session;
  try {
    session = await KeywordToolApp.requireSession("../");
    if (!session) return;
  } catch (error) {
    setUnavailable(error.message);
    return;
  }

  const workspaceId = new URLSearchParams(window.location.search).get("workspace");
  if (!KeywordToolCore.isUuid(workspaceId)) {
    window.location.replace("../");
    return;
  }

  let workspace;
  try {
    const result = await KeywordToolApi.listWorkspaces(session);
    workspace = result.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) throw new Error("该业务空间不存在或不属于当前账号。");
  } catch (error) {
    setUnavailable(KeywordToolCore.friendlyDataError(error, "业务空间暂时无法核验，请返回登录页重试。"));
    return;
  }

  const client = KeywordToolApp.getClient();
  const workspaceQuery = encodeURIComponent(workspaceId);
  workspaceName.textContent = `空间 · ${workspace.name}`;
  userEmail.textContent = session.user.email || "已登录";
  keywordToolLink.href = `../tool/?workspace=${workspaceQuery}`;
  brandLink.href = `./?workspace=${workspaceQuery}`;
  KeywordToolApp.bindSignOut("../");

  function createSiteFlag(site, className = "voc-site-flag-image") {
    const code = String(site || "").toUpperCase();
    const option = SITE_OPTIONS[code];
    if (!option) return null;
    const image = document.createElement("img");
    image.className = className;
    image.src = option.flagSrc;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    return image;
  }

  function appendSiteLabel(container, site, prefix = "") {
    const code = String(site || "").toUpperCase();
    const option = SITE_OPTIONS[code];
    container.replaceChildren();
    if (prefix) container.append(document.createTextNode(prefix));
    if (!option) {
      container.append(document.createTextNode(String(site || "—")));
      return;
    }
    container.append(createSiteFlag(code), document.createTextNode(option.label));
  }

  function syncSitePicker() {
    const code = String(siteInput.value || "US").toUpperCase();
    const option = SITE_OPTIONS[code] || SITE_OPTIONS.US;
    siteInput.value = SITE_OPTIONS[code] ? code : "US";
    siteFlag.replaceChildren(createSiteFlag(siteInput.value));
    siteLabelText.textContent = option.label;
    siteMenu.querySelectorAll(".voc-site-option").forEach((item) => {
      item.setAttribute("aria-selected", String(item.dataset.site === siteInput.value));
    });
  }

  function closeSiteMenu() {
    siteMenu.hidden = true;
    siteTrigger.setAttribute("aria-expanded", "false");
  }

  function openSiteMenu() {
    siteMenu.hidden = false;
    siteTrigger.setAttribute("aria-expanded", "true");
  }

  for (const [code, option] of Object.entries(SITE_OPTIONS)) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "voc-site-option";
    item.dataset.site = code;
    item.setAttribute("role", "option");
    const flag = document.createElement("span");
    flag.className = "voc-site-option__flag";
    flag.setAttribute("aria-hidden", "true");
    flag.append(createSiteFlag(code));
    const label = document.createElement("span");
    label.textContent = option.label;
    item.append(flag, label);
    item.addEventListener("click", () => {
      siteInput.value = code;
      syncSitePicker();
      closeSiteMenu();
      resetPreview();
    });
    siteMenu.append(item);
  }
  siteTrigger.addEventListener("click", () => {
    if (siteMenu.hidden) openSiteMenu(); else closeSiteMenu();
  });
  siteTrigger.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSiteMenu();
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSiteMenu();
    }
  });
  document.addEventListener("click", (event) => {
    if (!siteMenu.hidden && !event.target.closest(".voc-site-picker")) closeSiteMenu();
  });
  syncSitePicker();

  function selectedDraft() {
    return VocCore.validateDraft({
      asins: asinInput.value,
      site: siteInput.value,
      targetReviewCount: document.querySelector('[name="target_review_count"]:checked')?.value,
      reviewScope: document.querySelector('[name="review_scope"]:checked')?.value
    });
  }

  function normalizeAsinToken(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function syncAsinValues() {
    asinInput.value = asinValues.join(" ");
  }

  function renderAsinTokens() {
    asinTokens.replaceChildren();
    for (const [index, asin] of asinValues.entries()) {
      const token = document.createElement("span");
      token.className = "voc-asin-token";
      token.append(document.createTextNode(asin));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "voc-asin-token__remove";
      remove.setAttribute("aria-label", `移除 ASIN ${asin}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        asinValues.splice(index, 1);
        syncAsinValues();
        asinEntry.setCustomValidity("");
        renderAsinTokens();
        updateAsinState();
        resetPreview();
        asinEntry.focus();
      });
      token.append(remove);
      asinTokens.append(token);
    }
    asinTokens.setAttribute("aria-label", asinValues.length ? `已添加 ${asinValues.length} 个 ASIN` : "尚未添加 ASIN");
  }

  function revealAsinEntry() {
    window.requestAnimationFrame(() => {
      asinTokenInput.scrollLeft = asinTokenInput.scrollWidth;
    });
  }

  function replaceAsinValues(values) {
    asinValues = (Array.isArray(values) ? values : String(values || "").split(/[+,，;；\s]+/))
      .map(normalizeAsinToken)
      .filter(Boolean);
    asinEntry.value = "";
    syncAsinValues();
    renderAsinTokens();
  }

  function commitAsinEntry() {
    const values = asinEntry.value
      .split(/[+,，;；\s]+/)
      .map(normalizeAsinToken)
      .filter(Boolean);
    if (!values.length) {
      asinEntry.value = "";
      return false;
    }
    asinValues.push(...values);
    asinEntry.value = "";
    syncAsinValues();
    renderAsinTokens();
    updateAsinState();
    resetPreview();
    revealAsinEntry();
    return true;
  }

  function signatureFor(draft) {
    return JSON.stringify({ asins: [...draft.values].sort(), site: draft.site, targetReviewCount: draft.targetReviewCount, reviewScope: draft.reviewScope });
  }

  function resetPreview() {
    previewSignature = null;
    previewProducts = [];
    previewSelection = new Set();
    preview.hidden = true;
    document.body.classList.remove("has-voc-preview-modal");
    previewList.replaceChildren();
    previewTitle.textContent = "包含 0 个商品";
    previewSummary.textContent = "默认按近一月销量倒序展示";
    previewSelectionCount.textContent = "0/0 已选择";
    previewSelectAll.checked = false;
    previewSelectAll.indeterminate = false;
    previewConfig.textContent = "选择评论条数后显示消耗";
    confirmButton.disabled = false;
    confirmButton.innerHTML = '<span aria-hidden="true">ϟ</span>开始分析';
    submitButton.innerHTML = '<span class="voc-search-icon" aria-hidden="true"></span>分析';
  }

  function previewConfigurationLabel(draft, selectedCount = previewSelection.size) {
    return `已选 ${selectedCount} 个商品 · 每个 ASIN ${draft.targetReviewCount} 条 · ${draft.reviewScope}`;
  }

  function renderPreviewConfiguration(draft) {
    previewConfig.textContent = previewConfigurationLabel(draft);
  }

  function formatPreviewPrice(product) {
    if (!Number.isFinite(product.price)) return "—";
    const prefix = ({ US: "$", CA: "CA$", GB: "£", DE: "€" })[String(product.site || "").toUpperCase()] || "";
    return `${prefix}${product.price.toFixed(2)}`;
  }

  function selectablePreviewProducts() {
    return previewProducts.filter((product) => product.found !== false);
  }

  function updatePreviewSelectionState() {
    const selectable = selectablePreviewProducts();
    const selectableAsins = new Set(selectable.map((product) => product.asin));
    previewSelection = new Set([...previewSelection].filter((asin) => selectableAsins.has(asin)));
    const selectedCount = previewSelection.size;
    previewTitle.textContent = `包含 ${previewProducts.length} 个商品`;
    previewSelectionCount.textContent = `${selectedCount}/${previewProducts.length} 已选择`;
    previewSelectAll.checked = selectable.length > 0 && selectedCount === selectable.length;
    previewSelectAll.indeterminate = selectedCount > 0 && selectedCount < selectable.length;
    const draft = selectedDraft();
    if (draft.ok) renderPreviewConfiguration(draft);
    confirmButton.disabled = selectedCount === 0;
  }

  function renderPreview(products, draft) {
    const openingPreview = preview.hidden;
    previewList.replaceChildren();
    for (const product of products) {
      const card = document.createElement("label");
      const isMissing = product.found === false;
      card.className = `voc-product-card${isMissing ? " is-missing" : ""}${previewSelection.has(product.asin) ? " is-selected" : ""}`;
      const selection = document.createElement("input");
      selection.className = "voc-product-card__select";
      selection.type = "checkbox";
      selection.checked = previewSelection.has(product.asin);
      selection.disabled = isMissing;
      selection.setAttribute("aria-label", `选择商品 ${product.asin}`);
      selection.addEventListener("change", () => {
        if (selection.checked) previewSelection.add(product.asin); else previewSelection.delete(product.asin);
        card.classList.toggle("is-selected", selection.checked);
        updatePreviewSelectionState();
      });
      const visual = document.createElement(product.imageUrl ? "img" : "div");
      visual.className = "voc-product-card__image";
      if (product.imageUrl) {
        visual.src = product.imageUrl;
        visual.alt = product.title ? `${product.title} 商品图` : `${product.asin} 商品图`;
        visual.referrerPolicy = "no-referrer";
      } else {
        visual.textContent = product.found === false ? "未检索到商品" : "暂无商品图";
      }
      const content = document.createElement("div");
      content.className = "voc-product-card__content";
      const status = document.createElement("span");
      status.className = `voc-product-card__status${isMissing ? " is-missing" : ""}`;
      status.textContent = isMissing ? "未检索到商品" : "已检索";
      const title = document.createElement("strong");
      title.className = "voc-product-card__title";
      title.textContent = product.title || product.asin;
      if (product.title) title.title = product.title;
      const price = document.createElement("strong");
      price.className = "voc-product-card__price";
      price.textContent = formatPreviewPrice(product);
      const brand = document.createElement("span");
      brand.className = "voc-product-card__brand";
      brand.textContent = product.brand ? `品牌：${product.brand}` : "品牌信息暂缺";
      const asinValue = document.createElement("code");
      asinValue.className = "voc-product-card__asin";
      asinValue.textContent = product.asin;
      const facts = document.createElement("dl");
      const values = [
        ["星级", Number.isFinite(product.rating) ? product.rating.toFixed(1) : "—"],
        ["评论数", Number.isFinite(product.reviewCount) ? product.reviewCount.toLocaleString("zh-CN") : "—"],
        ["上架", product.onlineDate || "—"],
        ["月销量", Number.isFinite(product.monthlySales) ? product.monthlySales.toLocaleString("zh-CN") : "—"]
      ];
      for (const [label, value] of values) {
        const item = document.createElement("div");
        const name = document.createElement("dt");
        const detail = document.createElement("dd");
        name.textContent = label;
        detail.textContent = value;
        item.append(name, detail);
        facts.append(item);
      }
      content.append(status, title, price, brand, facts, asinValue);
      card.append(selection, visual, content);
      previewList.append(card);
    }
    const hasMissing = products.some((product) => product.found === false);
    const foundCount = products.filter((product) => product.found !== false).length;
    previewSummary.textContent = hasMissing
      ? `已检索 ${foundCount} / ${products.length} 个商品；未检索到的商品不可选择。`
      : "默认按近一月销量倒序展示";
    renderPreviewConfiguration(draft);
    preview.hidden = false;
    document.body.classList.add("has-voc-preview-modal");
    updatePreviewSelectionState();
    if (openingPreview) window.requestAnimationFrame(() => previewClose.focus());
  }

  function updateAsinState() {
    const recognized = VocCore.parseAsins(asinInput.value).length;
    asinCount.textContent = `${recognized}/10`;
    document.querySelector("#asin-hint").textContent = recognized
      ? `已识别 ${recognized} 个 ASIN；一次最多 10 个。`
      : "一次最多输入 10 个 ASIN，系统会先核对商品信息。";
  }

  function restoreTaskDraft(task) {
    replaceAsinValues(task.asins || []);
    const taskSite = String(task.site || "").toUpperCase();
    siteInput.value = SITE_OPTIONS[taskSite] ? taskSite : "US";
    syncSitePicker();
    const countControl = [...document.querySelectorAll('[name="target_review_count"]')].find((control) => Number(control.value) === Number(task.target_review_count));
    const scopeControl = [...document.querySelectorAll('[name="review_scope"]')].find((control) => control.value === task.review_scope);
    if (countControl) countControl.checked = true;
    if (scopeControl) scopeControl.checked = true;
    asinEntry.setCustomValidity("");
    updateAsinState();
    resetPreview();
    document.querySelector(".voc-hero").scrollIntoView({ behavior: "smooth", block: "start" });
    asinInput.focus({ preventScroll: true });
  }

  function taskSnapshot(task) {
    if (Array.isArray(task.product_snapshot)) return task.product_snapshot[0] || null;
    if (task.product_snapshot && typeof task.product_snapshot === "object") return task.product_snapshot;
    return null;
  }

  function renderTasks(tasks) {
    body.replaceChildren();
    count.textContent = `历史记录 · 最近 ${tasks.length} 条`;
    for (const task of tasks) {
      const card = document.createElement("article");
      card.className = `voc-task-card${task.status === "失败" ? " voc-task-card--failed" : ""}`;
      card.title = `任务号：${task.id}`;

      const snapshot = taskSnapshot(task);
      const visual = document.createElement(snapshot?.imageUrl ? "img" : "div");
      visual.className = "voc-task-card__image";
      if (snapshot?.imageUrl) {
        visual.src = snapshot.imageUrl;
        visual.alt = snapshot.title ? `${snapshot.title} 商品图` : `${(task.asins || ["商品"])[0]} 商品图`;
        visual.referrerPolicy = "no-referrer";
        visual.loading = "lazy";
      } else {
        visual.textContent = "暂无商品图";
      }

      const content = document.createElement("div");
      content.className = "voc-task-card__body";
      const head = document.createElement("div");
      head.className = "voc-task-card__head";
      const asin = document.createElement("strong");
      asin.className = "voc-task-card__asin";
      const taskAsins = task.asins || [];
      asin.textContent = taskAsins.length ? taskAsins.join("、") : "未知 ASIN";
      asin.title = taskAsins.join("、");
      const status = document.createElement("span");
      status.className = `voc-status ${VocCore.statusClass(task.status)}`;
      status.textContent = task.status;
      head.append(asin, status);

      if (snapshot?.title) {
        const title = document.createElement("p");
        title.className = "voc-task-card__title";
        title.textContent = snapshot.title;
        title.title = snapshot.title;
        content.append(title);
      }

      const site = document.createElement("p");
      site.className = "voc-task-card__meta voc-task-card__site";
      appendSiteLabel(site, task.site, "站点：");
      const review = document.createElement("p");
      review.className = "voc-task-card__meta";
      const total = Number(task.annotation_total) || 0;
      const positive = task.positive_count === null || task.positive_count === undefined ? null : Number(task.positive_count);
      const neutral = task.neutral_count === null || task.neutral_count === undefined ? null : Number(task.neutral_count);
      const negative = task.negative_count === null || task.negative_count === undefined ? null : Number(task.negative_count);
      const hasPolarityCounts = Number.isFinite(positive) && Number.isFinite(neutral) && Number.isFinite(negative);
      const polarity = hasPolarityCounts
        ? `（正向：${positive} / 中性：${neutral} / 负向：${negative}）`
        : "（正向：— / 中性：— / 负向：—）";
      review.textContent = total ? `评论：${total} 条` : `评论：每个 ASIN ${task.target_review_count} 条`;
      const polarityLine = document.createElement("p");
      polarityLine.className = "voc-task-card__meta voc-task-card__polarity";
      polarityLine.textContent = polarity;
      content.append(review, polarityLine);
      const scope = document.createElement("p");
      scope.className = "voc-task-card__meta";
      scope.textContent = task.review_scope || "—";
      const timestamp = document.createElement("p");
      timestamp.className = "voc-task-card__time";
      timestamp.textContent = KeywordToolCore.formatDateTime(task.completed_at || task.created_at);
      content.prepend(head, site);

      if (task.status === "失败") {
        const failure = document.createElement("p");
        failure.className = "voc-task-card__failure";
        failure.textContent = task.failure_reason || "分析失败，请重新提交。";
        content.append(failure);
      } else if (task.status !== "完成") {
        const eta = VocCore.estimateEta(task, tasks);
        const etaLine = document.createElement("p");
        etaLine.className = "voc-task-card__eta";
        etaLine.textContent = `${VocCore.progressLabel(task)} · ${eta.label}`;
        content.append(etaLine);
      }
      content.append(timestamp);

      const actions = document.createElement("div");
      actions.className = "voc-task-card__actions";
      if (task.status === "完成") {
        const reportLink = document.createElement("a");
        reportLink.className = "voc-task-card__link";
        reportLink.href = `./report/?workspace=${workspaceQuery}&task=${encodeURIComponent(task.id)}`;
        reportLink.textContent = "点击查看报告 →";
        actions.append(reportLink);
      } else if (task.status === "失败") {
        const retry = document.createElement("button");
        retry.className = "voc-task-card__retry";
        retry.type = "button";
        retry.textContent = "↻ 重新分析";
        retry.addEventListener("click", () => restoreTaskDraft(task));
        actions.append(retry);
      }
      content.append(actions);
      if (["完成", "失败"].includes(task.status)) {
        const remove = document.createElement("button");
        remove.className = "voc-task-card__delete";
        remove.type = "button";
        remove.setAttribute("aria-label", "删除历史记录");
        remove.textContent = "🗑";
        remove.addEventListener("click", async () => {
          if (!window.confirm("确认删除这条历史记录吗？删除后将无法从报告列表打开。")) return;
          remove.disabled = true;
          remove.textContent = "…";
          try {
            await KeywordToolApi.deleteVocTask(session, workspaceId, task.id);
            KeywordToolApp.setMessage(feedback, "success", "历史记录已删除。此前生成的报告不再出现在当前列表中。");
            await refreshTasks();
          } catch (error) {
            remove.disabled = false;
            remove.textContent = "🗑";
            KeywordToolApp.setMessage(feedback, "error", KeywordToolCore.friendlyDataError(error, "历史记录删除失败，请稍后重试。"));
          }
        });
        card.append(remove);
      }
      card.append(visual, content);
      body.append(card);
    }
  }

  async function refreshTasks() {
    if (refreshing) return;
    refreshing = true;
    refreshButton.disabled = true;
    try {
      const queryTasks = (select) => client
        .from(TASK_TABLE)
        .select(select)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(50);
      let result = await queryTasks(TASK_SELECT_WITH_POLARITY);
      if (result.error && /positive_count|neutral_count|negative_count/i.test(String(result.error.message || ""))) {
        result = await queryTasks(TASK_SELECT_BASE);
      }
      const { data, error } = result;
      if (error) throw error;
      const tasks = data || [];
      renderTasks(tasks);
      loading.hidden = true;
      empty.hidden = tasks.length !== 0;
      table.hidden = tasks.length === 0;
    } catch (error) {
      loading.hidden = true;
      table.hidden = true;
      empty.hidden = false;
      empty.querySelector("p").textContent = KeywordToolCore.friendlyDataError(error, "用户洞察任务加载失败，请点击刷新重试。");
    } finally {
      refreshing = false;
      refreshButton.disabled = false;
    }
  }

  asinTokenInput.addEventListener("click", () => asinEntry.focus());

  asinEntry.addEventListener("input", () => {
    asinEntry.setCustomValidity("");
    if (/[+,，;；\s]/.test(asinEntry.value)) {
      commitAsinEntry();
      return;
    }
    resetPreview();
  });

  asinEntry.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitAsinEntry();
      return;
    }
    if (event.key === "Backspace" && !asinEntry.value && asinValues.length) {
      event.preventDefault();
      asinValues.pop();
      syncAsinValues();
      renderAsinTokens();
      updateAsinState();
      resetPreview();
    }
  });

  asinEntry.addEventListener("blur", commitAsinEntry);

  siteInput.addEventListener("change", resetPreview);
  document.querySelectorAll('[name="target_review_count"], [name="review_scope"]').forEach((control) => control.addEventListener("change", () => {
    const draft = selectedDraft();
    if (!draft.ok || preview.hidden || !previewProducts.length) return;
    previewSignature = signatureFor(draft);
    renderPreviewConfiguration(draft);
  }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    commitAsinEntry();
    const draft = selectedDraft();
    if (!draft.ok) {
      asinEntry.setCustomValidity(draft.message);
      asinEntry.reportValidity();
      KeywordToolApp.setMessage(feedback, "error", draft.message);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "正在分析…";
    KeywordToolApp.setMessage(feedback, "info", "正在读取产品预览。" );
    try {
      const result = await KeywordToolApi.previewVocProducts(session, workspaceId, {
        asins: draft.values,
        site: draft.site,
        targetReviewCount: draft.targetReviewCount,
        reviewScope: draft.reviewScope
      });
      if (!Array.isArray(result.products) || result.products.length !== draft.values.length) throw new Error("产品预览没有返回完整结果，请稍后重试。");
      previewSignature = signatureFor(draft);
      previewProducts = [...result.products].sort((left, right) => {
        const salesDifference = (Number(right.monthlySales) || 0) - (Number(left.monthlySales) || 0);
        return salesDifference || draft.values.indexOf(left.asin) - draft.values.indexOf(right.asin);
      });
      previewSelection = new Set(previewProducts.filter((product) => product.found !== false).map((product) => product.asin));
      renderPreview(previewProducts, draft);
      const cacheHint = previewProducts.every((product) => product.cache === "hit") ? "已使用 24 小时内的产品缓存。" : "已获得最新产品预览。";
      KeywordToolApp.setMessage(feedback, "success", `${cacheHint} 请确认商品信息后创建任务。`);
    } catch (error) {
      KeywordToolApp.setMessage(feedback, "error", KeywordToolCore.friendlyDataError(error, "任务提交失败，请稍后重试。"));
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = '<span class="voc-search-icon" aria-hidden="true"></span>分析';
    }
  });

  confirmButton.addEventListener("click", async () => {
    const draft = selectedDraft();
    if (!draft.ok) {
      KeywordToolApp.setMessage(feedback, "error", draft.message);
      resetPreview();
      return;
    }
    if (signatureFor(draft) !== previewSignature || !previewProducts.length) {
      KeywordToolApp.setMessage(feedback, "error", "ASIN 或任务配置已变化，请重新完成产品预览。");
      resetPreview();
      return;
    }
    const selectedValues = draft.values.filter((asin) => previewSelection.has(asin));
    if (!selectedValues.length) {
      KeywordToolApp.setMessage(feedback, "error", "请至少选择 1 个商品后开始分析。");
      updatePreviewSelectionState();
      return;
    }
    confirmButton.disabled = true;
    confirmButton.textContent = "正在创建…";
    try {
      const result = await KeywordToolApi.createVocTask(session, workspaceId, {
        asins: selectedValues,
        site: draft.site,
        targetReviewCount: draft.targetReviewCount,
        reviewScope: draft.reviewScope
      });
      form.reset();
      document.querySelector('[name="target_review_count"][value="100"]').checked = true;
      document.querySelector('[name="review_scope"][value="含变体评论"]').checked = true;
      replaceAsinValues([]);
      syncSitePicker();
      updateAsinState();
      resetPreview();
      KeywordToolApp.setMessage(feedback, "success", "任务已创建并进入排队。预计时间将只依据真实进度、队列和历史阶段耗时更新。" );
      await refreshTasks();
    } catch (error) {
      KeywordToolApp.setMessage(feedback, "error", KeywordToolCore.friendlyDataError(error, "创建任务失败，请稍后重试。"));
      confirmButton.disabled = false;
      confirmButton.textContent = "确认并创建任务";
    }
  });

  previewSelectAll.addEventListener("change", () => {
    previewSelection = previewSelectAll.checked
      ? new Set(selectablePreviewProducts().map((product) => product.asin))
      : new Set();
    renderPreview(previewProducts, selectedDraft());
  });

  function closePreview() {
    resetPreview();
    asinEntry.focus();
  }

  previewClear.addEventListener("click", () => {
    previewSelection = new Set();
    renderPreview(previewProducts, selectedDraft());
  });
  previewClose.addEventListener("click", closePreview);
  previewCancel.addEventListener("click", closePreview);
  preview.querySelector("[data-preview-close]").addEventListener("click", closePreview);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !preview.hidden) closePreview();
  });

  refreshButton.addEventListener("click", refreshTasks);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshTasks();
  });
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") refreshTasks();
  }, REFRESH_INTERVAL_MS);
  window.addEventListener("pagehide", () => window.clearInterval(refreshTimer), { once: true });
  await refreshTasks();
})();
