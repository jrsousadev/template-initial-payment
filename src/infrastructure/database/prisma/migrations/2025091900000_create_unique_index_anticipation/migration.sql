CREATE UNIQUE INDEX unique_active_anticipation_per_company ON anticipation (company_id)
WHERE
  status IN ('PENDING', 'PROCESSING');
