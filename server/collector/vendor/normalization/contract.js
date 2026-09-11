// Vendored from mona-radar-market; see provenance.json.
import { createHash } from "node:crypto";
import { stableStringify } from "../storage/raw-persistence.js";
const CONTRACT_SERVICE = "CntrctInfoService", CONTRACT_OPERATION = "getCntrctInfoListThngPPSSrch";
const text = (raw, field) => typeof raw[field] === "string" && raw[field].trim() !== "" ? raw[field].trim() : null;
const amount = (raw, field) => {
  const value = text(raw, field)?.replaceAll(",", "");
  return value && /^\d+$/.test(value) && BigInt(value) <= 9223372036854775807n ? BigInt(value) : null;
};
const entries = (value) => typeof value === "string" && value.trim() && value.trim() !== "[]" ? value.trim().replace(/^\[|\]$/gu, "").split(/\]\s*,?\s*\[/gu).map((x) => x.trim()).filter(Boolean) : [];
const optional = (value) => value?.trim() || null;
function parseContractCorporations(value) {
  return entries(value).map((sourceValue) => {
    const p = sourceValue.split("^");
    return { sequenceNo: /^\d+$/u.test(p[0] ?? "") ? Number(p[0]) : null, roleName: optional(p[1]), participationTypeName: optional(p[2]), corporationName: optional(p[3]) ?? "", representativeName: optional(p[4]), countryName: optional(p[5]), shareRate: optional(p[6]), displayName: optional(p[7]), extraValue: optional(p[8]), businessRegistrationNo: optional(p[9]), sourceValue };
  }).filter((x) => x.corporationName !== "");
}
function parseContractDemandInstitutions(value) {
  return entries(value).map((sourceValue) => {
    const p = sourceValue.split("^");
    return { sequenceNo: /^\d+$/u.test(p[0] ?? "") ? Number(p[0]) : null, institutionCode: optional(p[1]), institutionName: optional(p[2]) ?? "", institutionDivisionName: optional(p[3]), extraValue1: optional(p[4]), extraValue2: optional(p[5]), extraValue3: optional(p[6]), sourceValue };
  }).filter((x) => x.institutionName !== "");
}
class MissingContractIdentityError extends Error {
  reason = "MISSING_STABLE_CONTRACT_IDENTITY";
  constructor() {
    super("dcsnCntrctNo must be a non-empty string (or cntrctNo fallback)");
    this.name = "MissingContractIdentityError";
  }
}
function normalizeContract(raw) {
  const decisionContractNo = text(raw, "dcsnCntrctNo") ?? text(raw, "cntrctNo");
  if (!decisionContractNo) throw new MissingContractIdentityError();
  const demandInstitutions = parseContractDemandInstitutions(raw.dminsttList), corporations = parseContractCorporations(raw.corpList);
  const candidate = { decisionContractNo, contractNo: text(raw, "cntrctNo") ?? text(raw, "cntrctRefNo"), contractRefNo: text(raw, "cntrctRefNo"), unifiedContractNo: text(raw, "untyCntrctNo"), contractName: text(raw, "cntrctNm"), contractMethodName: text(raw, "cntrctCnclsMthdNm"), businessDivisionName: text(raw, "bsnsDivNm"), contractInstitutionName: text(raw, "cntrctInsttNm"), demandInstitutionName: demandInstitutions[0]?.institutionName ?? text(raw, "dminsttNm"), contractAmount: amount(raw, "thtmCntrctAmt"), totalContractAmount: amount(raw, "totCntrctAmt"), contractDate: text(raw, "cntrctDate") ?? text(raw, "cntrctCnclsDate"), registeredAt: text(raw, "rgstDt"), contractPeriod: text(raw, "cntrctPrd"), contractDetailUrl: text(raw, "cntrctDtlInfoUrl"), contractInfoUrl: text(raw, "cntrctInfoUrl"), baseLawName: text(raw, "baseLawNm"), baseDetails: text(raw, "baseDtls"), paymentDivisionName: text(raw, "payDivNm"), longTermContinuationDivisionName: text(raw, "lngtrmCtnuDivNm"), commonContractYn: text(raw, "cmmnCntrctYn"), guaranteeMoneyRate: text(raw, "grntymnyRate"), delayCompensationRate: text(raw, "dfrcmpnstRt"), contractInstitutionCode: text(raw, "cntrctInsttCd"), contractInstitutionDivisionName: text(raw, "cntrctInsttJrsdctnDivNm"), contractDepartmentName: text(raw, "cntrctInsttChrgDeptNm"), contractOfficerName: text(raw, "cntrctInsttOfclNm"), contractOfficerTelNo: text(raw, "cntrctInsttOfclTelNo"), contractOfficerFaxNo: text(raw, "cntrctInsttOfclFaxNo"), creditorName: text(raw, "crdtrNm"), informationBusinessYn: text(raw, "infoBizYn"), requestNo: text(raw, "reqNo"), noticeNo: text(raw, "ntceNo") };
  const semanticStateJson = stableStringify(Object.fromEntries(Object.entries(candidate).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value])));
  return { candidate, corporations, demandInstitutions, semanticStateJson, semanticRowHash: createHash("sha256").update(semanticStateJson).digest("hex"), warnings: [] };
}
export {
  CONTRACT_OPERATION,
  CONTRACT_SERVICE,
  MissingContractIdentityError,
  normalizeContract,
  parseContractCorporations,
  parseContractDemandInstitutions
};
