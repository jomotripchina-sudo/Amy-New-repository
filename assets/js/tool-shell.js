(function initializeToolShell() {
  "use strict";

  const workspace = new URLSearchParams(window.location.search).get("workspace");
  if (!workspace) return;
  document.querySelectorAll("[data-workspace-link]").forEach((link) => {
    const target = new URL(link.getAttribute("href"), window.location.href);
    target.searchParams.set("workspace", workspace);
    link.href = `${target.pathname}${target.search}`;
  });
})();
