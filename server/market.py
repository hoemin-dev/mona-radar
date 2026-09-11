import json
from .db import connect, rows, query_file, integer

CLASSES = query_file('market_classifications.sql')
CONTEXT = CLASSES + ', target_registry AS (SELECT target_code,target_name,target_level FROM collection_target), target_membership AS (SELECT entity_type domain,entity_id source_id,target_code FROM entity_collection_target)'
MODES = ['bid','award','contract','integrated']
FIELDS = ['id','date','name','demandInstitution','productClassNo','productClassName','productCategory','winnerName','awardAmount','awardRate','contractName','contractAmount','bidCount','awardCount','contractCount','matchStatus']
AWARD_FIELDS = ['id','bidNo','bidOrd','name','productClassNo','winnerName','winnerBusinessNo','winnerCeoName','winnerAddress','winnerTelNo','awardAmount','awardRate','demandInstitution','demandInstitutionCode','date','participantCount','productClassName','productCategory','productCategorySource']

def classification(p):
    parent,detail = p.get('classification',''),p.get('detail','')
    if parent and (len(parent)!=8 or not parent.isascii() or not parent.isdigit()): raise ValueError('품명번호는 숫자 8자리입니다.')
    if detail and (len(detail)!=10 or not detail.isascii() or not detail.isdigit()): raise ValueError('세부품명번호는 숫자 10자리입니다.')
    if parent and detail and not detail.startswith(parent): raise ValueError('품명번호와 세부품명번호가 일치하지 않습니다.')
    return parent,detail

def search(p):
    mode = p.get('mode','bid')
    category = p.get('category','all') or 'all'
    if mode not in MODES or category not in ['all','product','part']: raise ValueError('검색 구분을 확인하세요.')
    parent, detail_no = classification(p)
    targets = [x for x in p.get('target','').split(',') if x]
    if any(len(t) not in [8,10] or not t.isascii() or not t.isdigit() for t in targets): raise ValueError('Target 번호를 확인하세요.')
    target_json=json.dumps(sorted(set(targets)))
    limit=integer(p.get('limit'),300,500)
    q=p.get('q','').strip(); pattern='%'+q+'%'; start=p.get('from',''); end=p.get('to',''); institution=p.get('institution','').strip()
    sql=query_file(f'market_{mode}.sql')
    context=CONTEXT
    if mode=='award':
        winner=p.get('winner','').strip(); product=p.get('product','').strip(); code=p.get('productCode','').strip()
        numeric=lambda key,cast: cast(p[key]) if p.get(key) else None
        args=[q,pattern,start,end,numeric('amountMin',int),numeric('amountMax',int),numeric('rateMin',float),numeric('rateMax',float),winner,'%'+winner+'%',institution,'%'+institution+'%',category,product,'%'+product+'%',code,'%'+code+'%',limit+1,parent,detail_no,target_json]
    else:
        relation={'bid':"sc.domain='BID' AND sc.source_id=b.bid_notice_id",'contract':"sc.domain='CONTRACT' AND sc.source_id=c.contract_result_id",'integrated':"EXISTS(SELECT 1 FROM procurement_group_member m WHERE m.procurement_group_id=procurement_group.procurement_group_id AND m.source_type=sc.domain AND m.source_id=sc.source_id)"}[mode]
        date,inst={'bid':('b.notice_posted_local','b.demand_institution_name'),'contract':('c.contract_date',"COALESCE(c.demand_institution_name,'')||' '||COALESCE(c.contract_institution_name,'')"),'integrated':('representative_date','demand_institution_name')}[mode]
        target_relation=relation.replace('sc.','tm.')
        predicate=f" AND EXISTS(SELECT 1 FROM target_membership tm WHERE ({target_relation}) AND (?11='[]' OR tm.target_code IN (SELECT value FROM json_each(?11)))) AND ((?5='' AND ?6='') OR EXISTS(SELECT 1 FROM search_classes sc WHERE ({relation}) AND (?5='' OR sc.classification_no=?5) AND (?6='' OR sc.detailed_no=?6))) AND (?7='' OR substr({date},1,10)>=?7) AND (?8='' OR substr({date},1,10)<=?8) AND (?9='' OR {inst} LIKE ?10) "
        position=sql.rindex(' ORDER BY ')
        sql=sql[:position]+predicate+sql[position:]
        if mode=='contract': context+=', contract_search_headers AS MATERIALIZED (SELECT contract_header_id,decision_contract_no FROM contract_header)'
        args=[q,pattern,category,limit+1,parent,detail_no,start,end,institution,'%'+institution+'%',target_json]
    with connect('market') as db:
        result=[dict(zip(AWARD_FIELDS if mode=='award' else FIELDS,row)) for row in db.execute(context+' '+sql,args)]
    return {'rows':result[:limit],'total':None,'returned':min(len(result),limit),'hasMore':len(result)>limit,'limit':limit,'page':1,'totalPages':1,'countKind':'bounded'}

def options():
    with connect('market') as db:
        return {'targets':rows(db,'SELECT target_code id,MIN(target_name) name,target_level level FROM collection_target GROUP BY target_code,target_level ORDER BY name,id')}

def latest(mode='bid',limit=5):
    table,key,date,title,institution,amount={
        'bid':('bid_notice','bid_notice_id','notice_posted_local','bid_ntce_name','demand_institution_name','allocated_budget_amount'),
        'award':('award_result','award_result_id','real_opening_local','bid_ntce_name','demand_institution_name','successful_bid_amount'),
        'contract':('contract_result','contract_result_id','contract_date','contract_name',"COALESCE(NULLIF(demand_institution_name,''),contract_institution_name)",'contract_amount'),
    }[mode]
    company={
        'bid':"NULL",
        'award':"t.winner_name",
        'contract':"(SELECT corporation_name FROM contract_corporation c WHERE c.contract_result_id=t.contract_result_id ORDER BY CASE role_name WHEN '주계약업체' THEN 0 ELSE 1 END,sequence_no LIMIT 1)",
    }[mode]
    with connect('market') as db:
        return rows(db,f"SELECT {key} id,{date} date,{title} name,{institution} institution,{amount} amount,{company} winnerName FROM {table} t WHERE EXISTS(SELECT 1 FROM entity_collection_target m WHERE m.entity_type=? AND m.entity_id=t.{key}) ORDER BY {date} DESC,{key} DESC LIMIT ?",[mode.upper(),limit])

def detail(ident,mode='bid'):
    if mode in ['bid', 'award', 'contract']:
        from .market_detail import load_detail
        with connect('market') as db:
            return load_detail(db, ident, mode)
    table,key={'bid':('bid_notice','bid_notice_id'),'award':('award_result','award_result_id'),'contract':('contract_result','contract_result_id'),'integrated':('procurement_group','procurement_group_id')}[mode]
    with connect('market') as db:
        found=rows(db,f'SELECT * FROM {table} WHERE {key}=?',[ident])
        if not found: raise LookupError('항목을 찾을 수 없습니다.')
        record=found[0]; result={'record':record}
        return result
