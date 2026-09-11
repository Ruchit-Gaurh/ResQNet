# RESQNET — Admin Command Center & Verification Dashboard (`admin-dashboard/`)

**Owner**: Ruchit (Tech Lead & Integrator) (`feature/admin`)  
**Stack**: Next.js (App Router), React, Tailwind CSS, Lucide icons, Leaflet / MapLibre

---

## Mission
Build the web-based Command Center for authorized responders, hospitals, relief camps, and system administrators.
Implement the Human Verification workflow, Duplicate Consolidation, Privacy-Aware Disaster Map, and the Hackathon Demo Simulator.

## Key Files to Create
- `src/app/page.tsx`: Overview KPI dashboard (Total Missing, Found, Verified, Pending, Active Mesh Nodes).
- `src/app/verification/page.tsx`: Side-by-side potential match review card with explainable reasons, verify/reject buttons.
- `src/app/duplicates/page.tsx`: Multi-report duplicate merger (canonical case graph).
- `src/app/map/page.tsx`: Geofenced privacy-aware disaster map.
- `src/app/demo/page.tsx`: 1-click end-to-end hackathon demonstration runner (Zone A, Rahul Sharma flow).

## Contract Reference
Adhere to `../shared/types/index.ts` and `../docs/API_CONTRACT.md`.
See `../docs/PROMPTS_FOR_TEAM.md` for Ruchit's complete AI prompt.
