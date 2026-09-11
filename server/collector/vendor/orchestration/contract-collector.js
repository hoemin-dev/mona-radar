// Vendored from mona-radar-market; see provenance.json.
import { discoverContractRanges } from "./contract-discovery-ranges.js";
import { KonepsError } from "../koneps/errors.js";
import { assertContractQuota, ContractQuotaPaused } from "./contract-quota.js";
import { MissingContractIdentityError } from "../normalization/contract.js";
import { storedContractDiscovery } from "./contract-discovery-cache.js";
import { pageGuard } from "./pagination.js";
import { CATALOG_ITEM_SEARCH_OPERATION, CONTRACT_DETAIL_OPERATION, CONTRACT_SEARCH_OPERATION } from "../koneps/endpoints.js";
import { normalizeEvidenceBackedContractResults } from "../normalization/contract-repository.js";
import { cachedCatalogResolution, storeCatalogResolution, upsertContractHeader, upsertContractItem } from "../normalization/contract-source-derived.js";
import { persistFailedCall, persistRawPage, startCollectorRun, startOperationRun } from "../storage/raw-persistence.js";
function save(db, operationRunId, response, operation, params, parserVersion) {
  return persistRawPage(db, { operationRunId, service: operation.service, operation: operation.path, requestedAt: response.metadata.startedAt, completedAt: response.receivedAt, durationMs: response.durationMs, httpStatus: response.status, resultCode: response.envelope.resultCode, resultMsg: response.envelope.resultMsg, pageNo: Number(params.pageNo), numOfRows: Number(params.numOfRows), totalCount: response.envelope.totalCount ?? 0, requestMetadata: params, requestUrl: response.metadata.redactedUrl, responseBytes: response.bodyBytes, contentType: response.headers["content-type"], encoding: "utf-8", parsedJson: response.parsedJson, parserVersion });
}
async function request(db, client, operationRunId, operation, params) {
  if (operation.service === "CntrctInfoService") assertContractQuota(db);
  try {
    return await client.request(operation, params);
  } catch (error) {
    if (error instanceof KonepsError && error.metadata) {
      const m = error.metadata;
      persistFailedCall(db, { operationRunId, service: operation.service, operation: operation.path, requestedAt: m.startedAt, completedAt: m.finishedAt, durationMs: m.durationMs, httpStatus: m.httpStatus, resultCode: m.resultCode, resultMsg: m.resultMsg, pageNo: params.pageNo, numOfRows: params.numOfRows, requestMetadata: { ...params, responseHeaders: m.responseHeaders }, requestUrl: m.redactedUrl, errorCategory: error.category, parseStatus: "not_attempted", responseBytes: m.responseBody === void 0 ? void 0 : new TextEncoder().encode(m.responseBody), contentType: m.responseHeaders?.["content-type"] });
      if (m.httpStatus === 429) {
        if (operation.service === "CntrctInfoService") assertContractQuota(db);
        throw new ContractQuotaPaused(new Date(Date.parse(m.finishedAt) + 864e5).toISOString(), "HTTP_429");
      }
    }
    throw error;
  }
}
async function collectContractRange(o) {
  if (o.targetCodes.some((code) => !/^(?:\d{8}|\d{10})$/.test(code))) throw new Error("INVALID_CONTRACT_TARGET");
  const now = () => (/* @__PURE__ */ new Date()).toISOString(), parserVersion = "contract-source-v3", runId = startCollectorRun(o.database, { mode: "period", requestedRangeStart: o.range.start, requestedRangeEnd: o.range.end, startedAt: now(), appVersion: "0.1.0", parserVersion });
  const discoveryRun = startOperationRun(o.database, { runId, service: CONTRACT_SEARCH_OPERATION.service, operation: CONTRACT_SEARCH_OPERATION.path, queryBasis: JSON.stringify({ purpose: "contract-discovery", requestedTarget: o.requestedTarget ?? o.targetCodes.map((code) => ({ code })), queryScope: { codes: [...new Set(o.targetCodes.map((c) => c.slice(0, 8)))], name: o.discoveryName } }), effectiveRangeStart: o.range.start, effectiveRangeEnd: o.range.end, startedAt: now() }), detailRun = startOperationRun(o.database, { runId, service: CONTRACT_DETAIL_OPERATION.service, operation: CONTRACT_DETAIL_OPERATION.path, queryBasis: "untyCntrctNo+prdctClsfcNo:8-digit-target", startedAt: now() });
  const catalogRun = o.targetCodes.some((c) => c.length === 10) ? startOperationRun(o.database, { runId, service: CATALOG_ITEM_SEARCH_OPERATION.service, operation: CATALOG_ITEM_SEARCH_OPERATION.path, queryBasis: "product-identification:exact-child-verification", startedAt: now() }) : null;
  const operationRuns = [discoveryRun, detailRun, ...catalogRun ? [catalogRun] : []];
  let page = 1, total = 0, processed = 0;
  const skipped = [];
  const normalize = (rawId, headerId) => {
    try {
      normalizeEvidenceBackedContractResults(o.database, rawId, headerId, o.targetCodes, now(), runId);
      return true;
    } catch (error) {
      if (!(error instanceof MissingContractIdentityError)) throw error;
      const header = o.database.prepare("SELECT unty_cntrct_no unty FROM contract_header WHERE contract_header_id=?").get(headerId);
      const skip = { rawId, untyCntrctNo: header.unty, reason: error.reason };
      skipped.push(skip);
      const summary = JSON.stringify({ canonicalSkips: skipped });
      o.database.prepare("UPDATE collector_operation_run SET deferred_count=?,error_summary=? WHERE operation_run_id=?").run(skipped.length, summary, discoveryRun);
      o.database.prepare("UPDATE collector_run SET error_summary=? WHERE run_id=?").run(summary, runId);
      console.warn(JSON.stringify({ type: "CONTRACT_CANONICAL_SKIPPED", runId, ...skip }));
      return false;
    }
  };
  const refreshed = /* @__PURE__ */ new Set();
  const discovery = discoverContractRanges(o.range, async (range, page2) => {
    const cached = o.reuseDiscovery ? storedContractDiscovery(o.database, o.discoveryName, range) : void 0;
    if (cached) return { rawItemIds: cached.rawItemIds, actualItemCount: cached.total, total: cached.total, responseSha256: "cached" };
    const date = (v) => v.slice(0, 10).replaceAll("-", "");
    const params = { pageNo: page2, numOfRows: 100, type: "json", inqryDiv: "1", inqryBgnDate: date(range.start), inqryEndDate: date(range.end), prdctClsfcNoNm: o.discoveryName };
    const response = await request(o.database, o.client, discoveryRun, CONTRACT_SEARCH_OPERATION, params);
    return { ...save(o.database, discoveryRun, response, CONTRACT_SEARCH_OPERATION, params, parserVersion), total: response.envelope.totalCount };
  }, o.isCancelled, o.timeoutFallback);
  try {
    for await (const saved of discovery) {
      total += saved.total;
      for (const rawId of saved.rawItemIds) {
        const at2 = now(), headerId = upsertContractHeader(o.database, rawId, at2), state = o.database.prepare("SELECT status FROM contract_detail_state WHERE contract_header_id=?").get(headerId);
        if (state.status !== "SUCCESS" || o.refreshDetails && !refreshed.has(headerId)) {
          await enrich(o.database, o.client, detailRun, headerId, o.targetCodes.map((code) => code.slice(0, 8)), parserVersion, now, !o.refreshDetails);
          refreshed.add(headerId);
        }
        const normalized = normalize(rawId, headerId);
        if (catalogRun && normalized) {
          await verifyChildren(o.database, o.client, catalogRun, headerId, o.targetCodes, parserVersion, now);
          normalize(rawId, headerId);
        }
        processed++;
      }
      o.onProgress?.({ page, totalCount: total, processed });
      page++;
    }
    const status = o.isCancelled?.() ? "cancelled" : "succeeded", at = now();
    for (const id of operationRuns) o.database.prepare("UPDATE collector_operation_run SET status=?,completed_at=? WHERE operation_run_id=?").run(status, at, id);
    o.database.prepare("UPDATE collector_run SET status=?,completed_at=? WHERE run_id=?").run(status, at, runId);
    return { runId, status, total, processed, skipped };
  } catch (error) {
    const at = now();
    for (const id of operationRuns) o.database.prepare("UPDATE collector_operation_run SET status=?,completed_at=?,error_summary=? WHERE operation_run_id=? AND status='running'").run(error instanceof ContractQuotaPaused ? "cancelled" : "failed", at, JSON.stringify({ error: error instanceof ContractQuotaPaused ? JSON.parse(error.message) : "redacted contract collection error", canonicalSkips: skipped }), id);
    o.database.prepare("UPDATE collector_run SET status=?,completed_at=?,error_summary=? WHERE run_id=?").run(error instanceof ContractQuotaPaused ? "cancelled" : "failed", at, JSON.stringify({ error: error instanceof ContractQuotaPaused ? JSON.parse(error.message) : "redacted contract collection error", canonicalSkips: skipped }), runId);
    throw error;
  }
}
async function enrich(db, client, detailRun, headerId, targetCodes, parserVersion, now, reusePages = true) {
  const header = db.prepare("SELECT unty_cntrct_no unty FROM contract_header WHERE contract_header_id=?").get(headerId);
  db.prepare("UPDATE contract_detail_state SET status='RUNNING',attempts=attempts+1,last_attempt_at=?,last_error_summary=NULL,updated_at=? WHERE contract_header_id=?").run(now(), now(), headerId);
  try {
    let page = 1, seen = 0, total = 0;
    const guard = pageGuard();
    do {
      const params = { pageNo: page, numOfRows: 100, type: "json", inqryDiv: "2", untyCntrctNo: header.unty }, cached = reusePages ? storedDetailPage(db, params) : void 0, response = cached ? void 0 : await request(db, client, detailRun, CONTRACT_DETAIL_OPERATION, params), saved = cached ?? save(db, detailRun, response, CONTRACT_DETAIL_OPERATION, params, parserVersion);
      total = guard(cached ? cached.total : response.envelope.totalCount, saved.actualItemCount, seen, page, saved.responseSha256);
      for (const rawId of saved.rawItemIds) {
        upsertContractItem(db, headerId, rawId, targetCodes, now());
        seen++;
      }
      page++;
    } while (seen < total);
    db.prepare("UPDATE contract_detail_state SET status='SUCCESS',completed_at=?,updated_at=? WHERE contract_header_id=?").run(now(), now(), headerId);
  } catch (error) {
    db.prepare("UPDATE contract_detail_state SET status=?,last_error_summary=?,updated_at=? WHERE contract_header_id=?").run(error instanceof ContractQuotaPaused ? "PENDING" : "FAILED", error instanceof ContractQuotaPaused ? error.message : "contract detail lookup failed", now(), headerId);
    throw error;
  }
}
async function verifyChildren(db, client, operationRun, headerId, targets, parserVersion, now) {
  const rows = db.prepare("SELECT DISTINCT product_identification_no productId,product_class_no parent,json_extract(raw_json,'$.dtilPrdctClsfcNo') detail FROM contract_item WHERE contract_header_id=?").all(headerId);
  for (const row of rows) {
    if (!row.productId || !/^\d{8}$/.test(row.productId) || row.detail && /^\d{10}$/.test(row.detail) || !targets.some((t) => t.length === 10 && t.slice(0, 8) === row.parent)) continue;
    const cached = cachedCatalogResolution(db, row.productId);
    if (cached && cached.status !== "FAILED") continue;
    try {
      const params = { pageNo: 1, numOfRows: 100, prdctIdntNo: row.productId }, response = await request(db, client, operationRun, CATALOG_ITEM_SEARCH_OPERATION, params);
      const saved = save(db, operationRun, response, CATALOG_ITEM_SEARCH_OPERATION, params, parserVersion);
      const matches = saved.rawItemIds.flatMap((id) => {
        const raw = JSON.parse(db.prepare("SELECT canonical_json FROM api_raw_item WHERE raw_item_id=?").get(id).canonical_json);
        const code = String(raw.dtilPrdctClsfcNo ?? "");
        return String(raw.prdctIdntNo ?? "") === row.productId && /^\d{10}$/.test(code) ? [{ id, code }] : [];
      });
      if ((response.envelope.totalCount ?? saved.actualItemCount) > saved.actualItemCount) throw new Error("CONTRACT_CATALOG_INCOMPLETE");
      const codes = new Set(matches.map((m) => m.code));
      if (codes.size === 1) storeCatalogResolution(db, row.productId, { status: "FOUND", detailedProductClassNo: matches[0].code }, matches[0].id, now());
      else storeCatalogResolution(db, row.productId, { status: "NOT_FOUND" }, null, now());
    } catch (error) {
      storeCatalogResolution(db, row.productId, { status: "FAILED" }, null, now());
      throw error;
    }
  }
}
function storedDetailPage(db, params) {
  const c = db.prepare(`SELECT c.call_id,c.total_count,c.actual_item_count,b.response_sha256 FROM api_call c
 JOIN api_response_blob b USING(response_blob_id)
 WHERE c.service='CntrctInfoService' AND c.operation='getCntrctInfoListThngDetail' AND c.status='succeeded' AND c.parse_status='succeeded'
 AND json_extract(c.request_metadata_json,'$.untyCntrctNo')=? AND c.page_no=? AND c.num_of_rows=?
 ORDER BY c.requested_at DESC LIMIT 1`).get(params.untyCntrctNo, params.pageNo, params.numOfRows);
  if (!c) return;
  const ids = db.prepare("SELECT raw_item_id FROM raw_item_observation WHERE call_id=? ORDER BY item_ordinal").all(c.call_id).map((r) => r.raw_item_id);
  if (ids.length !== c.actual_item_count) return;
  return { rawItemIds: ids, total: c.total_count, actualItemCount: c.actual_item_count, responseSha256: c.response_sha256 };
}
export {
  collectContractRange
};
