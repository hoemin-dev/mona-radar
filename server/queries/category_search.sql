WITH scope AS MATERIALIZED (
  SELECT f.facility_id FROM facility f WHERE {where_sql}
), {projection}, ranked_views AS (
  SELECT c.*,COALESCE(p.merge_priority,2147483647) category_rank,
    ROW_NUMBER() OVER(PARTITION BY c.facility_id
      ORDER BY COALESCE(p.merge_priority,2147483647),c.category) view_rank
  FROM category_context c LEFT JOIN facility_category_priority p ON p.category_type=c.category
), search_view AS (
  SELECT s.facility_id,COALESCE(c.category,f.facility_type) category,
    c.capacity_value,c.capacity_unit,c.capacity_type,
    COALESCE(c.category_rank,2147483647) category_rank
  FROM scope s JOIN facility f USING(facility_id)
  LEFT JOIN ranked_views c ON c.facility_id=s.facility_id AND c.view_rank=1
), page AS MATERIALIZED (
  SELECT f.*,l.province_normalized,l.city_county_normalized,
    COALESCE(l.road_address,l.address_raw) display_address,
    c.category,c.capacity_value,c.capacity_unit,c.capacity_type,c.category_rank
  FROM search_view c CROSS JOIN facility f USING(facility_id)
  LEFT JOIN facility_location l USING(location_id)
  ORDER BY {order_sql} LIMIT ?9 OFFSET ?10
), page_members AS MATERIALIZED (
  SELECT facility_id,facility_id member_id FROM page UNION
  SELECT p.facility_id,m.member_facility_id FROM page p
  CROSS JOIN logical_facility_member m ON m.master_facility_id=p.facility_id
), page_categories AS (
  SELECT pm.facility_id,group_concat(DISTINCT c.category_type) categories
  FROM page_members pm CROSS JOIN facility_category c ON c.facility_id=pm.member_id
  GROUP BY pm.facility_id
), page_organizations AS (
  SELECT pm.facility_id,group_concat(DISTINCT o.organization_name) orgs
  FROM page_members pm CROSS JOIN facility_organization fo ON fo.facility_id=pm.member_id
  CROSS JOIN organization o USING(organization_id) GROUP BY pm.facility_id
), page_jurisdiction AS (
  SELECT pm.facility_id,CASE WHEN COUNT(DISTINCT e.jurisdiction)=1 THEN MIN(e.jurisdiction) END jurisdiction
  FROM page_members pm JOIN facility_jurisdiction_evidence e ON e.facility_id=pm.member_id GROUP BY pm.facility_id
)
SELECT f.facility_id,f.canonical_name,f.category,f.province_normalized,f.city_county_normalized,
  f.display_address,f.capacity_value,f.capacity_unit,f.facility_status,f.confidence_status,
  o.orgs,c.categories,f.merge_status,j.jurisdiction,f.status_raw,f.capacity_type
FROM page f LEFT JOIN page_categories c USING(facility_id)
LEFT JOIN page_organizations o USING(facility_id) LEFT JOIN page_jurisdiction j USING(facility_id)
ORDER BY {order_sql}
