SELECT DISTINCT a.award_result_id,a.bid_ntce_no,a.bid_ntce_ord,a.bid_ntce_name,
        a.target_detailed_product_class_no,a.winner_name,a.winner_business_no,
        a.winner_ceo_name,a.winner_address,a.winner_tel_no,a.successful_bid_amount,
        a.successful_bid_rate,a.demand_institution_name,a.demand_institution_code,
        a.real_opening_local,a.participant_count,
        (SELECT t.target_name FROM award_collection_target t
         WHERE t.dtil_prdct_clsfc_no=a.target_detailed_product_class_no
         ORDER BY t.updated_at DESC LIMIT 1) AS target_name,
        CASE WHEN count(DISTINCT c.category)=1 THEN MIN(c.category) WHEN count(DISTINCT c.category)>1 THEN 'mixed' END AS product_category,MIN(l.source) AS product_category_source
      FROM award_result a
      LEFT JOIN award_catalog_item_link l ON l.award_result_id=a.award_result_id
      LEFT JOIN catalog_item_category c ON c.prdct_idnt_no=l.prdct_idnt_no
      WHERE (?1='' OR a.bid_ntce_name LIKE ?2 OR a.winner_name LIKE ?2
        OR a.demand_institution_name LIKE ?2 OR a.target_detailed_product_class_no LIKE ?2
        OR a.bid_ntce_no LIKE ?2 OR l.prdct_idnt_no LIKE ?2)
        AND (?3='' OR substr(a.real_opening_local,1,10)>=?3)
        AND (?4='' OR substr(a.real_opening_local,1,10)<=?4)
        AND (?5 IS NULL OR a.successful_bid_amount>=?5)
        AND (?6 IS NULL OR a.successful_bid_amount<=?6)
        AND (?7 IS NULL OR CAST(a.successful_bid_rate AS REAL)>=?7)
        AND (?8 IS NULL OR CAST(a.successful_bid_rate AS REAL)<=?8)
        AND (?9='' OR a.winner_name LIKE ?10)
        AND (?11='' OR a.demand_institution_name LIKE ?12)
        AND (?13='all' OR c.category=?13)
        AND (?14='' OR (SELECT t.target_name FROM award_collection_target t
          WHERE t.dtil_prdct_clsfc_no=a.target_detailed_product_class_no
          ORDER BY t.updated_at DESC LIMIT 1) LIKE ?15)
        AND (?16='' OR a.target_detailed_product_class_no LIKE ?17)
        AND EXISTS(SELECT 1 FROM target_membership tm WHERE tm.domain='AWARD' AND tm.source_id=a.award_result_id AND (?21='[]' OR tm.target_code IN (SELECT value FROM json_each(?21)))) AND ((?19='' AND ?20='') OR EXISTS(SELECT 1 FROM search_classes sc WHERE sc.domain='AWARD' AND sc.source_id=a.award_result_id AND (?19='' OR sc.classification_no=?19) AND (?20='' OR sc.detailed_no=?20)))
      GROUP BY a.award_result_id ORDER BY a.real_opening_local DESC,a.award_result_id DESC LIMIT ?18