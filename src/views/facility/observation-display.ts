import { displayCapacityUnit, displayDetailLabel, knownUnit } from "./display-formats";

type Row = Record<string, unknown>;
type Indicator = { id: string; label: string; defaultUnit?: string };
const definitions = (source: string, labels: Record<string, string>): Record<string, Indicator> =>
  Object.fromEntries(Object.entries(labels).map(([raw, label]) => [raw, { id: `${source}:${raw}`, label,
    ...(source === "sludge" && raw !== "이송처리량" ? { defaultUnit: "t/년" } : {}) }]));

// Exact source/column mappings. Definitions and conditional equivalence evidence:
// docs/observation-canonical-mapping.md. Never infer meaning from substrings.
export const OBSERVATION_INDICATORS: Record<string, Record<string, Indicator>> = {
  SRC_SLUDGE_FACILITY_2024: definitions("sludge-facility", { "연간처리량": "연간 처리량" }),
  SRC_PUBLIC_SEWAGE_2024: definitions("sewage", {
    "방류량": "방류량", "고도 방류량": "고도처리 방류량",
    "물리적 방류량": "물리처리 방류량", "생물학적 방류량": "생물처리 방류량",
    "유입하수량": "하수 유입량", "고도 유입하수량": "고도처리 유입량",
    "물리적 유입하수량": "물리처리 유입량", "생물학적 유입하수량": "생물처리 유입량",
    "연계처리량_기타": "기타물질 연계 처리량", "연계처리량_분뇨": "분뇨 연계 처리량",
    "연계처리량_축산": "축산폐수 연계 처리량", "연계처리량_침출수": "침출수 연계 처리량",
    "하수처리량당 이산화탄소(CO2)배출량": "하수 처리량당 CO₂ 배출량",
    "에너지자립율": "에너지 자립률", "에너지자체생산량": "에너지 자체 생산량",
    "연간 총 에너지 사용량_계_(TOE)": "연간 에너지 사용량",
    "연간 총 에너지 사용량_자체 에너지사용량(TOE)": "자체 생산 에너지 사용량",
    "연간 총 에너지 사용량_총 전력사용량(kWh)": "연간 전력 사용량",
    "직원총수(명)": "운영 인원",
  }),
  SRC_SLUDGE_FLOW_2024: definitions("sludge", {
    "찌꺼기처리량_합계": "슬러지 총 처리량",
    "자체찌꺼기처리량_합계": "슬러지 자체 처리량",
    "수도권광역 위탁처리량": "슬러지 수도권광역 위탁 처리량",
    "이송처리량": "액상슬러지 이송량",
    "찌꺼기 발생량_합계": "슬러지 총 발생량",
    "찌꺼기 발생량_자체": "슬러지 자체 발생량",
    "찌꺼기 발생량_외부유입량": "슬러지 외부 유입량",
    "외부위탁처리량_소계": "슬러지 외부위탁 처리량",
    "외부위탁처리량_매립": "슬러지 외부위탁 매립량",
    "외부위탁처리량_복토재": "슬러지 외부위탁 복토재 이용량",
    "외부위탁처리량_소각": "슬러지 외부위탁 소각량",
    "외부위탁처리량_연료": "슬러지 외부위탁 연료 이용량",
    "외부위탁처리량_제품원료": "슬러지 외부위탁 제품원료 이용량",
    "외부위탁처리량_퇴비화": "슬러지 외부위탁 퇴비화량",
    "자체찌꺼기처리량_건조": "슬러지 자체 건조량",
    "자체찌꺼기처리량_고화": "슬러지 자체 고화량",
    "자체찌꺼기처리량_매립": "슬러지 자체 매립량",
    "자체찌꺼기처리량_소각": "슬러지 자체 소각량",
    "자체찌꺼기처리량_탄화": "슬러지 자체 탄화량",
    "자체찌꺼기처리량_퇴비화": "슬러지 자체 퇴비화량",
    "자체찌꺼기처리량_건조 후 처리(2차)_소계": "건조 슬러지 2차 처리량",
    "자체찌꺼기처리량_건조 후 처리(2차)_매립": "건조 슬러지 2차 매립량",
    "자체찌꺼기처리량_건조 후 처리(2차)_복토재": "건조 슬러지 2차 복토재 이용량",
    "자체찌꺼기처리량_건조 후 처리(2차)_소각": "건조 슬러지 2차 소각량",
    "자체찌꺼기처리량_건조 후 처리(2차)_연료": "건조 슬러지 2차 연료 이용량",
    "자체찌꺼기처리량_건조 후 처리(2차)_제품원료": "건조 슬러지 2차 제품원료 이용량",
    "자체찌꺼기처리량_건조 후 처리(2차)_퇴비화": "건조 슬러지 2차 퇴비화량",
    "자체찌꺼기처리량_고화 후 처리(2차)_소계": "고화 슬러지 2차 처리량",
    "자체찌꺼기처리량_고화 후 처리(2차)_매립": "고화 슬러지 2차 매립량",
    "자체찌꺼기처리량_고화 후 처리(2차)_복토재": "고화 슬러지 2차 복토재 이용량",
    "자체찌꺼기처리량_소각 후 처리(2차)_소계": "소각 슬러지 2차 처리량",
    "자체찌꺼기처리량_소각 후 처리(2차)_매립": "소각 슬러지 2차 매립량",
    "자체찌꺼기처리량_소각 후 처리(2차)_복토재": "소각 슬러지 2차 복토재 이용량",
    "자체찌꺼기처리량_소각 후 처리(2차)_제품원료": "소각 슬러지 2차 제품원료 이용량",
    "자체찌꺼기처리량_탄화 후 처리(2차)_소계": "탄화 슬러지 2차 처리량",
    "자체찌꺼기처리량_탄화 후 처리(2차)_소각": "탄화 슬러지 2차 소각량",
    "자체찌꺼기처리량_탄화 후 처리(2차)_연료": "탄화 슬러지 2차 연료 이용량",
  }),
};

export const DISCHARGE_EQUIVALENCE = {
  source: "SRC_PUBLIC_SEWAGE_2024", category: "PUBLIC_SEWAGE", metric: "DISCHARGE",
  total: "방류량", components: ["물리적 방류량", "생물학적 방류량", "고도 방류량"],
  reason: "전체 방류량이 유일한 비영(非零) 처리방식의 방류량과 일치하고 나머지 방식은 0",
} as const;

function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Filter only at rendering time, after equivalence checks have used the zero rows.
export const visibleObservations = (observations: Row[]): Row[] => observations.filter(row => numeric(row.value) !== 0);

export function displayObservationUnit(category: string, row: Row, compact = false): string {
  if (category === "SEWAGE_SLUDGE" && observationLabel(row) === "연간 처리량") return displayCapacityUnit("t/년", compact);
  const unit = knownUnit(row.unit);
  const indicator = OBSERVATION_INDICATORS[String(row.source_code)]?.[String(row.metric_key_raw)];
  // Explicit source columns are stronger evidence than broad metric types.
  const annualMass = indicator?.defaultUnit || (!row.metric_key_raw &&
    ["ANNUAL_THROUGHPUT", "GENERATED_AMOUNT"].includes(String(row.metric_type ?? row.capacity_type)));
  if (category === "SEWAGE_SLUDGE" && annualMass && (!unit || ["TON_PER_YEAR", "t/년", "톤/년"].includes(unit))) return displayCapacityUnit("t/년", compact);
  return displayCapacityUnit(unit, compact);
}

export function displayPrimaryCapacityUnit(row: Row, compact = false): string {
  const category = String(row.facilityType ?? row.category ?? "UNKNOWN");
  const unit = row.primaryCapacityUnit ?? row.primary_capacity_unit;
  return displayObservationUnit(category, {
    unit,
    capacity_type: row.primaryCapacityType ?? row.primary_capacity_type ?? (knownUnit(unit) === "TON_PER_YEAR" ? "ANNUAL_THROUGHPUT" : undefined),
  }, compact);
}

export function canonicalizeObservations(category: string, observations: Row[]): Row[] {
  const display = observations.map(row => {
    const indicator = OBSERVATION_INDICATORS[String(row.source_code)]?.[String(row.metric_key_raw)];
    return indicator ? { ...row, canonical_indicator: indicator.id, indicator_label: indicator.label,
      source_observations: [row] } : row;
  });
  const rule = DISCHARGE_EQUIVALENCE;
  if (category !== rule.category) return display;
  const removed = new Set<Row>();
  for (const total of display) {
    if (total.source_code !== rule.source || total.metric_type !== rule.metric || total.metric_key_raw !== rule.total ||
      !total.source_record_id || !total.member_facility_id || total.observed_year == null || (numeric(total.value) ?? 0) <= 0) continue;
    const sameScope = (row: Row) => row.source_code === total.source_code && row.source_record_id === total.source_record_id &&
      row.member_facility_id === total.member_facility_id && row.observed_year === total.observed_year &&
      row.metric_type === total.metric_type && (row.process_id ?? null) === (total.process_id ?? null) &&
      String(row.unit ?? "").trim().toUpperCase() === String(total.unit ?? "").trim().toUpperCase();
    const totals = display.filter(row => sameScope(row) && row.metric_key_raw === rule.total);
    const parts = rule.components.map(key => display.filter(row => sameScope(row) && row.metric_key_raw === key));
    // Missing, conflicting, all-zero, or mixed-treatment data is not equivalence evidence.
    if (totals.length !== 1 || parts.some(rows => rows.length !== 1)) continue;
    const components = parts.map(rows => rows[0]!);
    const active = components.filter(row => numeric(row.value) === numeric(total.value));
    if (active.length !== 1 || components.some(row => row !== active[0] && numeric(row.value) !== 0)) continue;
    const equivalent = active[0]!;
    total.source_observations = [...total.source_observations as Row[], ...equivalent.source_observations as Row[]];
    total.canonical_reason = rule.reason;
    removed.add(equivalent);
  }
  return display.filter(row => !removed.has(row));
}

export function observationLabel(row: Row): string {
  return String(row.indicator_label ?? row.metric_key_raw ?? displayDetailLabel(row.metric_type));
}

// Input must be the category's existing canonical/deduplicated observations.
// Stable selection preserves the existing representative order within one year.
export function selectCategoryCapacity(category: string, observations: Row[], fallback: Row): Row {
  if (category !== "SEWAGE_SLUDGE") return fallback;
  const selected = observations.filter(row => observationLabel(row) === "연간 처리량" &&
    numeric(row.value) !== null && numeric(row.value) !== 0 && numeric(row.observed_year) !== null)
    .reduce<Row | undefined>((latest, row) => !latest || Number(row.observed_year) > Number(latest.observed_year) ? row : latest, undefined);
  return { ...fallback, primary_capacity_value: selected ? numeric(selected.value) : null,
    primary_capacity_unit: "t/년", primary_capacity_type: "ANNUAL_THROUGHPUT",
    primary_capacity_year: selected?.observed_year ?? null };
}
