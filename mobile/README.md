# RESQNET — Mobile Application (`mobile/`)

**Owner**: Aman (`feature/mobile`)  
**Stack**: React Native / Expo (or native Android Kotlin)  
**AI Assistant**: OpenAI Codex / GitHub Copilot / Cursor

---

## Mission
Create a rock-solid, high-contrast, offline-first emergency UI centered on the 4 core actions:
1. 🟢 `I'M SAFE`
2. 🔴 `SOMEONE IS MISSING`
3. 🔵 `I FOUND SOMEONE`
4. 🟠 `REPORT A SIGHTING`

## Key Files to Create
- `src/screens/HomeScreen.tsx`: 4 Hero buttons and live network status pill.
- `src/screens/MissingReportScreen.tsx`: Missing person reporting form (supports partial info).
- `src/screens/FoundReportScreen.tsx`: Found person / unidentified intake form.
- `src/screens/FamilyDashboardScreen.tsx`: Case tracker with honest statuses (Unverified, Possible Match, Located).
- `src/services/LocalQueueService.ts`: Queues messages locally before triggering mesh relay.

## Contract Reference
Consume `shared/types/index.ts` and `mesh/MeshTransportService.ts`.
See `../docs/PROMPTS_FOR_TEAM.md` for Aman's complete AI prompt.
