import json
from decimal import Decimal, InvalidOperation
from .db import connect, rows, paginate


RAW_FIELDS = {
    'total_order_amount': 'sumOrderAmt', 'contract_method': 'cntrctMthdNm',
    'product_class_name': 'prdctClsfcNoNm', 'product_class_code': 'prdctClsfcNo',
    'usage': 'usgCntnts', 'specification': 'specCntnts', 'quantity': 'qtyCntnts',
    'quantity_unit': 'unit', 'department': 'deptNm', 'official': 'ofclNm',
    'telephone': 'telNo', 'remarks': 'rmrkCntnts', 'bid_notice_numbers': 'bidNtceNoList',
    'detail_url': 'orderPlanDtlUrl', 'changed_date': 'chgDt',
    'notice_published_yn': 'ntceNticeYn', 'attachment_exists_yn': 'atchFileExistnceYn',
}


def enrich(record):
    """Expose retained API fields for old and new rows without rewriting source data."""
    record = dict(record)
    try:
        raw = json.loads(record.get('raw_json') or '{}')
    except (ValueError, TypeError):
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    for field, source in RAW_FIELDS.items():
        record[field] = raw.get(source) or None
    try:
        amount = Decimal(str(raw.get('sumOrderAmt', '')).replace(',', ''))
        record['total_order_amount'] = int(amount) if amount.is_finite() and amount == amount.to_integral_value() else None
    except (InvalidOperation, ValueError, TypeError):
        record['total_order_amount'] = None
    record.pop('raw_json', None)
    return record

def search(p):
    sql, args = 'SELECT p.* FROM order_plan p JOIN collection_target t ON t.id=p.target_id WHERE 1=1', []
    term = p.get('q','').replace(' ','')
    if term:
        sql += " AND (replace(coalesce(p.detail_product_name,''),' ','') LIKE ? OR replace(coalesce(p.business_name,''),' ','') LIKE ? OR replace(coalesce(p.order_institution_name,''),' ','') LIKE ?)"
        args.extend([term+'%']*3)
    if p.get('target'): sql += ' AND p.detail_product_code=?'; args.append(p['target'])
    if p.get('year'):
        year, period = int(p['year']), int(p.get('period') or 1)
        mode = p.get('mode', 'year')
        if mode not in ['year','half','quarter'] or not 2000 <= year <= 2200: raise ValueError('기간을 확인하세요.')
        size = {'year':12,'half':6,'quarter':3}[mode]
        if not 1 <= period <= 12//size: raise ValueError('기간을 확인하세요.')
        start = (period-1)*size+1
        sql += " AND (p.order_year||'-'||printf('%02d',cast(p.order_month as integer))) BETWEEN ? AND ?"
        args.extend([f'{year}-{start:02}', f'{year}-{start+size-1:02}'])
    if p.get('category') in ['product','part']: sql += ' AND p.cmpnt_yn=?'; args.append('N' if p['category']=='product' else 'Y')
    sql += " ORDER BY coalesce(p.notice_date,'') DESC,p.id DESC"
    with connect('forecast') as db:
        result = paginate(db, sql, args, p.get('page'), 100)
        result['rows'] = [enrich(row) for row in result['rows']]
        return result

def options():
    with connect('forecast') as db:
        return {'targets': rows(db,'SELECT detail_product_code id,detail_product_name name FROM collection_target ORDER BY detail_product_name COLLATE NOCASE,detail_product_code'), 'years': [r[0] for r in db.execute("SELECT DISTINCT order_year FROM order_plan WHERE order_year IS NOT NULL AND order_year<>'' ORDER BY 1 DESC")]}

def latest(limit=5):
    with connect('forecast') as db:
        records = rows(db,"SELECT * FROM order_plan ORDER BY coalesce(notice_date,'') DESC,id DESC LIMIT ?",[limit])
        return [dict(id=r['id'], name=r['business_name'], institution=r['order_institution_name'], date=r['notice_date'], amount=enrich(r)['total_order_amount']) for r in records]

def detail(ident):
    with connect('forecast') as db:
        found = rows(db,'SELECT * FROM order_plan WHERE id=?',[ident])
        if not found: raise LookupError('발주계획을 찾을 수 없습니다.')
        return {'record': enrich(found[0])}
