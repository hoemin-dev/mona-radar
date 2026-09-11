// Vendored from mona-radar-market; see provenance.json.
import { createHash } from "node:crypto";
import { stableStringify } from "../storage/raw-persistence.js";
const BID_NOTICE_SERVICE = "BidPublicInfoService";
const BID_NOTICE_OPERATION = "getBidPblancListInfoThngPPSSrch";
function stringField(raw, field, warnings, required = false) {
  const value = raw[field];
  if (typeof value !== "string") {
    if (required) throw new Error(`${field} must be a non-empty string`);
    if (value !== void 0 && value !== null) warnings.push({ field, code: "invalid_type" });
    return null;
  }
  if (value === "") {
    if (required) throw new Error(`${field} must be a non-empty string`);
    return null;
  }
  return value;
}
function dateField(raw, field, warnings) {
  const value = stringField(raw, field, warnings);
  if (value === null) return { raw: null, local: null };
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(value);
  if (!match) {
    warnings.push({ field, code: "invalid_datetime" });
    return { raw: value, local: null };
  }
  const [, year, month, day, hour, minute, seconds = "00"] = match;
  const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(seconds)));
  const canonical = `${year}-${month}-${day}T${hour}:${minute}:${seconds}`;
  if (check.toISOString().slice(0, 19) !== `${year}-${month}-${day}T${hour}:${minute}:${seconds}`) {
    warnings.push({ field, code: "invalid_datetime" });
    return { raw: value, local: null };
  }
  return { raw: value, local: canonical };
}
function integerField(raw, field, warnings) {
  const value = stringField(raw, field, warnings);
  if (value === null) return null;
  if (!/^\d+$/u.test(value)) {
    warnings.push({ field, code: "invalid_integer" });
    return null;
  }
  const parsed = BigInt(value);
  if (parsed > 9223372036854775807n) {
    warnings.push({ field, code: "invalid_integer" });
    return null;
  }
  return parsed;
}
function flagField(raw, field, warnings) {
  const value = stringField(raw, field, warnings);
  if (value !== null && value !== "Y" && value !== "N") warnings.push({ field, code: "unexpected_flag" });
  return value;
}
function semanticJson(candidate) {
  return stableStringify(Object.fromEntries(Object.entries(candidate).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value])));
}
function normalizeBidNotice(raw) {
  const warnings = [];
  const noticePosted = dateField(raw, "bidNtceDt", warnings);
  const bidBegin = dateField(raw, "bidBeginDt", warnings);
  const bidClose = dateField(raw, "bidClseDt", warnings);
  const opening = dateField(raw, "opengDt", warnings);
  const registered = dateField(raw, "rgstDt", warnings);
  const changed = dateField(raw, "chgDt", warnings);
  const candidate = {
    bidNtceNo: stringField(raw, "bidNtceNo", warnings, true),
    bidNtceOrd: stringField(raw, "bidNtceOrd", warnings, true),
    bidNtceName: stringField(raw, "bidNtceNm", warnings),
    noticeKindName: stringField(raw, "ntceKindNm", warnings),
    registrationTypeName: stringField(raw, "rgstTyNm", warnings),
    referenceNo: stringField(raw, "refNo", warnings),
    noticeInstitutionCode: stringField(raw, "ntceInsttCd", warnings),
    noticeInstitutionName: stringField(raw, "ntceInsttNm", warnings),
    demandInstitutionCode: stringField(raw, "dminsttCd", warnings),
    demandInstitutionName: stringField(raw, "dminsttNm", warnings),
    contractMethodName: stringField(raw, "cntrctCnclsMthdNm", warnings),
    bidMethodName: stringField(raw, "bidMethdNm", warnings),
    awardMethodCode: stringField(raw, "sucsfbidMthdCd", warnings),
    awardMethodName: stringField(raw, "sucsfbidMthdNm", warnings),
    noticePostedRaw: noticePosted.raw,
    noticePostedLocal: noticePosted.local,
    bidBeginRaw: bidBegin.raw,
    bidBeginLocal: bidBegin.local,
    bidCloseRaw: bidClose.raw,
    bidCloseLocal: bidClose.local,
    openingRaw: opening.raw,
    openingLocal: opening.local,
    registeredRaw: registered.raw,
    registeredLocal: registered.local,
    changedRaw: changed.raw,
    changedLocal: changed.local,
    detailedProductClassNo: stringField(raw, "dtilPrdctClsfcNo", warnings),
    detailedProductClassName: stringField(raw, "dtilPrdctClsfcNoNm", warnings),
    productQuantity: stringField(raw, "prdctQty", warnings),
    productUnit: stringField(raw, "prdctUnit", warnings),
    productUnitPrice: integerField(raw, "prdctUprc", warnings),
    productSpecification: stringField(raw, "prdctSpecNm", warnings),
    purchaseProductListRaw: stringField(raw, "purchsObjPrdctList", warnings),
    allocatedBudgetAmount: integerField(raw, "asignBdgtAmt", warnings),
    estimatedPrice: integerField(raw, "presmptPrce", warnings),
    vatAmount: integerField(raw, "VAT", warnings),
    industryVatAmount: integerField(raw, "indutyVAT", warnings),
    internationalBidYn: flagField(raw, "intrbidYn", warnings),
    reNoticeYn: flagField(raw, "reNtceYn", warnings),
    rebidPermittedYn: flagField(raw, "rbidPermsnYn", warnings),
    manufactureYn: flagField(raw, "mnfctYn", warnings),
    designatedCompetitionYn: flagField(raw, "dsgntCmptYn", warnings),
    productClassLimitYn: flagField(raw, "prdctClsfcLmtYn", warnings),
    noticeUrl: stringField(raw, "bidNtceUrl", warnings),
    noticeDetailUrl: stringField(raw, "bidNtceDtlUrl", warnings),
    standardNoticeDocumentUrl: stringField(raw, "stdNtceDocUrl", warnings)
  };
  const semanticStateJson = semanticJson(candidate);
  return {
    candidate,
    warnings,
    semanticStateJson,
    semanticRowHash: createHash("sha256").update(semanticStateJson).digest("hex")
  };
}
export {
  BID_NOTICE_OPERATION,
  BID_NOTICE_SERVICE,
  normalizeBidNotice
};
