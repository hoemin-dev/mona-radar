WITH effective_records AS (
    SELECT r.*,
           COALESCE(company.corrected_value, r.company_name) AS effective_company_name,
           COALESCE(product.corrected_value, r.product_name) AS effective_product_name,
           CASE WHEN company.id IS NULL THEN 0 ELSE 1 END AS company_name_corrected,
           CASE WHEN product.id IS NULL THEN 0 ELSE 1 END AS product_name_corrected
    FROM certification_records r
    LEFT JOIN certification_corrections company
      ON company.certification_type = r.certification_type
     AND company.certification_no = r.certification_no
     AND company.field_name = 'company_name'
    LEFT JOIN certification_corrections product
      ON product.certification_type = r.certification_type
     AND product.certification_no = r.certification_no
     AND product.field_name = 'product_name'
)