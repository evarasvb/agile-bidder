-- CRITICAL SECURITY FIX: Remove dangerous exec_sql function that allows arbitrary SQL execution
-- This function was a severe security vulnerability allowing any authenticated user to execute arbitrary SQL

-- Drop the dangerous function
DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

-- Also drop any related helper functions that might exist
DROP FUNCTION IF EXISTS public.exec_sql_batch(TEXT[]);