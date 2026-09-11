// Vendored from mona-radar-market; see provenance.json.
const KONEPS_SERVICE_ENDPOINTS = {
  BidPublicInfoService: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
  ScsbidInfoService: "https://apis.data.go.kr/1230000/as/ScsbidInfoService",
  CntrctInfoService: "https://apis.data.go.kr/1230000/ao/CntrctInfoService",
  ThngListInfoService02: "https://apis.data.go.kr/1230000/ao/ThngListInfoService02",
  CntrctProcssIntgOpenService: "https://apis.data.go.kr/1230000/ao/CntrctProcssIntgOpenService"
};
const LIFECYCLE_INTEGRATED_OPERATION = {
  service: "CntrctProcssIntgOpenService",
  path: "getCntrctProcssIntgOpenThng",
  defaultResponseType: "json",
  validate(params) {
    if (params.inqryDiv !== "1") throw new Error("lifecycle notice lookup requires inqryDiv=1");
    requiredIdentifier(params.bidNtceNo, "bidNtceNo");
    if (params.bidNtceOrd !== void 0) requiredIdentifier(params.bidNtceOrd, "bidNtceOrd");
  }
};
const DATE_TIME_MINUTE = /^\d{12}$/;
const BID_NOTICE_SEARCH_OPERATION = {
  service: "BidPublicInfoService",
  path: "getBidPblancListInfoThngPPSSrch",
  defaultResponseType: "json",
  validate(params) {
    if (!DATE_TIME_MINUTE.test(params.inqryBgnDt) || !DATE_TIME_MINUTE.test(params.inqryEndDt)) {
      throw new Error("inqryBgnDt and inqryEndDt must use YYYYMMDDHHMM strings");
    }
  }
};
function requiredIdentifier(value, field) {
  if (!value || /[&#?\s]/u.test(value)) throw new Error(`${field} must be a non-empty identifier without query separators`);
}
const BID_ITEM_OPERATION = {
  service: "BidPublicInfoService",
  path: "getBidPblancListInfoThngPurchsObjPrdct",
  defaultResponseType: "json",
  validate(params) {
    if (params.inqryDiv !== "2") throw new Error("bid item identity verification requires inqryDiv=2");
    requiredIdentifier(params.bidNtceNo, "bidNtceNo");
    requiredIdentifier(params.bidNtceOrd, "bidNtceOrd");
  }
};
const BID_BASIS_AMOUNT_OPERATION = {
  service: "BidPublicInfoService",
  path: "getBidPblancListInfoThngBsisAmount",
  defaultResponseType: "json",
  validate(params) {
    if (params.inqryDiv !== "2") throw new Error("basis amount identity verification requires inqryDiv=2");
    requiredIdentifier(params.bidNtceNo, "bidNtceNo");
  }
};
const DETAILED_PRODUCT_CLASSIFICATION_NO = /^\d{10}$/;
const AWARD_SEARCH_OPERATION = {
  service: "ScsbidInfoService",
  path: "getScsbidListSttusThngPPSSrch",
  defaultResponseType: "json",
  validate(params) {
    if (params.inqryDiv === "3") {
      requiredIdentifier(params.bidNtceNo ?? "", "bidNtceNo");
    } else if (!params.inqryBgnDt || !params.inqryEndDt || !DATE_TIME_MINUTE.test(params.inqryBgnDt) || !DATE_TIME_MINUTE.test(params.inqryEndDt)) {
      throw new Error("award date search requires inqryBgnDt and inqryEndDt as YYYYMMDDHHMM");
    }
    if (params.dtilPrdctClsfcNo !== void 0 && !DETAILED_PRODUCT_CLASSIFICATION_NO.test(params.dtilPrdctClsfcNo)) {
      throw new Error("dtilPrdctClsfcNo must be a 10-digit detailed product classification number");
    }
  }
};
const DATE = /^\d{8}$/;
const CONTRACT_SEARCH_OPERATION = {
  service: "CntrctInfoService",
  path: "getCntrctInfoListThngPPSSrch",
  defaultResponseType: "json",
  validate(params) {
    if (params.inqryDiv !== "1" || !DATE.test(params.inqryBgnDate) || !DATE.test(params.inqryEndDate)) {
      throw new Error("contract date search requires inqryDiv=1 and YYYYMMDD dates");
    }
    if (!params.prdctClsfcNoNm.trim()) throw new Error("prdctClsfcNoNm is required");
  }
};
function openingOperation(path) {
  return { service: "ScsbidInfoService", path, defaultResponseType: "json", validate(params) {
    requiredIdentifier(params.bidNtceNo, "bidNtceNo");
    requiredIdentifier(params.bidNtceOrd, "bidNtceOrd");
    requiredIdentifier(params.bidClsfcNo, "bidClsfcNo");
    requiredIdentifier(params.rbidNo, "rbidNo");
  } };
}
const OPENING_PARTICIPANT_OPERATION = openingOperation("getOpengResultListInfoOpengCompt");
const OPENING_PRELIMINARY_PRICE_OPERATION = { service: "ScsbidInfoService", path: "getOpengResultListInfoThngPreparPcDetail", defaultResponseType: "json", validate(params) {
  if (params.inqryDiv !== "2") throw new Error("preliminary price identity lookup requires inqryDiv=2");
  requiredIdentifier(String(params.bidNtceNo ?? ""), "bidNtceNo");
} };
const OPENING_FAILURE_OPERATION = openingOperation("getOpengResultListInfoFailing");
const OPENING_REBID_OPERATION = openingOperation("getOpengResultListInfoRebid");
const OPENING_ENRICHMENT_OPERATIONS = [OPENING_PARTICIPANT_OPERATION, OPENING_PRELIMINARY_PRICE_OPERATION, OPENING_FAILURE_OPERATION, OPENING_REBID_OPERATION];
function bidEnrichmentOperation(path) {
  return { service: "BidPublicInfoService", path, defaultResponseType: "json", validate(params) {
    if (params.inqryDiv !== "2") throw new Error("bid enrichment identity lookup requires inqryDiv=2");
    requiredIdentifier(params.bidNtceNo, "bidNtceNo");
    requiredIdentifier(params.bidNtceOrd, "bidNtceOrd");
  } };
}
const BID_LICENSE_LIMIT_OPERATION = bidEnrichmentOperation("getBidPblancListInfoLicenseLimit");
const BID_PARTICIPATION_REGION_OPERATION = bidEnrichmentOperation("getBidPblancListInfoPrtcptPsblRgn");
const BID_NOTICE_CHANGE_OPERATION = bidEnrichmentOperation("getBidPblancListInfoChgHstryThng");
const BID_EORDER_ATTACHMENT_OPERATION = bidEnrichmentOperation("getBidPblancListInfoEorderAtchFileInfo");
const BID_ENRICHMENT_OPERATIONS = [BID_LICENSE_LIMIT_OPERATION, BID_PARTICIPATION_REGION_OPERATION, BID_NOTICE_CHANGE_OPERATION, BID_EORDER_ATTACHMENT_OPERATION];
const CONTRACT_DETAIL_OPERATION = {
  service: "CntrctInfoService",
  path: "getCntrctInfoListThngDetail",
  defaultResponseType: "json",
  validate(params) {
    if (params.inqryDiv !== "2") throw new Error("contract detail lookup requires inqryDiv=2");
    requiredIdentifier(params.untyCntrctNo, "untyCntrctNo");
  }
};
const DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION = {
  service: "ThngListInfoService02",
  path: "getPrdctClsfcNoUnit10Info02",
  defaultResponseType: "json",
  validate(params) {
    for (const [field, value] of [
      ["dtilPrdctClsfcNoBgnNo", params.dtilPrdctClsfcNoBgnNo],
      ["dtilPrdctClsfcNoEndNo", params.dtilPrdctClsfcNoEndNo]
    ]) {
      if (value !== void 0 && !DETAILED_PRODUCT_CLASSIFICATION_NO.test(value)) {
        throw new Error(`${field} must be a 10-digit detailed product classification number`);
      }
    }
    if (params.dtilPrdctClsfcNoBgnNo !== void 0 && params.dtilPrdctClsfcNoEndNo !== void 0 && params.dtilPrdctClsfcNoBgnNo > params.dtilPrdctClsfcNoEndNo) {
      throw new Error("dtilPrdctClsfcNoBgnNo must not exceed dtilPrdctClsfcNoEndNo");
    }
  }
};
const CATALOG_ITEM_SEARCH_OPERATION = {
  service: "ThngListInfoService02",
  path: "getThngPrdnmLocplcAccotListInfoInfoPrdlstSearch02",
  defaultResponseType: "json",
  validate(params) {
    const supplied = [
      params.dtilPrdctClsfcNo,
      params.prdctIdntNo,
      params.prdctClsfcNoEngNm,
      params.prdctClsfcNoNm,
      params.krnPrdctNm,
      params.inqryBgnDt,
      params.inqryEndDt,
      params.chgPrdBgnDt,
      params.chgPrdEndDt
    ].some((value) => value !== void 0 && value.trim() !== "");
    if (!supplied) throw new Error("catalog item search requires at least one documented search field");
    if (params.dtilPrdctClsfcNo !== void 0 && !DETAILED_PRODUCT_CLASSIFICATION_NO.test(params.dtilPrdctClsfcNo)) {
      throw new Error("dtilPrdctClsfcNo must be a 10-digit detailed product classification number");
    }
    if (params.prdctIdntNo !== void 0 && !/^\d{8}$/u.test(params.prdctIdntNo)) {
      throw new Error("prdctIdntNo must be an 8-digit product identification number");
    }
  }
};
export {
  AWARD_SEARCH_OPERATION,
  BID_BASIS_AMOUNT_OPERATION,
  BID_ENRICHMENT_OPERATIONS,
  BID_EORDER_ATTACHMENT_OPERATION,
  BID_ITEM_OPERATION,
  BID_LICENSE_LIMIT_OPERATION,
  BID_NOTICE_CHANGE_OPERATION,
  BID_NOTICE_SEARCH_OPERATION,
  BID_PARTICIPATION_REGION_OPERATION,
  CATALOG_ITEM_SEARCH_OPERATION,
  CONTRACT_DETAIL_OPERATION,
  CONTRACT_SEARCH_OPERATION,
  DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION,
  KONEPS_SERVICE_ENDPOINTS,
  LIFECYCLE_INTEGRATED_OPERATION,
  OPENING_ENRICHMENT_OPERATIONS,
  OPENING_FAILURE_OPERATION,
  OPENING_PARTICIPANT_OPERATION,
  OPENING_PRELIMINARY_PRICE_OPERATION,
  OPENING_REBID_OPERATION
};
