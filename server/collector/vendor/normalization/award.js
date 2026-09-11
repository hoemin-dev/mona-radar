// Vendored from mona-radar-market; see provenance.json.
import { createHash } from "node:crypto";
import { stableStringify } from "../storage/raw-persistence.js";
const AWARD_SERVICE = "ScsbidInfoService", AWARD_OPERATION = "getScsbidListSttusThngPPSSrch";
function str(raw, field, w, required = false) {
  const v = raw[field];
  if (typeof v !== "string" || v === "") {
    if (required) throw new Error(`${field} must be a non-empty string`);
    if (v !== void 0 && v !== null && v !== "") w.push({ field, code: "invalid_type" });
    return null;
  }
  return v;
}
function dt(raw, field, w, required = false) {
  const value = str(raw, field, w, required);
  if (value === null) return { raw: null, local: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(value);
  if (!m) {
    w.push({ field, code: "invalid_datetime" });
    return { raw: value, local: null };
  }
  const [, y, mo, d, h, mi, s = "00"] = m, local = `${y}-${mo}-${d}T${h}:${mi}:${s}`, check = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  if (check.toISOString().slice(0, 19) !== local) {
    w.push({ field, code: "invalid_datetime" });
    return { raw: value, local: null };
  }
  return { raw: value, local };
}
function int(raw, field, w) {
  const v = str(raw, field, w);
  if (v === null) return null;
  if (!/^\d+$/u.test(v)) {
    w.push({ field, code: "invalid_integer" });
    return null;
  }
  const n = BigInt(v);
  if (n > 9223372036854775807n) {
    w.push({ field, code: "invalid_integer" });
    return null;
  }
  return n;
}
function normalizeAward(raw) {
  const w = [], opening = dt(raw, "rlOpengDt", w), registered = dt(raw, "rgstDt", w, true);
  const candidate = { bidNtceNo: str(raw, "bidNtceNo", w, true), bidNtceOrd: str(raw, "bidNtceOrd", w, true), bidClsfcNo: str(raw, "bidClsfcNo", w, true), rbidNo: str(raw, "rbidNo", w, true), noticeDivisionCode: str(raw, "ntceDivCd", w), bidNtceName: str(raw, "bidNtceNm", w), participantCount: int(raw, "prtcptCnum", w), winnerName: str(raw, "bidwinnrNm", w, true), winnerBusinessNo: str(raw, "bidwinnrBizno", w, true), winnerCeoName: str(raw, "bidwinnrCeoNm", w), winnerAddress: str(raw, "bidwinnrAdrs", w), winnerTelNo: str(raw, "bidwinnrTelNo", w), successfulBidAmount: int(raw, "sucsfbidAmt", w), successfulBidRate: str(raw, "sucsfbidRate", w), realOpeningRaw: opening.raw, realOpeningLocal: opening.local, demandInstitutionCode: str(raw, "dminsttCd", w), demandInstitutionName: str(raw, "dminsttNm", w), registeredRaw: registered.raw, registeredLocal: registered.local, finalSuccessfulDate: str(raw, "fnlSucsfDate", w), winnerOfficial: str(raw, "fnlSucsfCorpOfcl", w) };
  const semanticStateJson = stableStringify(Object.fromEntries(Object.entries(candidate).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v])));
  return { candidate, warnings: w, semanticStateJson, semanticRowHash: createHash("sha256").update(semanticStateJson).digest("hex") };
}
export {
  AWARD_OPERATION,
  AWARD_SERVICE,
  normalizeAward
};
