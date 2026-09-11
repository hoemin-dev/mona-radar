"""Offline Market detail regressions: real schema, in-memory fixtures, read-only snapshot."""
import json
import sqlite3
import unittest
from server.db import connect
from server.market_detail import load_detail, corporations
from server import market

TABLES = ['api_raw_item','bid_notice','bid_item','bid_basis_amount','bid_participation_region','bid_license_limit',
          'catalog_item_category','award_result','opening_participant','opening_preliminary_price','opening_failure_event',
          'opening_rebid_event','contract_result','contract_header','contract_item','contract_corporation','contract_catalog_cache']

class MarketDetailTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row
        with connect('market') as source:
            for table in TABLES:
                columns=[r['name'] for r in source.execute(f'PRAGMA table_info({table})')]
                self.db.execute(f'CREATE TABLE {table} ({",".join(columns)})')
    def tearDown(self): self.db.close()
    def put(self,table,**values):
        self.db.execute(f'INSERT INTO {table} ({",".join(values)}) VALUES ({",".join("?" for _ in values)})',list(values.values()))
    def test_bid_raw_conditions_and_order_isolation(self):
        self.put('bid_notice',bid_notice_id=1,bid_ntce_no='B',bid_ntce_ord='00',source_raw_item_id=5)
        self.put('api_raw_item',raw_item_id=5,canonical_json=json.dumps({'sucsfbidMthdAplyStdCn':'기준','sucsfbidLwltRate':0}))
        for order in ['00','01']:
            self.put('bid_item',bid_item_id=1,bid_ntce_no='B',bid_ntce_ord=order,quantity=3,source_raw_item_id=6)
            self.put('bid_participation_region',bid_ntce_no='B',bid_ntce_ord=order,participation_region_name=order)
            self.put('bid_license_limit',bid_ntce_no='B',bid_ntce_ord=order,license_limit_name=order)
        self.put('api_raw_item',raw_item_id=6,canonical_json='{"prdctIdntNo":"P"}')
        self.put('catalog_item_category',prdct_idnt_no='P',cmpnt_yn='N')
        d=load_detail(self.db,1,'bid')
        self.assertEqual(len(d['items']),1);self.assertEqual(d['items'][0]['category'],'product')
        self.assertEqual(d['conditions']['award_criteria'],'기준');self.assertEqual(d['conditions']['lower_limit_rate'],0)
        self.assertEqual(len(d['regions']),1);self.assertEqual(len(d['licenses']),1)
    def test_award_four_part_identity_rank_and_events(self):
        key=dict(bid_ntce_no='B',bid_ntce_ord='00',bid_clsfc_no='1',rbid_no='0')
        self.put('award_result',award_result_id=1,**key)
        for i,rank in enumerate(['0','10','2','']):
            self.put('opening_participant',opening_participant_id=i,opening_rank=rank,remark='',opening_result_type_name='적격',**key)
        self.put('opening_participant',opening_rank='1',**{**key,'rbid_no':'1'})
        for table in ['opening_preliminary_price','opening_failure_event','opening_rebid_event']:
            self.put(table,**key);self.put(table,**{**key,'bid_clsfc_no':'2'})
        d=load_detail(self.db,1,'award')
        self.assertEqual([r['opening_rank'] for r in d['participants']],['2','10','0',''])
        self.assertTrue(all(r['result']=='적격' for r in d['participants']))
        for field in ['preliminary','failures','rebids']: self.assertEqual(len(d[field]),1)
    def test_contract_multiple_headers_catalog_and_normalized_priority(self):
        self.put('contract_result',contract_result_id=1,decision_contract_no='D',contract_no='U',source_raw_item_id=5,contract_period='정규화 기간')
        self.put('api_raw_item',raw_item_id=5,canonical_json='{"cntrctPrd":"원문 기간","cntrctInsttOfclNm":"담당자"}')
        for i in [1,2]:
            self.put('contract_header',contract_header_id=i,decision_contract_no='D',unty_cntrct_no='U',raw_json='{}')
            self.put('contract_item',contract_item_id=i,contract_header_id=i,product_identification_no='P',raw_json='{"dlvrTmlmt":"2026-12-31"}')
        self.put('contract_catalog_cache',product_identification_no='P',lookup_status='FOUND',source_raw_item_id=9)
        self.put('api_raw_item',raw_item_id=9,canonical_json='{"mnfctCorpNm":"번호,제조사,모델","dtilPrdctClsfcNo":"1234567890"}')
        self.put('catalog_item_category',prdct_idnt_no='P',cmpnt_yn='Y')
        d=load_detail(self.db,1,'contract')
        self.assertEqual(len(d['items']),2);self.assertEqual(d['record']['contract_period'],'정규화 기간')
        self.assertEqual(d['record']['contract_officer_name'],'담당자')
        self.assertEqual(d['items'][0]['catalog']['manufacturer_name'],'제조사')
        self.assertEqual(d['items'][0]['catalog']['model_name'],'모델')
        self.assertEqual(d['items'][0]['delivery_deadline'],'2026-12-31')
        self.db.execute("UPDATE contract_catalog_cache SET lookup_status='NOT_FOUND'")
        self.assertIsNone(load_detail(self.db,1,'contract')['items'][0]['catalog']['manufacturer_name'])
    def test_blank_contract_numbers_do_not_match_blank_headers(self):
        self.put('contract_result',contract_result_id=1,decision_contract_no='',contract_no='')
        self.put('contract_header',contract_header_id=1,decision_contract_no='',contract_ref_no='',unty_cntrct_no='',raw_json='{}')
        self.put('contract_item',contract_item_id=1,contract_header_id=1)
        self.assertEqual(load_detail(self.db,1,'contract')['items'],[])
    def test_corporation_legacy_formats(self):
        raw={'corpList':'[1^주계약업체^공동^업체^대표^대한민국^0^^^123],[2^분담^분담^업체2^대표2^대한민국^20^^^456]'}
        result=corporations(raw)
        self.assertEqual(len(result),2);self.assertEqual(result[0]['business_registration_no'],'123')
        self.assertEqual(result[0]['share_rate'],'0')
        self.assertEqual(corporations({'corpList':{'items':{'corpNm':'회사','bizno':'123'}}})[0]['corporation_name'],'회사')
    def test_real_snapshot_details(self):
        with connect('market') as db:
            for mode,table,key in [('bid','bid_notice','bid_notice_id'),('award','award_result','award_result_id'),('contract','contract_result','contract_result_id')]:
                for row in db.execute(f'SELECT {key} FROM {table} ORDER BY {key} DESC LIMIT 12'):
                    d=market.detail(row[0],mode)
                    self.assertEqual(d['mode'],mode);self.assertEqual(d['record'][key],row[0])
                    json.dumps(d)
        with self.assertRaises(LookupError): market.detail(-1,'bid')

if __name__=='__main__': unittest.main()
