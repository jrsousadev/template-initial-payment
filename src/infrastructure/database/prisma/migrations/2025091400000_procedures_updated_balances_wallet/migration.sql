CREATE UNIQUE INDEX wallet_company_account_currency_unique 
ON wallet(company_id, account_type, currency);

DROP FUNCTION IF EXISTS update_recent_wallet_balances(INTEGER);
DROP FUNCTION IF EXISTS update_all_wallet_balances(INTEGER);
DROP FUNCTION IF EXISTS update_company_wallet_balances(INTEGER);

-- =====================================================
-- PARTE 1: FUNCTION update_recent_wallet_balances OTIMIZADA
-- =====================================================


CREATE FUNCTION update_recent_wallet_balances(
    p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
    accounts_updated INTEGER,
    duration_ms INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_count INTEGER;
    v_cutoff_time TIMESTAMP;
BEGIN
    v_start_time := clock_timestamp();
    v_cutoff_time := NOW() - INTERVAL '1 hour' * p_hours_back;
    
    WITH recent_movements AS (
        SELECT 
            le.company_id,
            le.account_type,
            le.currency,
            le.amount_net,
            le.is_checkpoint,
            le.created_at,
            MAX(CASE WHEN le.is_checkpoint = true THEN le.created_at END) 
                OVER (PARTITION BY le.company_id, le.account_type, le.currency) as last_checkpoint_date
        FROM transaction le
        WHERE EXISTS (
            SELECT 1 FROM transaction recent
            WHERE recent.company_id = le.company_id
              AND recent.account_type = le.account_type
              AND recent.currency = le.currency
              AND recent.created_at > v_cutoff_time
              AND recent.is_checkpoint = false
        )
    ),
    aggregated_balances AS (
        SELECT 
            company_id,
            account_type,
            currency,
            SUM(
                CASE 
                    WHEN is_checkpoint = true AND created_at = last_checkpoint_date 
                    THEN amount_net
                    WHEN is_checkpoint = false AND created_at > COALESCE(last_checkpoint_date, '1900-01-01'::timestamp)
                    THEN amount_net
                    ELSE 0
                END
            ) as balance
        FROM recent_movements
        GROUP BY company_id, account_type, currency
    )
    INSERT INTO wallet (
        id,
        company_id,
        account_type,
        currency,
        balance,
        last_updated,
        version,
        created_at,  -- Adicionado
        updated_at   -- Adicionado
    )
    SELECT 
        gen_random_uuid(),
        company_id,
        account_type,
        currency,
        COALESCE(balance, 0),
        NOW(),
        1,
        NOW(),  -- created_at
        NOW()   -- updated_at
    FROM aggregated_balances
    ON CONFLICT (company_id, account_type, currency) 
    DO UPDATE SET
        balance = EXCLUDED.balance,
        last_updated = NOW(),
        updated_at = NOW(),  -- Adicionado
        version = wallet.version + 1
    WHERE wallet.balance != EXCLUDED.balance;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        v_count, 
        EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INTEGER;
END;
$$;

-- =====================================================
-- FUNÇÃO 2: update_all_wallet_balances (recalcula TODAS as wallets)
-- =====================================================

CREATE FUNCTION update_all_wallet_balances()
RETURNS TABLE (
    accounts_updated INTEGER,
    duration_ms INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_count INTEGER;
BEGIN
    v_start_time := clock_timestamp();
    
    WITH all_entries AS (
        SELECT 
            company_id,
            account_type,
            currency,
            amount_net,
            is_checkpoint,
            created_at,
            id,
            MAX(CASE WHEN is_checkpoint = true THEN created_at END) 
                OVER (PARTITION BY company_id, account_type, currency) as last_checkpoint_date
        FROM transaction
    ),
    calculated_balances AS (
        SELECT 
            company_id,
            account_type,
            currency,
            SUM(
                CASE 
                    WHEN is_checkpoint = true AND created_at = last_checkpoint_date 
                    THEN amount_net
                    WHEN is_checkpoint = false AND created_at > COALESCE(last_checkpoint_date, '1900-01-01'::timestamp)
                    THEN amount_net
                    WHEN is_checkpoint = false AND last_checkpoint_date IS NULL
                    THEN amount_net
                    ELSE 0
                END
            ) as balance
        FROM all_entries
        GROUP BY company_id, account_type, currency
    )
    INSERT INTO wallet (
        id,
        company_id,
        account_type,
        currency,
        balance,
        last_updated,
        version,
        created_at,
        updated_at
    )
    SELECT 
        gen_random_uuid(),
        company_id,
        account_type,
        currency,
        COALESCE(balance, 0),
        NOW(),
        1,
        NOW(),
        NOW()
    FROM calculated_balances
    WHERE company_id IS NOT NULL
    ON CONFLICT (company_id, account_type, currency) 
    DO UPDATE SET
        balance = EXCLUDED.balance,
        last_updated = NOW(),
        updated_at = NOW(),
        version = wallet.version + 1
    WHERE wallet.balance != EXCLUDED.balance;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        v_count, 
        EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INTEGER;
END;
$$;

-- =====================================================
-- FUNÇÃO 3: update_company_wallet_balances (recalcula wallets de uma empresa específica)
-- =====================================================

CREATE FUNCTION update_company_wallet_balances(
    p_company_id TEXT
)
RETURNS TABLE (
    accounts_updated INTEGER,
    duration_ms INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_count INTEGER;
BEGIN
    v_start_time := clock_timestamp();
    
    IF p_company_id IS NULL OR p_company_id = '' THEN
        RAISE EXCEPTION 'Company ID cannot be null or empty';
    END IF;
    
    WITH company_entries AS (
        SELECT 
            company_id,
            account_type,
            currency,
            amount_net,
            is_checkpoint,
            created_at,
            id,
            MAX(CASE WHEN is_checkpoint = true THEN created_at END) 
                OVER (PARTITION BY account_type, currency) as last_checkpoint_date
        FROM transaction
        WHERE company_id = p_company_id
    ),
    company_balances AS (
        SELECT 
            company_id,
            account_type,
            currency,
            SUM(
                CASE 
                    WHEN is_checkpoint = true AND created_at = last_checkpoint_date 
                    THEN amount_net
                    WHEN is_checkpoint = false AND created_at > COALESCE(last_checkpoint_date, '1900-01-01'::timestamp)
                    THEN amount_net
                    WHEN is_checkpoint = false AND last_checkpoint_date IS NULL
                    THEN amount_net
                    ELSE 0
                END
            ) as balance
        FROM company_entries
        GROUP BY company_id, account_type, currency
    )
    INSERT INTO wallet (
        id,
        company_id,
        account_type,
        currency,
        balance,
        last_updated,
        version,
        created_at,
        updated_at
    )
    SELECT 
        gen_random_uuid(),
        company_id,
        account_type,
        currency,
        COALESCE(balance, 0),
        NOW(),
        1,
        NOW(),
        NOW()
    FROM company_balances
    ON CONFLICT (company_id, account_type, currency) 
    DO UPDATE SET
        balance = EXCLUDED.balance,
        last_updated = NOW(),
        updated_at = NOW(),
        version = wallet.version + 1
    WHERE wallet.balance != EXCLUDED.balance;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        v_count, 
        EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INTEGER;
END;
$$;