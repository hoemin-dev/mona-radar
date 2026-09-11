"""Market detail joins, ported from Local Market lib.rs; no collector writes."""
import json
from .db import rows


def parse_raw(value):
    try:
        parsed = json.loads(value or '{}')
        return parsed if isinstance(parsed, dict) else {}
    except (ValueError, TypeError):
        return {}


def present(value):
    return value is not None and str(value).strip() != ''


def pick(raw, *keys):
    return next((raw[k] for k in keys if present(raw.get(k))), None)


def source_raw(db, ident):
    found = rows(db, 'SELECT canonical_json FROM api_raw_item WHERE raw_item_id=?', [ident])
    return parse_raw(found[0]['canonical_json']) if found else {}


CONTRACT_RAW = {
    'contract_ref_no': ['cntrctRefNo'], 'unified_contract_no': ['untyCntrctNo'],
    'registered_at': ['rgstDt'], 'contract_period': ['cntrctPrd'], 'business_division_name': ['bsnsDivNm'],
    'total_contract_amount': ['totCntrctAmt'], 'base_law_name': ['baseLawNm'], 'base_details': ['baseDtls'],
    'payment_division_name': ['payDivNm'], 'long_term_continuation_division_name': ['lngtrmCtnuDivNm'],
    'common_contract_yn': ['cmmnCntrctYn'], 'guarantee_money_rate': ['grntymnyRate'],
    'delay_compensation_rate': ['dfrcmpnstRt'], 'contract_institution_code': ['cntrctInsttCd'],
    'contract_institution_division_name': ['cntrctInsttJrsdctnDivNm'], 'contract_department_name': ['cntrctInsttChrgDeptNm'],
    'contract_officer_name': ['cntrctInsttOfclNm'], 'contract_officer_tel_no': ['cntrctInsttOfclTelNo'],
    'contract_officer_fax_no': ['cntrctInsttOfclFaxNo'], 'creditor_name': ['crdtrNm'],
    'request_no': ['reqNo'], 'notice_no': ['ntceNo'], 'contract_detail_url': ['cntrctDtlInfoUrl'],
}


def corporations(raw):
    value = raw.get('corpList')
    if isinstance(value, str):
        if value.strip().startswith('[') and '^' in value:
            import re
            result = []
            for chunk in re.split(r'\]\s*,\s*\[', value.strip()[1:-1]):
                parts = chunk.split('^')
                fields = {key: parts[index].strip() if len(parts) > index else None for key, index in {
                    'sequence_no': 0, 'role_name': 1, 'participation_type_name': 2, 'corporation_name': 3,
                    'representative_name': 4, 'country_name': 5, 'share_rate': 6, 'business_registration_no': 9,
                }.items()}
                if fields['corporation_name']: result.append(fields)
            return result
        try: value = json.loads(value)
        except ValueError: return []
    if isinstance(value, dict): value = value.get('item', value.get('items', []))
    if isinstance(value, dict): value = [value]
    if not isinstance(value, list): return []
    return [dict(corporation_name=pick(c, 'corpNm', 'cntrctCorpNm', 'entrpsNm'),
                 business_registration_no=pick(c, 'bizno', 'corpBizno', 'cntrctCorpBizno'),
                 participation_type_name=pick(c, 'cmmnCntrctMthdNm', 'cmmnDprMthdNm', 'jointContractMethodName'),
                 share_rate=pick(c, 'cntrctShareRate', 'shareRate', 'jntcontrRate'))
            for c in value if isinstance(c, dict) and pick(c, 'corpNm', 'cntrctCorpNm', 'entrpsNm')]


def load_detail(db, ident, mode):
    table, key = {'bid': ('bid_notice', 'bid_notice_id'), 'award': ('award_result', 'award_result_id'),
                  'contract': ('contract_result', 'contract_result_id')}[mode]
    found = rows(db, f'SELECT * FROM {table} WHERE {key}=?', [ident])
    if not found: raise LookupError('항목을 찾을 수 없습니다.')
    record = found[0]
    result = {'mode': mode, 'record': record}
    if mode == 'bid':
        args = [record['bid_ntce_no'], record['bid_ntce_ord']]
        for name, table, order in [('items', 'bid_item', 'bid_item_id'), ('basis', 'bid_basis_amount', 'bid_basis_amount_id'),
                                  ('regions', 'bid_participation_region', 'limit_sequence,bid_participation_region_id'),
                                  ('licenses', 'bid_license_limit', 'limit_group_no,limit_sequence,bid_license_limit_id')]:
            result[name] = rows(db, f'SELECT * FROM {table} WHERE bid_ntce_no=? AND bid_ntce_ord=? ORDER BY {order}', args)
        for item in result['items']:
            raw = source_raw(db, item['source_raw_item_id'])
            category = rows(db, 'SELECT cmpnt_yn FROM catalog_item_category WHERE prdct_idnt_no=?', [raw.get('prdctIdntNo')])
            item['category'] = {'Y': 'part', 'N': 'product'}.get(category[0]['cmpnt_yn'] if category else None, 'unknown')
        raw = source_raw(db, record['source_raw_item_id'])
        result['conditions'] = {
            'award_criteria': pick(raw, 'sucsfbidMthdAplyStdCtn', 'sucsfbidMthdAplyStdCn', 'sucsfbidMthdAplyStd'),
            'consortium': pick(raw, 'cmmnSpldmdAgrmntRcptdocMethd', 'cmmnSpldmdAgrmntRcptdocMthd', 'cmmnSpldmdCnum'),
            'lower_limit_rate': pick(raw, 'sucsfbidLwltRate', '낙찰하한율'),
        }
    elif mode == 'award':
        args = [record[k] for k in ['bid_ntce_no', 'bid_ntce_ord', 'bid_clsfc_no', 'rbid_no']]
        where = 'bid_ntce_no=? AND bid_ntce_ord=? AND bid_clsfc_no=? AND rbid_no=?'
        result['participants'] = rows(db, f"SELECT *,COALESCE(NULLIF(remark,''),opening_result_type_name) result FROM opening_participant WHERE {where} ORDER BY CASE WHEN CAST(opening_rank AS INTEGER)>0 THEN CAST(opening_rank AS INTEGER) ELSE 2147483647 END,opening_participant_id", args)
        for name, table in [('preliminary', 'opening_preliminary_price'), ('failures', 'opening_failure_event'), ('rebids', 'opening_rebid_event')]:
            result[name] = rows(db, f'SELECT * FROM {table} WHERE {where} ORDER BY {table}_id', args)
    else:
        # Prefer an exact decision number; never join unrelated records on blank identities.
        headers = rows(db, '''SELECT * FROM contract_header WHERE
            (?1 IS NOT NULL AND trim(?1)<>'' AND decision_contract_no=?1) OR
            (?2 IS NOT NULL AND trim(?2)<>'' AND contract_ref_no=?2) OR
            (?3 IS NOT NULL AND trim(?3)<>'' AND unty_cntrct_no=?3)
            ORDER BY CASE WHEN decision_contract_no=?1 THEN 0 WHEN contract_ref_no=?2 THEN 1 ELSE 2 END,contract_header_id''',
            [record.get('decision_contract_no'), record.get('contract_ref_no') or record.get('decision_contract_no'),
             record.get('unified_contract_no') or record.get('contract_no')])
        raw = source_raw(db, record['source_raw_item_id'])
        if headers:
            header_raw = parse_raw(headers[0]['raw_json'])
            raw.update({k: v for k, v in header_raw.items() if present(v)})
        for field, keys in CONTRACT_RAW.items():
            if not present(record.get(field)): record[field] = pick(raw, *keys)
        result['corporations'] = rows(db, "SELECT * FROM contract_corporation WHERE contract_result_id=? ORDER BY CASE role_name WHEN '주계약업체' THEN 0 ELSE 1 END,sequence_no", [ident]) or corporations(raw)
        # Keep every header with the selected identity, not just the first header's items.
        if headers:
            primary = headers[0]
            if primary['decision_contract_no'] == record.get('decision_contract_no'):
                headers = [h for h in headers if h['decision_contract_no'] == record['decision_contract_no']]
            else:
                headers = [primary]
        result['items'] = []
        for header in headers:
            items = rows(db, '''SELECT i.*,c.lookup_status,a.canonical_json catalog_json,cat.cmpnt_yn
                FROM contract_item i LEFT JOIN contract_catalog_cache c ON c.product_identification_no=i.product_identification_no
                LEFT JOIN api_raw_item a ON c.lookup_status='FOUND' AND a.raw_item_id=c.source_raw_item_id
                LEFT JOIN catalog_item_category cat ON cat.prdct_idnt_no=i.product_identification_no
                WHERE i.contract_header_id=? ORDER BY i.contract_item_id''', [header['contract_header_id']])
            for item in items:
                catalog = parse_raw(item.pop('catalog_json')) if item['lookup_status'] == 'FOUND' else {}
                tokens = str(catalog.get('mnfctCorpNm') or '').split(',')
                item['catalog'] = {'manufacturer_name': tokens[1].strip() if len(tokens)>1 else None,
                    'model_name': tokens[2].strip() if len(tokens)>2 else None,
                    'detailed_product_class_no': catalog.get('dtilPrdctClsfcNo'), 'registration_no': catalog.get('prcrmntCorpRgstNo')}
                item['category'] = {'Y': 'part', 'N': 'product'}.get(item.pop('cmpnt_yn'), 'unknown')
                item_raw = parse_raw(item['raw_json'])
                for field, keys in {'unit': ['unit', 'unitNm', 'prdctUnit'], 'delivery_deadline': ['dlvrTmlmt', 'dlvrTmlmtDt'],
                                    'delivery_day_count': ['dlvrDaynum'], 'delivery_condition_name': ['dlvryCndtnNm'],
                                    'origin_name': ['orgplceNm'], 'delivery_place': ['dlvrPlce']}.items():
                    if not present(item.get(field)): item[field] = pick(item_raw, *keys)
            result['items'].extend(items)
    return result
