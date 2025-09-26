CREATE UNIQUE INDEX unique_active_currency_conversion_per_company ON currency_conversion (company_id)
WHERE
  status IN ('PENDING', 'PROCESSING');
