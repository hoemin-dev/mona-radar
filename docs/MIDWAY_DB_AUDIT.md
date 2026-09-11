# MIDWAY DB 조사 · 2026-09-10

실사용 DB 6개를 명시적으로 선택했다. Market pre-v16 백업 1개와 Live 내부 캐시/에뮬레이터 5개는 제외했다. 비-SQLite 원본 파일은 이관하지 않았다.

## 복사 현황

|도메인|크기 (MiB)|테이블·뷰 수|무결성|원본 전후 해시|
|---|---:|---:|---|---|
|market|112.35|63|ok|동일|
|forecast|3.11|6|ok|동일|
|facility|789.48|51|ok|동일|
|company|24.35|30|ok|동일|
|certification|201.61|13|ok|동일|
|live_legacy|0.12|7|ok|동일|

전체 컬럼, CREATE TABLE/VIEW, 행 수, 원본·복사본 SHA-256은 db_local/import-manifest.json에 있다. FTS 내부 보조 테이블도 기록에 포함한다.

## market

원본: C:\Users\Manager1\AppData\Local\com.monaradar.market\MonaRadar\Market\mona-radar-market.sqlite3

복사본: db_local\market\mona-radar-market.sqlite3

|테이블·뷰|행 수|
|---|---:|
|api_call|16265|
|api_raw_item|17228|
|api_response_blob|6201|
|award_catalog_item_link|0|
|award_collection_job|6|
|award_collection_target|26|
|award_month_probe|1636|
|award_result|292|
|award_result_revision|0|
|bid_award_link|292|
|bid_basis_amount|256|
|bid_basis_amount_revision|0|
|bid_contract_link|295|
|bid_enrichment_state|0|
|bid_eorder_attachment|0|
|bid_item|583|
|bid_item_revision|0|
|bid_license_limit|0|
|bid_notice|380|
|bid_notice_change_event|0|
|bid_notice_revision|0|
|bid_participation_region|0|
|catalog_item_category|0|
|collection_target|8|
|collector_checkpoint|0|
|collector_lease|0|
|collector_operation_run|10902|
|collector_run|4294|
|collector_work_item|3526|
|contract_catalog_cache|427|
|contract_collection_job|14|
|contract_collection_target|20|
|contract_corporation|2870|
|contract_demand_institution|2869|
|contract_detail_state|2937|
|contract_header|2937|
|contract_historical_backfill_job|2|
|contract_historical_backfill_month|181|
|contract_item|4114|
|contract_month_probe|2934|
|contract_result|2869|
|detailed_product_category|0|
|entity_collection_target|3594|
|historical_backfill_chunk|0|
|historical_backfill_job|0|
|initial_collection_job|6|
|initial_collection_target|11|
|initial_month_probe|2278|
|lifecycle_award|292|
|lifecycle_collection_state|380|
|lifecycle_contract|295|
|lifecycle_group_member|587|
|lifecycle_record|380|
|opening_enrichment_state|1168|
|opening_failure_event|0|
|opening_participant|3765|
|opening_preliminary_price|3512|
|opening_rebid_event|0|
|procurement_group|0|
|procurement_group_member|0|
|procurement_relation|0|
|procurement_target|1|
|raw_item_observation|25899|

## forecast

원본: D:\work\mona-live\app\db\mona-live-procurement-plan.sqlite

복사본: db_local\forecast\mona-live-procurement-plan.sqlite

|테이블·뷰|행 수|
|---|---:|
|app_log|661|
|catalog_item_category|0|
|collection_target|11|
|collector_job|28|
|collector_month|301|
|order_plan|1373|

## facility

원본: C:\Users\Manager1\AppData\Local\com.monaradar.facility\data\facility.sqlite3

복사본: db_local\facility\facility.sqlite3

|테이블·뷰|행 수|
|---|---:|
|administrative_region|255|
|administrative_region_alias|46|
|alias_candidate|6131|
|candidate_validation_result|64|
|capacity_candidate|7707|
|date_candidate|27746|
|facility|6343|
|facility_alias|6131|
|facility_candidate|6131|
|facility_capacity|6051|
|facility_category|6343|
|facility_category_priority|9|
|facility_jurisdiction|6343|
|facility_jurisdiction_evidence|9408|
|facility_location|6343|
|facility_match_candidate|6068|
|facility_merge_history|0|
|facility_observation|236458|
|facility_organization|9467|
|facility_process|29063|
|facility_relation|3|
|facility_relation_candidate|6191|
|facility_search_document|6343|
|facility_search_fts|6343|
|facility_source_link|10876|
|import_run|31|
|landfill_cell|212|
|landfill_cell_candidate|212|
|logical_facility_group|214|
|logical_facility_jurisdiction|5030|
|logical_facility_member|493|
|normalization_run|12|
|observation_candidate|239893|
|organization|9459|
|organization_candidate|9989|
|organization_relation_candidate|9459|
|process_candidate|29445|
|process_organization|0|
|promotion_run|6|
|review_decision|6388|
|review_queue|6388|
|schema_migration|15|
|source|16|
|source_record|11249|
|staging_facility|10924|
|validation_result|149|

## company

원본: D:\mona\Company\mona-radar-company.sqlite3

복사본: db_local\company\mona-radar-company.sqlite3

|테이블·뷰|행 수|
|---|---:|
|app_our_company|1|
|collection_events|19752|
|collection_items|18909|
|collection_jobs|75|
|collector_targets|11|
|companies|1278|
|company_business_sites|0|
|company_certifications|19|
|company_collection_state|1278|
|company_designations|9|
|company_detail_collection_state|755|
|company_disclosure_state|3|
|company_executives|34|
|company_factories|97|
|company_financial_statements|2625|
|company_histories|44|
|company_industries|1278|
|company_patents|0|
|company_section_collection_state|8963|
|company_source_business_sites|1023|
|company_source_certifications|366|
|company_source_designations|161|
|company_source_executives|1520|
|company_source_histories|1299|
|company_user_metadata|34|
|favorite_groups|5|
|industry_codes|2039|
|industry_master_refreshes|7|
|schema_migrations|8|
|target_collection_jobs|57|

## certification

원본: C:\Users\Manager1\AppData\Local\com.monaradar.certification\data\mona-radar-certification.sqlite

복사본: db_local\certification\mona-radar-certification.sqlite

|테이블·뷰|행 수|
|---|---:|
|certification_company_relations|0|
|certification_corrections|2|
|certification_detailed_item_evidence|0|
|certification_entities|0|
|certification_entity_matches|0|
|certification_identity_policies|23|
|certification_periods|0|
|certification_records|51045|
|certification_subjects|0|
|collection_diagnostics|32|
|collection_run_pages|1053|
|collection_runs|12|
|source_certification_code_mappings|23|

## live_legacy

원본: D:\work\mona-live\app\db\mona-live-bid-notice.sqlite

복사본: db_local\live\legacy\mona-live-bid-notice.sqlite

|테이블·뷰|행 수|
|---|---:|
|_cf_METADATA|1|
|d1_migrations|3|
|live_bid|9|
|live_scan_run|38|
|live_scan_schedule|1|
|live_scan_schedule_time|3|
|live_scan_target|6|