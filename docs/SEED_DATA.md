# Seed Data — FirmaVB 2026

Scripts to populate the FirmaVB database with all 2026 MercadoPúblico procurement data.

## Data Sources

| Source | Endpoint | Volume (Jan-Mar 2026) | Script |
|--------|----------|----------------------|--------|
| Compras Ágiles | transparenciachc ZIPs | ~230K records/month | `seed-compras-agiles.ts` |
| Licitaciones | OCDS API | ~20K | `seed-licitaciones-ocds.ts` |
| Trato Directo | OCDS API | ~25K | `seed-licitaciones-ocds.ts` |
| Convenio Marco (OCDS) | OCDS API | ~35K | `seed-licitaciones-ocds.ts` |
| Convenio Marco Master | CM_publicados.csv | ~200 convenios | `seed-convenio-marco.ts` |

## Prerequisites

```bash
# Required environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

These must also be set as GitHub repository secrets for the workflow.

## Running Locally

```bash
# Install dependencies
npm ci

# 1. Compras Ágiles (Jan + Feb 2026)
MONTHS=01,02 npx tsx scripts/seed-compras-agiles.ts

# 2. Licitaciones OCDS (all types, Jan-Mar 2026)
MONTHS=01,02,03 npx tsx scripts/seed-licitaciones-ocds.ts

# 3. Convenio Marco master CSV
npx tsx scripts/seed-convenio-marco.ts
```

### Script Options

#### seed-compras-agiles.ts

| Variable | Default | Description |
|----------|---------|-------------|
| `MONTHS` | `01,02` | Comma-separated months to import |

Downloads ZIP files from `https://transparenciachc.blob.core.windows.net/trnspchc/COT_2026-{MM}.zip`, extracts CSVs (Latin-1, semicolon-delimited), and upserts into `compras_agiles`, `instituciones`, and `proveedores` tables.

#### seed-licitaciones-ocds.ts

| Variable | Default | Description |
|----------|---------|-------------|
| `MONTHS` | `01,02,03` | Comma-separated months |
| `TYPES` | `licitaciones,trato_directo,convenio_marco` | Data types to fetch |
| `SKIP_DETAILS` | `false` | Skip tender detail API calls (faster) |
| `DETAIL_CONCURRENCY` | `5` | Parallel detail fetch requests |

Paginates through the OCDS API (no API ticket needed), optionally fetches individual tender details, and upserts into `licitaciones_bi`, `licitaciones_bi_items`, `licitaciones_adjudicaciones`, `instituciones`, and `proveedores`.

#### seed-convenio-marco.ts

Downloads `CM_publicados.csv` and upserts convenio marco records into `licitaciones_bi` with `tipo='convenio_marco'`.

## GitHub Actions Workflow

Manual trigger at **Actions > Seed 2026 Complete Data**:

```
Scripts: all | compras-agiles | licitaciones-ocds | convenio-marco
Months: 01,02 (comma-separated)
OCDS types: licitaciones,trato_directo,convenio_marco
Skip details: false
Detail concurrency: 5
```

The workflow runs each script as a separate job (parallel when running all).

## Database Tables Populated

| Table | Source | Upsert Key |
|-------|--------|------------|
| `compras_agiles` | Compra Ágil CSVs | `codigo` |
| `licitaciones_bi` | OCDS API + CM CSV | `codigo` |
| `licitaciones_bi_items` | OCDS tender details | Insert (FK to licitaciones_bi) |
| `licitaciones_adjudicaciones` | OCDS awards | Insert (FK to licitaciones_bi) |
| `instituciones` | All sources | `rut` |
| `proveedores` | Compra Ágil + OCDS | `rut` |

## Data Quality

- **Encoding**: Compra Ágil CSVs use Latin-1/Windows-1252 → converted to UTF-8
- **Deduplication**: All upserts use `ON CONFLICT` with unique keys
- **NULL handling**: Empty strings, "NA", "N/A" → NULL
- **Amount parsing**: Handles dot/comma decimal separators, quoted values
- **Date parsing**: Supports ISO, DD/MM/YYYY, DD-MM-YYYY formats
- **Classification**: Compras ágiles are classified by amount (L1/LE/LP/LR per UTM thresholds)

## Estimated Runtime

| Script | Local | GitHub Actions |
|--------|-------|---------------|
| Compras Ágiles (2 months) | 5-15 min | 10-20 min |
| Licitaciones OCDS (with details) | 2-6 hours | 3-6 hours |
| Licitaciones OCDS (skip details) | 15-30 min | 20-40 min |
| Convenio Marco | < 1 min | < 2 min |
