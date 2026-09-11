// Vendored from mona-radar-market; see provenance.json.
import { detailedQueries } from "../koneps/target-query.js";
import { pageGuard } from "./pagination.js";
import { recordTargetMembership } from "../storage/collection-target.js";
import { AWARD_SEARCH_OPERATION } from "../koneps/endpoints.js";
import { AWARD_OPERATION, AWARD_SERVICE } from "../normalization/award.js";
import { normalizeAwardRawItem } from "../normalization/award-repository.js";
import { persistRawPage, startCollectorRun, startOperationRun } from "../storage/raw-persistence.js";
function nextAwardEmptyPageCount(previous, actualItemCount, processed, total) {
  const count = actualItemCount === 0 && processed < total ? previous + 1 : 0;
  if (count >= 2) throw new Error("AWARD_PAGINATION_STALLED: repeated empty pages before totalCount was reached");
  return count;
}
async function collectAwardRange(o) {
  if (o.target.length === 8) {
    const codes = await detailedQueries(o.target, o.client);
    let aggregate;
    for (const code of codes) {
      const result = await collectAwardRange({ ...o, target: code, collectionTargetCode: o.target });
      aggregate = { ...result, total: (aggregate?.total ?? 0) + result.total, processed: (aggregate?.processed ?? 0) + result.processed };
      if (result.status !== "succeeded") break;
    }
    return aggregate;
  }
  const at = () => (/* @__PURE__ */ new Date()).toISOString();
  const runId = startCollectorRun(o.database, { mode: "period", requestedRangeStart: o.range.start, requestedRangeEnd: o.range.end, startedAt: at(), appVersion: "0.1.0", parserVersion: "award-v1" });
  const operationRunId = startOperationRun(o.database, { runId, service: AWARD_SERVICE, operation: AWARD_OPERATION, queryBasis: `opening_datetime+dtilPrdctClsfcNo:${o.target}`, effectiveRangeStart: o.range.start, effectiveRangeEnd: o.range.end, startedAt: at() });
  o.database.prepare("UPDATE collector_run SET effective_range_start=?,effective_range_end=? WHERE run_id=?").run(o.range.start, o.range.end, runId);
  let page = 1, total = 0, processed = 0, emptyPages = 0;
  const guard = pageGuard();
  const counts = { inserted: 0, updated: 0, unchanged: 0 };
  try {
    do {
      if (o.isCancelled?.()) break;
      const q = (v) => v.replace(/[-:T]/gu, "").slice(0, 12);
      const params = { pageNo: page, numOfRows: 100, type: "json", inqryDiv: "2", inqryBgnDt: q(o.range.start), inqryEndDt: q(o.range.end), dtilPrdctClsfcNo: o.target };
      const response = await o.client.request(AWARD_SEARCH_OPERATION, params);
      const saved = persistAwardPage(o.database, operationRunId, response, params);
      total = guard(response.envelope.totalCount, saved.actualItemCount, processed, page, saved.responseSha256);
      for (const rawId of saved.rawItemIds) {
        const result = normalizeAwardRawItem(o.database, rawId, o.target, at());
        recordTargetMembership(o.database, "AWARD", result.awardResultId, o.collectionTargetCode ?? o.target, runId);
        counts[result.action] += 1;
        processed += 1;
      }
      emptyPages = nextAwardEmptyPageCount(emptyPages, saved.actualItemCount, processed, total);
      o.onProgress?.({ page, totalCount: total, processed });
      page += 1;
    } while (processed < total);
    const cancelled = o.isCancelled?.() ?? false;
    const status = cancelled ? "cancelled" : "succeeded";
    o.database.prepare("UPDATE collector_operation_run SET status=?,completed_at=?,inserted_count=?,updated_count=?,unchanged_count=? WHERE operation_run_id=?").run(status, at(), counts.inserted, counts.updated, counts.unchanged, operationRunId);
    o.database.prepare("UPDATE collector_run SET status=?,completed_at=?,inserted_count=?,updated_count=?,unchanged_count=? WHERE run_id=?").run(status, at(), counts.inserted, counts.updated, counts.unchanged, runId);
    return { runId, status, total, processed, counts };
  } catch (error) {
    o.database.prepare("UPDATE collector_operation_run SET status='failed',completed_at=?,error_summary='redacted award collection error' WHERE operation_run_id=?").run(at(), operationRunId);
    o.database.prepare("UPDATE collector_run SET status='failed',completed_at=?,error_summary='redacted award collection error' WHERE run_id=?").run(at(), runId);
    throw error;
  }
}
function persistAwardPage(db, operationRunId, response, params) {
  return persistRawPage(db, { operationRunId, service: AWARD_SERVICE, operation: AWARD_OPERATION, requestedAt: response.metadata.startedAt, completedAt: response.receivedAt, durationMs: response.durationMs, httpStatus: response.status, resultCode: response.envelope.resultCode, resultMsg: response.envelope.resultMsg, pageNo: Number(params.pageNo), numOfRows: Number(params.numOfRows), totalCount: response.envelope.totalCount ?? 0, requestMetadata: params, requestUrl: response.metadata.redactedUrl, responseBytes: response.bodyBytes, contentType: response.headers["content-type"], encoding: "utf-8", parsedJson: response.parsedJson, parserVersion: "award-v1" });
}
export {
  collectAwardRange,
  nextAwardEmptyPageCount
};
