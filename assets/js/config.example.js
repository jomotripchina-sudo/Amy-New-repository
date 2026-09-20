window.KEYWORD_TOOL_CONFIG = Object.freeze({
  supabaseUrl: "__SUPABASE_URL__",
  supabasePublishableKey: "__SUPABASE_PUBLISHABLE_KEY__",
  apiBaseUrl: "__API_BASE_URL__",
  taskTable: "keyword_tasks",
  inboxBucket: "keyword-report-inbox",
  maxUploadBytes: 20 * 1024 * 1024,
  refreshIntervalMs: 30_000,
  reportAllowedHosts: Object.freeze([
    ".aliyuncs.com",
    "__SUPABASE_PROJECT_REF__.supabase.co"
  ])
});
