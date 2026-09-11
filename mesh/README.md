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

## Current Sprint Implementation

- `MeshTransportService.ts` exposes the typed mobile boundary.
- `queue/MessageQueue.ts` implements a persistent-storage adapter boundary, priority ordering, acknowledgement removal, expiry, and duplicate-safe enqueue.
- `protocol/Deduplicator.ts` implements in-memory LRU-style tracking with optional persistent backing.
- `protocol/Envelope.ts` validates the shared envelope and enforces hop/TTL rules.
- `mock/MockMeshTransport.ts` provides multi-node in-memory store-carry-forward and real gateway ACK handling.
- `dev/DevMeshTransport.ts` provides a development-only WebSocket transport for separate emulator/app processes while reusing the same queue and deduplicator.
- `dev-broker/` is a transport-only local radio relay. It forwards envelopes to connected/topology-eligible peers and never owns cases, performs matching, or acts as a gateway.

`native/NativeBleMeshTransport.ts` now provides the real-radio adapter boundary, including Android permission/capability states, privacy-safe rotating advertising metadata, GATT lifecycle hooks, envelope framing/reassembly, forwarding, queueing, deduplication, and gateway sync. The Expo Go hackathon build intentionally continues to select `MockMeshTransport`: a platform `BleRadioPort` implementation still requires an Expo development build and physical Android BLE hardware.

```bash
cd mesh
npm install
npm test
npm run demo
npm run dev:broker
```

The broker listens on port `8787` by default. Android emulators connect through `ws://10.0.2.2:8787`. Set `DEV_MESH_TOPOLOGY` to a JSON adjacency map to simulate constrained links, for example A-B and B-C without A-C.
