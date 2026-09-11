WITH source_classes AS (
  SELECT 'BID' domain,b.bid_notice_id source_id,i.product_class_no parent,
    i.product_class_name parent_name,i.detailed_product_class_no detail,
    i.detailed_product_class_name detail_name,2 name_rank,
    json_extract(a.canonical_json,'$.prdctIdntNo') product_id,
    json_extract(a.canonical_json,'$.cmpntYn') cmpnt_yn
  FROM bid_notice b JOIN bid_item i ON i.bid_ntce_no=b.bid_ntce_no AND i.bid_ntce_ord=b.bid_ntce_ord
  LEFT JOIN api_raw_item a ON a.raw_item_id=i.source_raw_item_id
  UNION ALL
  SELECT 'AWARD',a.award_result_id,NULL,NULL,a.target_detailed_product_class_no,
    NULL,3,l.prdct_idnt_no,NULL
  FROM award_result a LEFT JOIN award_catalog_item_link l ON l.award_result_id=a.award_result_id
  UNION ALL
  SELECT 'CONTRACT',r.contract_result_id,
    COALESCE(NULLIF(json_extract(i.raw_json,'$.prdctClsfcNo'),''),NULLIF(i.product_class_no,''),json_extract(a.canonical_json,'$.prdctClsfcNo')),
    COALESCE(CASE WHEN json_extract(a.canonical_json,'$.prdctClsfcNo')=COALESCE(NULLIF(json_extract(i.raw_json,'$.prdctClsfcNo'),''),NULLIF(i.product_class_no,''),json_extract(a.canonical_json,'$.prdctClsfcNo')) THEN NULLIF(json_extract(a.canonical_json,'$.prdctClsfcNoNm'),'') END,NULLIF(json_extract(i.raw_json,'$.prdctClsfcNoNm'),''),i.product_class_name),
    COALESCE(NULLIF(json_extract(i.raw_json,'$.dtilPrdctClsfcNo'),''),json_extract(a.canonical_json,'$.dtilPrdctClsfcNo')),
    COALESCE(NULLIF(json_extract(i.raw_json,'$.dtilPrdctClsfcNoNm'),''),json_extract(a.canonical_json,'$.dtilPrdctClsfcNoNm')),
    CASE WHEN json_extract(a.canonical_json,'$.prdctClsfcNo')=COALESCE(NULLIF(json_extract(i.raw_json,'$.prdctClsfcNo'),''),NULLIF(i.product_class_no,'')) AND NULLIF(json_extract(a.canonical_json,'$.prdctClsfcNoNm'),'') IS NOT NULL THEN 1 ELSE 2 END,
    i.product_identification_no,json_extract(a.canonical_json,'$.cmpntYn')
  FROM contract_result r JOIN contract_header h ON h.decision_contract_no=r.decision_contract_no
  JOIN contract_item i ON i.contract_header_id=h.contract_header_id
  LEFT JOIN contract_catalog_cache c ON c.product_identification_no=i.product_identification_no AND c.lookup_status='FOUND'
  LEFT JOIN api_raw_item a ON a.raw_item_id=c.source_raw_item_id
), valid_classes AS (
  SELECT domain,source_id,
    CASE WHEN length(trim(parent))=8 AND trim(parent) NOT GLOB '*[^0-9]*' THEN trim(parent) END official_parent,
    parent_name,
    CASE WHEN length(trim(detail))=10 AND trim(detail) NOT GLOB '*[^0-9]*' THEN trim(detail) END detailed_no,
    detail_name,name_rank,product_id,cmpnt_yn
  FROM source_classes
), search_classes AS (
  SELECT domain,source_id,COALESCE(official_parent,substr(detailed_no,1,8)) classification_no,
    CASE WHEN official_parent IS NOT NULL THEN NULLIF(trim(parent_name),'') END classification_name,
    detailed_no,NULLIF(trim(detail_name),'') detailed_name,name_rank,product_id,cmpnt_yn
  FROM valid_classes
)
