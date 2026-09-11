from .db import connect, rows, query_file, integer

WHERE = query_file('facility_where.sql')
PROJECTION = query_file('category_projection.sql')
TEMPLATE = query_file('category_search.sql')
CATEGORIES = {'PUBLIC_SEWAGE':'공공하수','SEWAGE_SLUDGE':'하수찌꺼기','INCINERATION':'소각·자원회수','FOOD_WASTE':'음식물','PUBLIC_WASTEWATER':'공공폐수','LIVESTOCK_MANURE':'가축분뇨','SEPTAGE':'분뇨','WATER_TREATMENT':'정수','LANDFILL':'매립'}
KEYS = ['facilityId','name','facilityType','province','city','address','primaryCapacityValue','primaryCapacityUnit','facilityStatus','confidenceStatus','organizations','categories','reviewStatus','jurisdiction','statusRaw','primaryCapacityType']

def search(p, size=30):
    args = ['%'+p.get('q','').strip()+'%', p.get('type',''),p.get('province',''),p.get('city',''),p.get('district',''),p.get('organization',''),p.get('status',''),p.get('inactive')=='1']
    order = ('' if args[1] else 'category_rank ASC,') + 'capacity_value IS NULL,capacity_value ' + ('ASC' if p.get('sort')=='capacity_asc' else 'DESC') + ',f.canonical_name COLLATE NOCASE,f.facility_id'
    sql = TEMPLATE.replace('{where_sql}',WHERE).replace('{projection}',PROJECTION).replace('{order_sql}',order)
    with connect('facility') as db:
        total = db.execute('SELECT COUNT(*) FROM facility f WHERE '+WHERE,args).fetchone()[0]
        pages = max(1,(total+size-1)//size); page = min(integer(p.get('page')),pages)
        result = [dict(zip(KEYS,row)) for row in db.execute(sql,[*args,size,(page-1)*size])]
        return {'rows':result,'total':total,'page':page,'totalPages':pages,'pageSize':size,'countKind':'exact'}

def options():
    with connect('facility') as db:
        return {'types':[{'id':r[0],'name':CATEGORIES.get(r[0],r[0])} for r in db.execute('SELECT category_type FROM facility_category_priority ORDER BY merge_priority')], 'provinces':[r[0] for r in db.execute("SELECT DISTINCT province_normalized FROM facility_location WHERE province_normalized IS NOT NULL ORDER BY province_normalized")], 'regions':rows(db,"SELECT DISTINCT province_normalized province,city_county_normalized city,district_normalized district FROM facility_location WHERE province_normalized IS NOT NULL ORDER BY province,city,district")}

def top10():
    result=[]
    for category in list(CATEGORIES)[:4]:
        found=[r for r in search({'type':category},10)['rows'] if r['primaryCapacityValue'] is not None and r['primaryCapacityValue']>0]
        total=sum(r['primaryCapacityValue'] for r in found)
        result.append({'category':category,'label':CATEGORIES[category],'total':total,'unit':found[0]['primaryCapacityUnit'] if found else None,'basis':'DESIGN','rows':[{**row,'proportion':row['primaryCapacityValue']/total} for row in found]})
    return result

def detail(ident):
    import json
    import uuid
    from pathlib import Path
    queries = json.loads((Path(__file__).parent / 'queries/facility_detail.json').read_text(encoding='utf-8'))
    with connect('facility') as db:
        ident = db.execute('SELECT COALESCE((SELECT master_facility_id FROM logical_facility_member WHERE member_facility_id=?1),?1)', [ident]).fetchone()[0]
        found = db.execute(queries['facility'], [ident]).fetchone()
        if not found:
            raise LookupError('시설을 찾을 수 없습니다.')
        facility = dict(zip(['facilityId', 'name', 'facilityType', 'subtype', 'status', 'statusRaw', 'primaryCapacityValue', 'primaryCapacityUnit', 'primaryCapacityType', 'commissioningDate', 'completionDate', 'closureDate', 'publicPrivate', 'confidenceStatus', 'mergeStatus', 'address', 'province', 'city', 'district', 'provinceRaw', 'cityRaw', 'districtRaw', 'jurisdiction'], found))
        data = {key: rows(db, sql, [ident]) for key, sql in queries.items() if key not in ('facility', 'provenance')}
        data['facility'] = facility
        # Retain the original response record for consumers outside the detail view.
        data['record'] = rows(db, 'SELECT * FROM facility WHERE facility_id=?', [ident])[0]
        data['categoryPriority'] = rows(db, 'SELECT category_type,merge_priority FROM facility_category_priority ORDER BY merge_priority')
        data['categoryContexts'] = rows(db, 'WITH scope(facility_id) AS (SELECT ?1), '+PROJECTION+ ' SELECT * FROM category_context', [ident, ''])
        provenance = {str(uuid.uuid5(uuid.NAMESPACE_URL, 'mona-radar-facility:observation-master:'+r['observation_candidate_id'])): r['metric_key_raw'] for r in rows(db, queries['provenance'], [ident])}
        for row in data['observations']:
            if row['observation_id'] in provenance:
                row['metric_key_raw'] = provenance[row['observation_id']]
        return data
