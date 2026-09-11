# RESQNET — Central Backend Service (`backend/`)

**Owner**: Gaurav (`feature/backend`)  
**Stack**: Node.js / Express or Fastify (TypeScript), PostgreSQL (Prisma or Drizzle)

---

## Mission
Build the disaster case management API, idempotent gateway sync engine, and role-based access control (RBAC).

## Key Files to Create
- `src/server.ts`: HTTP server entry point.
- `src/routes/cases.ts`: Endpoints for Missing, Found, and Sighting reports.
- `src/routes/sync.ts`: Batch sync endpoint (`POST /api/v1/sync/batch`) with idempotent deduplication.
- `src/routes/admin.ts`: Verification and merge endpoints.
- `prisma/schema.prisma` or SQL migrations: Database schemas for Cases, Evidence, Matches, and AuditLogs.

## Contract Reference
Adhere strictly to `../docs/API_CONTRACT.md` and `../shared/types/index.ts`.
See `../docs/PROMPTS_FOR_TEAM.md` for Gaurav's complete AI prompt.
