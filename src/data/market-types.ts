// Actual Market SQLite columns. Detail payloads remain distinct by procurement stage.
export type Value = string | number | null;

export interface BidNotice {
  bid_notice_id: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  bid_ntce_name: Value;
  notice_kind_name: Value;
  registration_type_name: Value;
  reference_no: Value;
  notice_institution_code: Value;
  notice_institution_name: Value;
  demand_institution_code: Value;
  demand_institution_name: Value;
  contract_method_name: Value;
  bid_method_name: Value;
  award_method_code: Value;
  award_method_name: Value;
  notice_posted_raw: Value;
  notice_posted_local: Value;
  bid_begin_raw: Value;
  bid_begin_local: Value;
  bid_close_raw: Value;
  bid_close_local: Value;
  opening_raw: Value;
  opening_local: Value;
  registered_raw: Value;
  registered_local: Value;
  changed_raw: Value;
  changed_local: Value;
  detailed_product_class_no: Value;
  detailed_product_class_name: Value;
  product_quantity: Value;
  product_unit: Value;
  product_unit_price: Value;
  product_specification: Value;
  purchase_product_list_raw: Value;
  allocated_budget_amount: Value;
  estimated_price: Value;
  vat_amount: Value;
  industry_vat_amount: Value;
  international_bid_yn: Value;
  re_notice_yn: Value;
  rebid_permitted_yn: Value;
  manufacture_yn: Value;
  designated_competition_yn: Value;
  product_class_limit_yn: Value;
  notice_url: Value;
  notice_detail_url: Value;
  standard_notice_document_url: Value;
  source_raw_item_id: Value;
  source_operation: Value;
  semantic_row_hash: Value;
  semantic_state_json: Value;
  parse_warnings_json: Value;
  first_normalized_at: Value;
  last_normalized_at: Value;
}

export interface BidItem {
  bid_item_id: Value;
  bid_notice_id: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  bid_clsfc_no: Value;
  product_seq: Value;
  demand_institution_code: Value;
  demand_institution_name: Value;
  product_class_no: Value;
  product_class_name: Value;
  detailed_product_class_no: Value;
  detailed_product_class_name: Value;
  product_specification: Value;
  quantity: Value;
  unit: Value;
  unit_price: Value;
  delivery_deadline_raw: Value;
  delivery_deadline_local: Value;
  delivery_day_count: Value;
  delivery_place: Value;
  delivery_condition_name: Value;
  notice_posted_raw: Value;
  notice_posted_local: Value;
  source_raw_item_id: Value;
  source_operation: Value;
  semantic_row_hash: Value;
  semantic_state_json: Value;
  parse_warnings_json: Value;
  first_normalized_at: Value;
  last_normalized_at: Value;
  category: Value;
}

export interface BidBasis {
  bid_basis_amount_id: Value;
  bid_notice_id: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  bid_clsfc_no: Value;
  bid_ntce_name: Value;
  basis_amount: Value;
  basis_amount_open_raw: Value;
  basis_amount_open_local: Value;
  reserve_price_range_begin_rate: Value;
  reserve_price_range_end_rate: Value;
  evaluation_basis_amount: Value;
  difficulty_coefficient: Value;
  other_general_expense_basis_rate: Value;
  general_management_cost_basis_rate: Value;
  profit_basis_rate: Value;
  labor_cost_basis_rate: Value;
  industrial_safety_health_management_cost: Value;
  retirement_mutual_aid: Value;
  environmental_conservation_cost: Value;
  subcontract_payment_guarantee_fee: Value;
  health_insurance_premium: Value;
  national_pension_premium: Value;
  remark1: Value;
  remark2: Value;
  useful_amount: Value;
  input_raw: Value;
  input_local: Value;
  source_raw_item_id: Value;
  source_operation: Value;
  semantic_row_hash: Value;
  semantic_state_json: Value;
  parse_warnings_json: Value;
  first_normalized_at: Value;
  last_normalized_at: Value;
}

export interface BidRegion {
  bid_participation_region_id: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  limit_sequence: Value;
  participation_region_name: Value;
  registered_at: Value;
  item_fingerprint: Value;
  source_raw_item_id: Value;
  observed_at: Value;
}

export interface BidLicense {
  bid_license_limit_id: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  limit_group_no: Value;
  limit_sequence: Value;
  license_limit_name: Value;
  allowed_industry_list: Value;
  registered_at: Value;
  item_fingerprint: Value;
  source_raw_item_id: Value;
  observed_at: Value;
}

export interface AwardRecord {
  award_result_id: Value;
  bid_notice_id: Value;
  target_detailed_product_class_no: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  bid_clsfc_no: Value;
  rbid_no: Value;
  notice_division_code: Value;
  bid_ntce_name: Value;
  participant_count: Value;
  winner_name: Value;
  winner_business_no: Value;
  winner_ceo_name: Value;
  winner_address: Value;
  winner_tel_no: Value;
  successful_bid_amount: Value;
  successful_bid_rate: Value;
  real_opening_raw: Value;
  real_opening_local: Value;
  demand_institution_code: Value;
  demand_institution_name: Value;
  registered_raw: Value;
  registered_local: Value;
  final_successful_date: Value;
  winner_official: Value;
  source_raw_item_id: Value;
  source_operation: Value;
  semantic_row_hash: Value;
  semantic_state_json: Value;
  parse_warnings_json: Value;
  first_normalized_at: Value;
  last_normalized_at: Value;
}

export interface Participant {
  opening_participant_id: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  bid_clsfc_no: Value;
  rbid_no: Value;
  opening_result_type_name: Value;
  opening_rank: Value;
  bidder_business_no: Value;
  bidder_name: Value;
  bidder_ceo_name: Value;
  bid_amount: Value;
  bid_rate: Value;
  remark: Value;
  draw_no_1: Value;
  draw_no_2: Value;
  bid_datetime: Value;
  item_fingerprint: Value;
  source_raw_item_id: Value;
  observed_at: Value;
  result: Value;
}

export interface Preliminary {
  opening_preliminary_price_id: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  bid_clsfc_no: Value;
  rbid_no: Value;
  planned_price: Value;
  basis_amount: Value;
  total_preliminary_price_count: Value;
  preliminary_price_sequence: Value;
  preliminary_price: Value;
  selected_yn: Value;
  selected_count: Value;
  actual_opening_datetime: Value;
  upper_count_from_basis_amount: Value;
  preliminary_price_created_datetime: Value;
  item_fingerprint: Value;
  source_raw_item_id: Value;
  observed_at: Value;
}

export interface Failure {
  opening_failure_event_id: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  bid_clsfc_no: Value;
  rbid_no: Value;
  opening_result_type_name: Value;
  failure_reason: Value;
  item_fingerprint: Value;
  source_raw_item_id: Value;
  observed_at: Value;
}

export interface Rebid {
  opening_rebid_event_id: Value;
  bid_ntce_no: Value;
  bid_ntce_ord: Value;
  bid_clsfc_no: Value;
  rbid_no: Value;
  opening_result_type_name: Value;
  bid_deadline_datetime: Value;
  opening_datetime: Value;
  rebid_reason: Value;
  consortium_agreement_deadline_datetime: Value;
  item_fingerprint: Value;
  source_raw_item_id: Value;
  observed_at: Value;
}

export interface ContractRecord {
  contract_result_id: Value;
  target_detailed_product_class_no: Value;
  decision_contract_no: Value;
  contract_no: Value;
  contract_name: Value;
  contract_method_name: Value;
  contract_institution_name: Value;
  demand_institution_name: Value;
  contract_amount: Value;
  contract_date: Value;
  contract_detail_url: Value;
  source_raw_item_id: Value;
  source_operation: Value;
  semantic_row_hash: Value;
  semantic_state_json: Value;
  parse_warnings_json: Value;
  first_normalized_at: Value;
  last_normalized_at: Value;
  contract_ref_no: Value;
  unified_contract_no: Value;
  registered_at: Value;
  business_division_name: Value;
  total_contract_amount: Value;
  contract_period: Value;
  contract_info_url: Value;
  base_law_name: Value;
  base_details: Value;
  payment_division_name: Value;
  long_term_continuation_division_name: Value;
  common_contract_yn: Value;
  guarantee_money_rate: Value;
  delay_compensation_rate: Value;
  contract_institution_code: Value;
  contract_institution_division_name: Value;
  contract_department_name: Value;
  contract_officer_name: Value;
  contract_officer_tel_no: Value;
  contract_officer_fax_no: Value;
  creditor_name: Value;
  information_business_yn: Value;
  request_no: Value;
  notice_no: Value;
}

export interface Corporation {
  contract_corporation_id: Value;
  contract_result_id: Value;
  sequence_no: Value;
  role_name: Value;
  participation_type_name: Value;
  corporation_name: Value;
  representative_name: Value;
  country_name: Value;
  share_rate: Value;
  display_name: Value;
  extra_value: Value;
  business_registration_no: Value;
  source_value: Value;
}

export interface ContractItem {
  contract_item_id: Value;
  contract_header_id: Value;
  source_fingerprint: Value;
  unty_cntrct_no: Value;
  decision_contract_no: Value;
  contract_ref_no: Value;
  product_class_no: Value;
  product_identification_no: Value;
  product_class_name: Value;
  korean_product_name: Value;
  quantity: Value;
  unit_price_amount: Value;
  product_amount: Value;
  target_detailed_product_class_no: Value;
  resolution_status: Value;
  resolution_reason: Value;
  source_raw_item_id: Value;
  source_operation: Value;
  raw_json: Value;
  first_seen_at: Value;
  updated_at: Value;
  delivery_day_count: Value;
  delivery_deadline: Value;
  delivery_condition_code: Value;
  delivery_condition_name: Value;
  origin_code: Value;
  origin_name: Value;
  registered_at: Value;
  category: Value;
  unit: Value;
  delivery_place: Value;
  lookup_status: Value;
  catalog: Catalog;
}

export interface Catalog { manufacturer_name: Value; model_name: Value; detailed_product_class_no: Value; registration_no: Value; }
export interface BidConditions { award_criteria: Value; consortium: Value; lower_limit_rate: Value; }
export interface BidDetail { mode: "bid"; record: BidNotice; items: BidItem[]; basis: BidBasis[]; regions: BidRegion[]; licenses: BidLicense[]; conditions: BidConditions; }
export interface AwardDetail { mode: "award"; record: AwardRecord; participants: Participant[]; preliminary: Preliminary[]; failures: Failure[]; rebids: Rebid[]; }
export interface ContractDetail { mode: "contract"; record: ContractRecord; corporations: Corporation[]; items: ContractItem[]; }
export type MarketDetail = BidDetail | AwardDetail | ContractDetail;
