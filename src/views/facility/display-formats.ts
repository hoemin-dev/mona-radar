const CAPACITY_UNIT_LABELS: Record<string, string> = {
  M3_PER_DAY: "m³/일", "M3/DAY": "m³/일", "M³/DAY": "m³/일",
  "M3/일": "m³/일", "M³/일": "m³/일", "㎥/일": "m³/일", "㎥/DAY": "m³/일",
  TON_PER_DAY: "톤/일", "T/DAY": "톤/일", "T/일": "톤/일", "톤/일": "톤/일",
  TON_PER_YEAR: "톤/년", "T/YEAR": "톤/년", "T/YR": "톤/년", "T/년": "톤/년", "톤/년": "톤/년",
};

export function displayCapacityUnit(value: unknown, compact = true): string {
  const unit = knownUnit(value);
  if (!unit) return "";
  const normalized = unit.replace(/\s+/g, "").toUpperCase();
  return CAPACITY_UNIT_LABELS[normalized] ?? (compact ? unit : displayDetailLabel(unit));
}

export function knownUnit(value: unknown): string {
  const unit = String(value ?? "").trim();
  return ["UNKNOWN", "단위미상"].includes(unit.replace(/\s+/g, "").toUpperCase()) ? "" : unit;
}

export function displayOrganizationType(value: unknown): string {
  return String(value ?? "").trim().toUpperCase() === "UNKNOWN" || value == null ? "" : displayDetailLabel(value);
}

export type LogicalMember = Record<string, unknown>;

export function visibleLogicalMembers(value: unknown): LogicalMember[] {
  return Array.isArray(value) ? (value as LogicalMember[]).filter(member => member.category !== "LANDFILL") : [];
}

const DETAIL_LABELS: Record<string, string> = {
  PUBLIC_CORPORATION: "공기업", PRIVATE_COMPANY: "민간기업", LOCAL_GOV: "지방자치단체", DEPARTMENT: "담당 부서",
  PUBLIC: "공공", PRIVATE: "민간", UNKNOWN: "미확인", MIXED: "공공·민간", OTHER: "기타",
  PUBLIC_SEWAGE: "공공하수", PUBLIC_WASTEWATER: "공공폐수", LIVESTOCK_MANURE: "가축분뇨",
  FOOD_WASTE: "음식물", SEWAGE_SLUDGE: "하수찌꺼기", SEPTAGE: "분뇨",
  INCINERATION: "소각·자원회수", LANDFILL: "매립", WATER_TREATMENT: "정수장",
  ANNUAL_THROUGHPUT: "연간 처리량", ENERGY: "에너지 사용량", STAFF_COUNT: "운영 인원",
  UTILIZATION_RATE: "가동률", DISCHARGE: "방류량", INFLOW: "유입량", GENERATED_AMOUNT: "발생량",
  COUNT: "명", PERCENT: "%", KWH: "kWh", TOE: "toe", GCAL: "Gcal",
  M3_PER_DAY: "㎥/일", M3_PER_YEAR: "㎥/년", TON_PER_DAY: "톤/일", TON_PER_YEAR: "톤/년",
  M3: "㎥", TON: "톤", THOUSAND_SM3_PER_YEAR: "천 Sm³/년",
  QUALITY_WARNING: "주의", USABLE: "사용 가능", DESIGN: "설계 용량", PERMITTED: "허가 용량",
  TREATMENT: "처리 용량", STORAGE: "저장 용량", DAILY_CAPACITY: "일일 처리 용량",
  PROCESS_OF_FACILITY: "연계 공정/시설",
};

export function displayDetailLabel(value: unknown): string {
  if (value == null || value === "") return "—";
  const text = String(value);
  return DETAIL_LABELS[text] ?? (/^[A-Z][A-Z0-9_]*$/.test(text) ? "미확인" : text);
}
