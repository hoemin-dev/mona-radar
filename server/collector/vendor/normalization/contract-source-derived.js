// Vendored from mona-radar-market; see provenance.json.
import { createHash } from "node:crypto";
const value = (raw, name) => {
  const found = raw[name];
  return typeof found === "string" && found.trim() !== "" ? found.trim() : null;
};
function upsertContractHeader(db, rawItemId, at) {
  const row = db.prepare("SELECT canonical_json FROM api_raw_item WHERE raw_item_id=? AND service='CntrctInfoService' AND operation='getCntrctInfoListThngPPSSrch'").get(rawItemId);
  if (!row) throw new Error("RAW item is not a contract discovery row");
  const raw = JSON.parse(row.canonical_json);
  const unty = value(raw, "untyCntrctNo");
  if (!unty) throw new Error("untyCntrctNo is required for source-derived contract collection");
  db.prepare(`INSERT INTO contract_header(unty_cntrct_no,decision_contract_no,contract_ref_no,source_raw_item_id,source_operation,raw_json,first_seen_at,updated_at)
    VALUES(?,?,?,?,'getCntrctInfoListThngPPSSrch',?,?,?) ON CONFLICT(unty_cntrct_no) DO UPDATE SET
    decision_contract_no=COALESCE(excluded.decision_contract_no,contract_header.decision_contract_no),
    contract_ref_no=COALESCE(excluded.contract_ref_no,contract_header.contract_ref_no),source_raw_item_id=excluded.source_raw_item_id,
    raw_json=excluded.raw_json,updated_at=excluded.updated_at`).run(unty, value(raw, "dcsnCntrctNo"), value(raw, "cntrctRefNo"), rawItemId, row.canonical_json, at, at);
  const id = db.prepare("SELECT contract_header_id id FROM contract_header WHERE unty_cntrct_no=?").get(unty).id;
  db.prepare("INSERT INTO contract_detail_state(contract_header_id,status,updated_at) VALUES(?,'PENDING',?) ON CONFLICT(contract_header_id) DO NOTHING").run(id, at);
  return id;
}
function cachedCatalogResolution(db, productId) {
  const direct = db.prepare("SELECT detailed_product_class_no code,lookup_status status FROM contract_catalog_cache WHERE product_identification_no=?").get(productId);
  if (direct) return direct.status === "FOUND" && direct.code ? { status: "FOUND", detailedProductClassNo: direct.code } : { status: direct.status };
  const existing = db.prepare("SELECT detailed_product_class_no code FROM catalog_item_category WHERE prdct_idnt_no=?").get(productId);
  return existing ? { status: "FOUND", detailedProductClassNo: existing.code } : void 0;
}
function storeCatalogResolution(db, productId, resolution, rawItemId, at) {
  const code = resolution.status === "FOUND" ? resolution.detailedProductClassNo : null;
  db.prepare(`INSERT INTO contract_catalog_cache(product_identification_no,detailed_product_class_no,lookup_status,source_raw_item_id,last_error_summary,observed_at,updated_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(product_identification_no) DO UPDATE SET detailed_product_class_no=excluded.detailed_product_class_no,
    lookup_status=excluded.lookup_status,source_raw_item_id=excluded.source_raw_item_id,last_error_summary=excluded.last_error_summary,
    observed_at=excluded.observed_at,updated_at=excluded.updated_at`).run(productId, code, resolution.status, rawItemId, resolution.status === "FAILED" ? "catalog lookup failed" : null, at, at);
}
function upsertContractItem(db, headerId, rawItemId, contractTargetCodes, at) {
  const row = db.prepare("SELECT canonical_json FROM api_raw_item WHERE raw_item_id=? AND service='CntrctInfoService' AND operation='getCntrctInfoListThngDetail'").get(rawItemId);
  if (!row) throw new Error("RAW item is not a contract detail row");
  const raw = JSON.parse(row.canonical_json);
  const productId = value(raw, "prdctIdntNo");
  const productClassNo = value(raw, "prdctClsfcNo");
  if (contractTargetCodes.some((code2) => !/^\d{8}$/.test(code2))) throw new Error("INVALID_CONTRACT_TARGET");
  const isTarget = productClassNo !== null && contractTargetCodes.includes(productClassNo);
  const code = isTarget ? productClassNo : null;
  const status = isTarget ? "RESOLVED_TARGET" : "RESOLVED_NON_TARGET";
  const reason = isTarget ? "OFFICIAL_CONTRACT_DETAIL_CLASS_TARGET" : "OFFICIAL_CONTRACT_DETAIL_CLASS_NON_TARGET";
  const fingerprint = createHash("sha256").update(row.canonical_json).digest("hex");
  const header = db.prepare("SELECT unty_cntrct_no FROM contract_header WHERE contract_header_id=?").get(headerId);
  const result = db.prepare(`INSERT INTO contract_item(contract_header_id,source_fingerprint,unty_cntrct_no,decision_contract_no,contract_ref_no,product_class_no,product_identification_no,product_class_name,korean_product_name,quantity,unit_price_amount,product_amount,target_detailed_product_class_no,resolution_status,resolution_reason,source_raw_item_id,source_operation,raw_json,first_seen_at,updated_at,delivery_day_count,delivery_deadline,delivery_condition_code,delivery_condition_name,origin_code,origin_name,registered_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'getCntrctInfoListThngDetail',?,?,?,?,?,?,?,?,?,?) ON CONFLICT(contract_header_id,source_fingerprint) DO UPDATE SET
    target_detailed_product_class_no=excluded.target_detailed_product_class_no,resolution_status=excluded.resolution_status,resolution_reason=excluded.resolution_reason,
    source_raw_item_id=excluded.source_raw_item_id,raw_json=excluded.raw_json,updated_at=excluded.updated_at,
    delivery_day_count=excluded.delivery_day_count,delivery_deadline=excluded.delivery_deadline,delivery_condition_code=excluded.delivery_condition_code,
    delivery_condition_name=excluded.delivery_condition_name,origin_code=excluded.origin_code,origin_name=excluded.origin_name,registered_at=excluded.registered_at RETURNING contract_item_id`).get(headerId, fingerprint, value(raw, "untyCntrctNo") ?? header.unty_cntrct_no, value(raw, "dcsnCntrctNo"), value(raw, "cntrctRefNo"), productClassNo, productId, value(raw, "prdctClsfcNoNm"), value(raw, "krnPrdctNm"), value(raw, "prdctQty"), value(raw, "qtyUprcAmt"), value(raw, "prdctAmt"), code, status, reason, rawItemId, row.canonical_json, at, at, value(raw, "dlvrDaynum"), value(raw, "dlvrTmlmt"), value(raw, "dlvryCndtnCd"), value(raw, "dlvryCndtnNm"), value(raw, "orgplceCd"), value(raw, "orgplceNm"), value(raw, "rgstDt"));
  return result.contract_item_id;
}
export {
  cachedCatalogResolution,
  storeCatalogResolution,
  upsertContractHeader,
  upsertContractItem
};
