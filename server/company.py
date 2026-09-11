from .db import connect, rows, paginate, camel

NAME = "trim(replace(replace(replace(c.company_name,'(주)',''),'㈜',''),'주식회사',''))"
NAME_ORDER = f"CASE WHEN substr({NAME},1,1) BETWEEN '가' AND '힣' THEN 0 WHEN lower(substr({NAME},1,1)) BETWEEN 'a' AND 'z' THEN 1 ELSE 2 END, {NAME} COLLATE NOCASE, c.company_name COLLATE NOCASE"
BASE = """SELECT c.*,latest.fiscal_year,latest.total_assets_krw_million,latest.revenue_krw_million,
 latest.operating_income_krw_million,latest.net_income_krw_million,
 um.favorite_color,um.memo,um.classification,d.disclosure_status, EXISTS(SELECT 1 FROM app_our_company oc WHERE oc.company_id=c.company_id) is_our_company
 FROM companies c LEFT JOIN company_financial_statements latest ON latest.company_id=c.company_id
 AND latest.fiscal_year=(SELECT MAX(fiscal_year) FROM company_financial_statements WHERE company_id=c.company_id)
 LEFT JOIN company_user_metadata um ON um.company_id=c.company_id
 LEFT JOIN company_disclosure_state d ON d.company_id=c.company_id"""

def search(p):
    pattern = '%' + p.get('q', '').strip() + '%'
    fields = ['company_name','business_number','main_products','address','road_address','industry_name','representative_name']
    where = '(' + ' OR '.join(f"IFNULL(c.{field},'') LIKE ?" for field in fields) + ')'
    args = [pattern] * len(fields)
    if p.get('industry'):
        where += ' AND c.industry_name=?'; args.append(p['industry'])
    if p.get('target'):
        where += ' AND EXISTS(SELECT 1 FROM company_industries ci WHERE ci.company_id=c.company_id AND ci.target_id=?)'; args.append(p['target'])
    if p.get('favorite'):
        colors = p['favorite'].split(',')
        if len(colors) > 3 or any(c not in ['FAVORITES','RED','YELLOW','GREEN','BLUE','PURPLE'] for c in colors):
            raise ValueError('즐겨찾기 필터를 확인하세요.')
        where += ' AND (um.favorite_color IS NOT NULL)' if 'FAVORITES' in colors else ' AND um.favorite_color IN (' + ','.join('?' for _ in colors) + ')'
        if 'FAVORITES' not in colors: args.extend(colors)
    classified = p.get('classified') == '1'
    if classified: where += " AND TRIM(IFNULL(um.classification,''))<>''"
    order = {'revenue-desc': 'latest.revenue_krw_million IS NULL,latest.revenue_krw_million DESC,', 'recent-desc': 'c.last_collected_at IS NULL,c.last_collected_at DESC,'}.get(p.get('sort'), '') + NAME_ORDER
    if classified: order = 'um.classification COLLATE NOCASE,' + order
    with connect('company') as db:
        result = paginate(db, BASE + ' WHERE ' + where + ' ORDER BY ' + order, args, p.get('page'), 10)
    result['rows'] = [camel(row) for row in result['rows']]
    return result

def options():
    with connect('company') as db:
        return {"ourCompany": next(iter([camel(r) for r in rows(db, BASE + " WHERE c.company_id=(SELECT company_id FROM app_our_company WHERE singleton=1)")]), None), "favoriteGroups": rows(db,"SELECT color,name FROM favorite_groups"), "industries": rows(db, "SELECT DISTINCT industry_name id,industry_name name FROM companies WHERE industry_name IS NOT NULL ORDER BY industry_name COLLATE NOCASE"), "targets": rows(db, "SELECT t.target_id id,COALESCE(t.industry_name,t.search_keyword) name,COUNT(ci.company_id) count FROM collector_targets t JOIN company_industries ci ON ci.target_id=t.target_id GROUP BY t.target_id ORDER BY name COLLATE NOCASE")}

def detail(ident):
    with connect('company') as db:
        found = rows(db, BASE + ' WHERE c.company_id=?', [ident])
        if not found: raise LookupError('기업을 찾을 수 없습니다.')
        result = {'company': camel(found[0])}
        sections = {
            'financialStatements': "SELECT fiscal_year fiscalYear,total_assets_krw_million totalAssets,revenue_krw_million revenue,operating_income_krw_million operatingIncome,net_income_krw_million netIncome FROM company_financial_statements WHERE company_id=? ORDER BY fiscal_year DESC",
            'businessSites': 'SELECT site_name siteName,site_address address FROM company_source_business_sites WHERE company_id=? ORDER BY source_ordinal',
            'histories': 'SELECT event_date eventDate,description FROM company_source_histories WHERE company_id=? ORDER BY source_ordinal',
        }
        for key, table in [('executives','company_source_executives'),('certifications','company_source_certifications'),('designations','company_source_designations'),('factories','company_factories'),('patents','company_patents')]:
            sections[key] = f'SELECT * FROM {table} WHERE company_id=? ORDER BY source_ordinal'
        for key, sql in sections.items(): result[key] = rows(db, sql, [ident])
        return result


COLORS = ['RED','YELLOW','GREEN','BLUE','PURPLE']

def save_metadata(payload):
    import sqlite3
    from contextlib import closing
    from .db import ROOT, FILES
    ident = payload.get('companyId')
    with closing(sqlite3.connect((ROOT / 'db_local' / FILES['company']).as_uri() + '?mode=rw', uri=True)) as db, db:
        db.execute('PRAGMA foreign_keys=ON')
        if payload.get('action') == 'groups':
            groups = payload.get('groups', [])
            if len(groups) != 5 or {g.get('color') for g in groups} != set(COLORS): raise ValueError('즐겨찾기 그룹을 확인하세요.')
            for g in groups:
                if not isinstance(g.get('name'), str) or len(g['name']) > 30: raise ValueError('그룹 이름은 최대 30자입니다.')
                db.execute("UPDATE favorite_groups SET name=?,updated_at=datetime('now') WHERE color=?", (g['name'].strip(),g['color']))
        else:
            if not db.execute('SELECT 1 FROM companies WHERE company_id=?',(ident,)).fetchone(): raise ValueError('기업을 찾을 수 없습니다.')
            if payload.get('action') == 'our':
                if payload.get('enabled'):
                    current=db.execute('SELECT company_id FROM app_our_company WHERE singleton=1').fetchone()
                    if current and current[0] != ident: raise ValueError('기존 우리회사 지정을 먼저 해제하세요.')
                    db.execute("INSERT INTO app_our_company VALUES(1,?,datetime('now')) ON CONFLICT(singleton) DO UPDATE SET company_id=excluded.company_id,updated_at=excluded.updated_at",(ident,))
                else: db.execute('DELETE FROM app_our_company WHERE company_id=?',(ident,))
            else:
                color=payload.get('favoriteColor') or None
                memo=payload.get('memo',''); classification=payload.get('classification','')
                if color not in [None,*COLORS] or not isinstance(memo,str) or not isinstance(classification,str) or len(memo)>40 or len(classification)>10: raise ValueError('분류(10자), 메모(40자), 즐겨찾기 색상을 확인하세요.')
                if color and db.execute('SELECT 1 FROM app_our_company WHERE company_id=?',(ident,)).fetchone(): raise ValueError('우리회사는 즐겨찾기와 별도로 관리합니다.')
                db.execute("INSERT INTO company_user_metadata(company_id,is_favorite,favorite_color,memo,classification,created_at,updated_at) VALUES(?,?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(company_id) DO UPDATE SET is_favorite=excluded.is_favorite,favorite_color=excluded.favorite_color,memo=excluded.memo,classification=excluded.classification,updated_at=excluded.updated_at",(ident,int(bool(color)),color,memo.strip(),classification.strip()))
    return {'saved': True}
