import unittest
from server.forecast import enrich, detail, search, latest


class ForecastTests(unittest.TestCase):
    def test_amount_is_total_not_construction_contract(self):
        r = enrich({'contract_amount': 0, 'raw_json': '{"sumOrderAmt":"855000000","cntrctMthdNm":"수의계약","qtyCntnts":"1"}'})
        self.assertEqual(r['total_order_amount'], 855000000)
        self.assertEqual(r['contract_amount'], 0)
        self.assertEqual(r['contract_method'], '수의계약')
        self.assertEqual(r['quantity'], '1')
        self.assertNotIn('raw_json', r)

    def test_missing_invalid_and_zero_amount(self):
        for raw in ('{}', 'broken', '[]', '{"sumOrderAmt":"NaN"}'):
            self.assertIsNone(enrich({'raw_json': raw})['total_order_amount'])
        self.assertEqual(enrich({'raw_json': '{"sumOrderAmt":"0"}'})['total_order_amount'], 0)

    def test_existing_jeju_record_and_list(self):
        r = detail(791)['record']
        self.assertEqual(r['order_plan_unity_no'], 'R26DD20807065')
        self.assertEqual(r['total_order_amount'], 855000000)
        self.assertIn('R26BK01664321', r['bid_notice_numbers'])
        self.assertIn('total_order_amount', search({})['rows'][0])
        self.assertIn('amount', latest(1)[0])
