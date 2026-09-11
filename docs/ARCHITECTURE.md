# RESQNET — System Architecture & Design Specification

## 1. Product Vision
RESQNET is an offline-first, privacy-preserving missing-person coordination platform engineered for disaster scenarios where cellular and internet networks are degraded or completely down.

> **CRITICAL MANDATE**: RESQNET is NOT an aerial search or physical rescue system. The mesh network serves strictly as a resilient store-and-forward information transport layer for disaster reports, safety check-ins, and coordination records.

---

## 2. High-Level Architecture

```
+-------------------------------------------------------------------------+
|                              MOBILE APP                                 |
|  +---------------------+  +--------------------+  +------------------+  |
|  |   UI / UX Layer     |  | Offline Queue      |  | Local DB         |  |
|  |  (4 Core Actions)   |  | (Store-and-Forward)|  | (SQLite / Water) |  |
|  +----------+----------+  +---------+----------+  +--------+---------+  |
+-------------|-----------------------|----------------------|------------+
              |                       |                      |
              v                       v                      v
+-------------------------------------------------------------------------+
|                         MESH TRANSPORT LAYER                            |
|  - Native BLE Discovery (ProtestChat based)                             |
|  - Cryptographic Message Sealing & Pseudonymous Routing                |
|  - Deduplication, Hop Counting (Max 7), TTL Expiry                      |
|  - Priority Queue (CRITICAL > HIGH > NORMAL > LOW)                      |
+-------------------------------------+-----------------------------------+
                                      |
         (BLE Mesh Hop: Phone A -> Phone B -> Phone C -> Gateway)
                                      |
                                      v
+-------------------------------------------------------------------------+
|                           SYNC ENGINE & GATEWAY                         |
|  - Batch Ingestion (POST /sync/batch)                                   |
|  - Idempotent Message Deduplication                                     |
|  - Bidirectional Delta Synchronization                                  |
+-------------------------------------+-----------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------+
|                        BACKEND & DATABASE CLUSTER                       |
|  - Node.js / Express or Fastify REST APIs                               |
|  - PostgreSQL Database (Cases, Evidence, Audit Logs, Users)             |
|  - Role-Based Access Control (RBAC) & Minor Protection Enforcer        |
+------------------+----------------------------------+-------------------+
                   |                                  |
                   v                                  v
+------------------------------------+  +---------------------------------+
|      AI MATCHING MICROSERVICE      |  |     ADMIN / COMMAND CENTER      |
|  - Python FastAPI                  |  |  - Next.js / React Web App      |
|  - RapidFuzz & Phonetic Matching   |  |  - Human Verification Queue     |
|  - Multilingual Transliteration    |  |  - Duplicate Consolidation      |
|  - Multi-attribute Scoring & XAI   |  |  - Privacy-Aware Disaster Map   |
|  - Face Embedding / Verification   |  |  - Mesh Topology Monitor        |
+------------------------------------+  +---------------------------------+
```

---

## 3. The Three Connectivity States

1. **ONLINE (Internet Available)**:
   - Direct HTTPS connection to backend API Gateway.
   - Immediate sync of locally queued reports.
   - Real-time updates on case status and verifications.

2. **OFFLINE BUT MESH AVAILABLE (No Internet, Nearby Peers Found)**:
   - Automatically discovers nearby RESQNET peers via BLE advertisements.
   - Encapsulates records into `MeshEnvelope` structures.
   - Performs bilateral store-and-forward message exchange.
   - Relays high-priority packets preferentially.

3. **COMPLETELY OFFLINE (Isolated Device)**:
   - Creates reports locally in SQLite with state `OFFLINE_QUEUED`.
   - UI informs user: *"Saved locally — waiting for connectivity."*
   - Continuously monitors BLE scanner in low-battery mode until another peer or gateway is encountered.

---

## 4. Key Engineering Principles
- **No Autonomous AI Decisions**: AI only computes a candidate score and an explainable breakdown (`reasons: [...]`). A verified status can ONLY be granted by a human responder.
- **Data Provenance Preservation**: When merging duplicates or updating records, original reports and evidence are never deleted. Every record links to its source.
- **Privacy by Default**:
  - Pseudonymous rotating IDs in BLE envelopes.
  - Minors have photographs and exact coordinates hidden from public views.
  - Approximate/geofenced locations for public viewers; precise coordinates restricted to authorized responders/hospitals.
