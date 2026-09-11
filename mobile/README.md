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

## Run

```bash
cd mobile
npm install
npm run android
```

The current sprint build uses `MockMeshTransport` with a visible simulated `PHONE-A → MOCK-B → MOCK-C` path. It does not claim native BLE. Reports are committed to AsyncStorage before relay is attempted, and “Delivered” is reserved for IDs returned by `/api/v1/sync/batch`.

The shared `GeoLocation` contract requires numeric latitude/longitude even when only a disaster zone is known. The mobile mapper preserves zone-only input using `0,0` with a world-scale `accuracyMeters` sentinel. Backend/shared owners should decide on an explicit optional-coordinate representation before production integration.

## Two-emulator development mesh

Start the transport-only broker with `cd mesh && npm run dev:broker`. In another terminal run:

```bash
cd mobile
npm run android:dev-mesh
```

The app uses `DEV_EMULATOR_MESH` and connects to `ws://10.0.2.2:8787`. Each Expo Go installation persists its own `NODE-xxxxxxxx` identity. Configure `MOCK_IN_PROCESS` by using the normal `npm run android` command; `NATIVE_BLE` remains a separate adapter mode and is not represented by the emulator broker.
