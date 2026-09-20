const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./assets/voc-core.js");

test("parses, normalizes and deduplicates ASIN input", () => {
  assert.deepEqual(core.parseAsins("b09v366bdy + B0991Q94KP"), ["B09V366BDY", "B0991Q94KP"]);
});

test("rejects duplicates and more than ten ASINs", () => {
  assert.equal(core.validateAsins("B09V366BDY+B09V366BDY").ok, false);
  const eleven = Array.from({ length: 11 }, (_, index) => `B0000000${String(index).padStart(2, "0")}`).join("+");
  assert.equal(core.validateAsins(eleven).ok, false);
});

test("validates the four review count choices and two scope choices", () => {
  assert.equal(core.validateDraft({ asins: "B09V366BDY", site: "US", targetReviewCount: 300, reviewScope: "含变体评论" }).ok, true);
  assert.equal(core.validateDraft({ asins: "B09V366BDY", site: "US", targetReviewCount: 250, reviewScope: "含变体评论" }).ok, false);
  assert.equal(core.validateDraft({ asins: "B09V366BDY", site: "US", targetReviewCount: 100, reviewScope: "未知" }).ok, false);
});

test("accepts only the four supported VOC sites", () => {
  for (const site of ["US", "CA", "GB", "DE"]) {
    assert.equal(core.validateDraft({ asins: "B09V366BDY", site, targetReviewCount: 100, reviewScope: "含变体评论" }).ok, true);
  }
  assert.equal(core.validateDraft({ asins: "B09V366BDY", site: "FR", targetReviewCount: 100, reviewScope: "含变体评论" }).ok, false);
});

test("maps every task status and shows module 0 progress", () => {
  for (const status of core.STATUSES) assert.match(core.statusClass(status), /^voc-status--/);
  assert.equal(core.progressLabel({ status: "完成", annotated_count: 0, annotation_total: 0 }), "本段空跑完成");
  assert.equal(core.progressLabel({ status: "标注中", annotated_count: 35, annotation_total: 100 }), "35 / 100");
});

test("uses actual timestamps and annotation progress for ETA without fixed copy", () => {
  const completed = {
    id: "completed", status: "完成", created_at: "2026-09-18T00:00:00.000Z",
    started_at: "2026-09-18T00:00:00.000Z", annotation_started_at: "2026-09-18T00:10:00.000Z",
    report_started_at: "2026-09-18T00:30:00.000Z", completed_at: "2026-09-18T00:35:00.000Z"
  };
  const annotating = {
    id: "working", status: "标注中", created_at: "2026-09-18T01:00:00.000Z",
    annotation_started_at: "2026-09-18T01:00:00.000Z", annotated_count: 50, annotation_total: 100
  };
  const eta = core.estimateEta(annotating, [completed, annotating], Date.parse("2026-09-18T01:10:00.000Z"));
  assert.equal(eta.available, true);
  assert.equal(eta.ms, 600000);
  assert.match(eta.label, /10 分钟/);
  const queued = { id: "queued", status: "排队中", created_at: "2026-09-18T02:00:00.000Z" };
  assert.match(core.estimateEta(queued, [completed, queued]).label, /前方 0 个任务/);
  assert.equal(core.estimateEta({ status: "抓评论" }, [], Date.now()).label, "正在积累测算数据");
});
