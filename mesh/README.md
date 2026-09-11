# RESQNET — Mesh Networking Module (`mesh/`)

**Owner**: Vishal (`feature/mesh`)  
**Base Foundation**: ProtestChat (BLE P2P, store-and-forward, cryptographic message sealing)

---

## Mission
Adapt the ProtestChat BLE mesh engine into a clean, disaster-resilient store-and-forward transport layer.
Do not rewrite working BLE discovery or routing code. Expose a typed `MeshTransportService` to Aman's mobile app.

## Key Files to Create
- `MeshTransportService.ts`: Public interface exposed to the mobile app.
- `queue/MessageQueue.ts`: SQLite-backed persistent priority queue with TTL purge and deduplication.
- `protocol/Envelope.ts`: Serializer/deserializer enforcing `shared/types/index.ts`.
- `mock/MockMeshTransport.ts`: In-memory emulator for multi-node offline testing.

## Contract Reference
Consume `MeshEnvelope` from `../shared/types/index.ts`.
See `../docs/PROMPTS_FOR_TEAM.md` for Vishal's complete AI prompt.
