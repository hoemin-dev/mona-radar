from .db import connect, rows, paginate, query_file

EFFECTIVE = query_file('certification_effective.sql')
STATUS = "CASE WHEN is_unlimited_end_date=1 OR is_currently_valid=1 THEN 'current' WHEN historical_certification=1 THEN 'historical' ELSE 'unknown' END"

def preferred_run(db):
    for sql in ["SELECT id FROM collection_runs WHERE status='completed' AND source_mode LIKE 'production%' ORDER BY id DESC LIMIT 1", "SELECT id FROM collection_runs WHERE status='completed' ORDER BY id DESC LIMIT 1", "SELECT id FROM collection_runs ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'interrupted' THEN 1 ELSE 2 END,id DESC LIMIT 1"]:
        row = db.execute(sql).fetchone()
        if row: return row[0]
    return -1

def search(p):
    with connect('certification') as db:
        run = preferred_run(db)
        where, args = ['run_id=?'], [run]
        for key, field in [('q','effective_company_name'),('number','certification_no'),('subject','effective_product_name')]:
            if p.get(key): where.append(field+' LIKE ?'); args.append('%'+p[key].strip()+'%')
        if p.get('type'): where.append('certification_type=?'); args.append(p['type'])
        statuses = {'current': '(is_unlimited_end_date=1 OR is_currently_valid=1)', 'historical': '(is_unlimited_end_date=0 AND is_currently_valid IS NOT 1 AND historical_certification=1)', 'unlimited': 'is_unlimited_end_date=1', 'unknown': '(is_unlimited_end_date=0 AND is_currently_valid IS NOT 1 AND historical_certification IS NOT 1)'}
        if p.get('status') in statuses: where.append(statuses[p['status']])
        base = " FROM effective_records WHERE " + ' AND '.join(where)
        sql = EFFECTIVE + f" SELECT id,certification_type,certification_no,effective_company_name company_name,effective_product_name product_name,certification_start_date,certification_end_date,is_unlimited_end_date,{STATUS} status,company_name_corrected,product_name_corrected" + base + ' ORDER BY certification_type,effective_company_name,certification_no'
        result = paginate(db, sql, args, p.get('page'), 50, EFFECTIVE + ' SELECT COUNT(*)'+base)
        result['runId'] = run
        return result

def options():
    with connect('certification') as db:
        return {'types': [r[0] for r in db.execute('SELECT DISTINCT certification_type FROM certification_records WHERE run_id=? ORDER BY certification_type COLLATE NOCASE', [preferred_run(db)])]}

def detail(ident):
    with connect('certification') as db:
        found = rows(db, EFFECTIVE + f' SELECT *,{STATUS} status FROM effective_records WHERE id=? AND run_id=?', [ident, preferred_run(db)])
        if not found: raise LookupError('인증을 찾을 수 없습니다.')
        return {'record': found[0]}
