Local SQL verification

run_pglite.mjs imports an already installed official @electric-sql/pglite module from the explicit local path argument, uses only an in-memory database, and closes it in finally. run_rls.py --emit-fixture extracts the exact original helper bodies from repository migrations without a database connection.

Fixture: 16,359 tenant A products, tenant and historical auth.uid rows for eight users; nine caller scenarios including anonymous. SQL NULL permissions are distinct from JSON null. Inventory RLS remains enabled; authenticated and anon are NOBYPASSRLS. Auxiliary tables use a deliberately partial schema and do not reproduce their production RLS, owners or grants; exact SECURITY DEFINER helper bodies run against fixture tables owned by the test superuser. This verifies inventory policy logic, not all production permissions.

Queries project all 16 columns selected by useInventarioPagina, retaining legacy nombre_producto/proveedor fields used for search. Page sizes 100, offsets 0/100, deterministic sort, exact counts, search, incomplete filters, combined filters and summary are covered. Each query runs three sequential warm-fixture EXPLAIN ANALYZE measurements; JSON reports execution/planning times, InitPlan and node loops. PostgreSQL Wasm timing is not a production latency estimate. No PostgREST server, HTTP encoding or browser-to-database integration is exercised.

Roundtrip: original policies/RPC -> proposal transaction COMMIT -> committed rollback transaction COMMIT. Reads, pages, counts, summaries and explicit permitted/denied CRUD and cross-tenant transfers must remain equal across all three phases. Each caller operation runs SET LOCAL ROLE and a synthetic JWT subject within a transaction, rolled back even on error. The rollback SQL restores original policy/RPC bodies exactly, including original grants; it is kept outside migrations and never applied remotely.

Usage: node run_pglite.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js /absolute/path/to/evidence.json
