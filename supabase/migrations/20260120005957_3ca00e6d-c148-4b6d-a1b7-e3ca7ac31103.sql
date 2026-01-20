-- Drop the dangerous exec_sql function that allows arbitrary SQL execution
-- This function bypasses all RLS policies and represents a critical security risk

DROP FUNCTION IF EXISTS public.exec_sql(TEXT);
DROP FUNCTION IF EXISTS public.exec_sql_batch(TEXT[]);