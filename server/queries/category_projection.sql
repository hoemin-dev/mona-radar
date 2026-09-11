-- The caller supplies scope(facility_id), and ?2 is the selected category
-- (empty for all category cards in one detail). Never expand the whole database.
-- SRC_SLUDGE_FACILITY_2024's 시설용량 is approved design tonnes/day,
-- not annual throughput: https://www.data.go.kr/data/15065216/fileData.do
context_members AS MATERIALIZED (
  SELECT facility_id, facility_id member_id FROM scope
  UNION
  SELECT p.facility_id, m.member_facility_id FROM scope p
  CROSS JOIN logical_facility_member m ON m.master_facility_id=p.facility_id
), context_sources AS (
  SELECT pm.facility_id, c.category_type category, f.facility_id member_id,
    c.source_record_id, sr.source_id, COALESCE(cap.observed_year,s.source_year) source_year,
    cap.capacity_id,cap.value reported_capacity,cap.unit reported_unit,
    CASE c.category_type
      WHEN 'SEWAGE_SLUDGE' THEN 'TON_PER_DAY'
      WHEN 'FOOD_WASTE' THEN 'TON_PER_DAY'
      WHEN 'INCINERATION' THEN 'TON_PER_DAY'
      WHEN 'PUBLIC_SEWAGE' THEN 'M3_PER_DAY'
      WHEN 'PUBLIC_WASTEWATER' THEN 'M3_PER_DAY'
      WHEN 'LIVESTOCK_MANURE' THEN 'M3_PER_DAY'
      WHEN 'SEPTAGE' THEN 'M3_PER_DAY'
      WHEN 'WATER_TREATMENT' THEN 'M3_PER_DAY'
    END expected_unit,
    f.facility_type, f.primary_capacity_value, f.primary_capacity_unit, f.primary_capacity_type,
    CASE WHEN s.source_code='SRC_SLUDGE_FACILITY_2024' AND json_valid(sr.raw_payload)
      THEN replace(trim(CAST(json_extract(sr.raw_payload,'$.시설용량') AS TEXT)),',','') END sludge_design
  FROM context_members pm
  CROSS JOIN facility_category c ON c.facility_id=pm.member_id
  CROSS JOIN facility f ON f.facility_id=pm.member_id
  LEFT JOIN facility_capacity cap ON cap.facility_id=pm.member_id
    AND cap.source_record_id=c.source_record_id AND cap.capacity_type='DESIGN' AND cap.process_id IS NULL
  LEFT JOIN source_record sr ON c.category_type='SEWAGE_SLUDGE' AND sr.source_record_id=c.source_record_id
  LEFT JOIN source s ON s.source_id=sr.source_id
  WHERE ?2='' OR c.category_type=?2
), context_values AS (
  SELECT *, CASE WHEN capacity_id IS NOT NULL THEN
      CASE WHEN reported_unit=expected_unit AND reported_capacity>=0 THEN reported_capacity END
    WHEN category='SEWAGE_SLUDGE' THEN
      CASE WHEN sludge_design GLOB '*[0-9]*' AND sludge_design NOT GLOB '*[^0-9.]*'
        AND length(sludge_design)-length(replace(sludge_design,'.',''))<=1
        THEN CAST(sludge_design AS REAL) END
    WHEN facility_type=category AND primary_capacity_type='DESIGN'
      AND primary_capacity_unit=expected_unit AND primary_capacity_value>=0
      THEN primary_capacity_value END capacity_value
  FROM context_sources
), context_ranked AS (
  -- Do not sum duplicate reports or separate treatment lines without evidence
  -- of additivity. Prefer a usable, latest record, then the identity member.
  SELECT *, ROW_NUMBER() OVER(PARTITION BY facility_id,category
    ORDER BY capacity_value IS NULL,source_year DESC,member_id!=facility_id,
      member_id,source_record_id,capacity_id) rn FROM context_values
), category_context AS MATERIALIZED (
  SELECT facility_id,category,member_id,capacity_value,
    expected_unit capacity_unit,'DESIGN' capacity_type,source_record_id
  FROM context_ranked WHERE rn=1
)
