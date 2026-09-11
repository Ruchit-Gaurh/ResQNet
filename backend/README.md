# RESQNET — Modular Monolith Backend Service

The central backend service for **RESQNET**, an offline-first missing-person identification and disaster emergency coordination network.

Built as a **MODULAR MONOLITH** running in a single Node.js application, integrating disaster case management, mesh store-and-forward batch synchronization, role-based access control, an in-process explainable AI matching engine, and a human-in-the-loop verification command center.

---

## 1. Architecture Overview

```text
                     RESQNET
                        │
                        ▼
               ┌─────────────────┐
               │ Node.js Backend │
               │ (Modular Monolith)
               └────────┬────────┘
                        │
       ┌────────────────┼────────────────┐
       │                │                │
       ▼                ▼                ▼
     Cases          Sightings          Sync Gateway
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
                   Matching Engine (In-Process)
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
        Name         Location      Timeline  (Age, Physical, Photo)
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                     Scorer
                        │
                        ▼
                MatchCandidate (status = PENDING_REVIEW)
                        │
                        ▼
             Human Verification Queue
                   │          │
               CONFIRM      REJECT
                   │
                   ▼
               Case Update
                   │
                   ▼
                Audit Log
                   │
                   ▼
               PostgreSQL (Prisma ORM)
```

### Key Principles
1. **Single Node.js Runtime**: No microservices, no separate Python FastAPI backend. The matching engine runs as an internal TypeScript module.
2. **AI Never Confirms Identity**: AI scoring generates `PENDING_REVIEW` candidate records with explainable `reasons[]` and `warnings[]`. Only authorized human responders can verify or reject identity matches.
3. **Idempotent Mesh Gateway**: `messageId` uniqueness is enforced at the database level to prevent duplicate records during network re-transmissions.
4. **Role-Aware Sensitive Data Filtering**: Public and volunteer endpoints filter out exact GPS coordinates, minor photographs, and private contact info.

---

## 2. Directory Structure

```text
backend/
├── prisma/
│   └── schema.prisma           # 8 models (Case, EvidenceReport, Sighting, SafeCheckIn,
│                               # MatchCandidate, Verification, AuditLog, SyncMessage)
├── src/
│   ├── config/                 # Environment & Prisma client singleton
│   ├── middleware/             # auth (JWT), role (RBAC), validation (Zod), errorHandler
│   ├── utils/                  # id-generator, errors
│   ├── modules/
│   │   ├── cases/              # Missing and found case registration & role projection
│   │   ├── sightings/          # Sighting report ingestion
│   │   ├── safe-checkin/       # "I'm Safe" broadcast ingestion
│   │   ├── sync/               # Mesh sync gateway with idempotent deduplication
│   │   ├── matching/           # In-process explainable AI matching engine
│   │   │   ├── name-matcher.ts     # RapidFuzz-equivalent + phonetic matching
│   │   │   ├── age-matcher.ts      # Exact and approximate age comparison
│   │   │   ├── location-matcher.ts # Haversine distance + zone fallback
│   │   │   ├── timeline-matcher.ts # Chronological plausibility
│   │   │   ├── physical-matcher.ts # Clothing & physical descriptors
│   │   │   ├── photo-matcher.ts    # Pluggable photo comparison abstraction
│   │   │   ├── scorer.ts           # Weighted scorer (20/10/20/15/10/25%)
│   │   │   └── explainability.ts   # Bulleted reasons & safety warnings
│   │   ├── verification/       # Human review & case merge workflow
│   │   ├── audit/              # Append-only audit logger
│   │   └── auth/               # Dev token generator helper
│   ├── __tests__/              # Vitest test suite (31 tests across 5 files)
│   └── server.ts               # Express entry point
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 3. Getting Started

### Prerequisites
* Node.js v20+
* PostgreSQL database

### Installation
```bash
cd backend
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your database connection:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/resqnet
JWT_SECRET=your-secret-key
PORT=3000
NODE_ENV=development
```

### Database Migration & Prisma
```bash
# Validate Prisma schema
npx prisma validate

# Format Prisma schema
npx prisma format

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### Running the Server
```bash
# Development (with hot-reload)
npm run dev

# Production Build & Run
npm run build
npm start
```

### Running Tests
```bash
npm test
```

---

## 4. API Documentation

All endpoints accept and return JSON. Authentication uses Bearer JWT tokens: `Authorization: Bearer <token>`.

### 4.1 Missing Person Registration
* **Endpoint**: `POST /api/v1/cases/missing`
* **Authentication**: Required
* **Roles**: Any authenticated role (`FAMILY`, `PUBLIC`, `VOLUNTEER`, `HOSPITAL`, `RELIEF_CAMP`, `RESPONDER_ADMIN`)
* **Request Body**:
```json
{
  "person": {
    "name": "Rahul Sharma",
    "nickname": "Bittu",
    "age": 22,
    "gender": "MALE",
    "fatherMotherName": "Ramesh Sharma",
    "phoneNumber": "+919876543210",
    "identifyingMarks": "Small scar on left eyebrow",
    "clothing": "Blue t-shirt, black denim jeans",
    "medicalNeeds": "Asthma inhaler required",
    "photoUrl": "data:image/jpeg;base64,..."
  },
  "priority": "HIGH",
  "lastKnownLocation": {
    "lat": 28.6139,
    "lng": 77.2090,
    "zone": "Zone A - Sector 4"
  },
  "lastKnownTime": "2026-09-11T08:30:00Z",
  "source": "FAMILY"
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "caseId": "CASE-10291",
  "status": "SEARCHING",
  "verificationState": "UNVERIFIED",
  "createdAt": "2026-09-11T09:00:00.000Z"
}
```
* **Error Responses**:
  * `400 Bad Request`: Validation failure (missing required fields, invalid enum).
  * `401 Unauthorized`: Missing or invalid JWT.

---

### 4.2 Found Person Registration
* **Endpoint**: `POST /api/v1/cases/found`
* **Authentication**: Required
* **Roles**: Restricted to privileged intake roles (`HOSPITAL`, `RELIEF_CAMP`, `RESPONDER_ADMIN`)
* **Request Body**:
```json
{
  "person": {
    "name": "UNKNOWN PERSON",
    "approximateAge": 23,
    "gender": "MALE",
    "identifyingMarks": "Scar on left forehead",
    "clothing": "Blue shirt",
    "photoUrl": "..."
  },
  "location": {
    "lat": 28.6180,
    "lng": 77.2150,
    "zone": "Zone B - General Hospital"
  },
  "source": "HOSPITAL"
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "caseId": "CASE-10305",
  "status": "INFORMATION_RECEIVED"
}
```
* **Error Responses**:
  * `401 Unauthorized`: Missing or invalid JWT.
  * `403 Forbidden`: Caller lacks authorized intake role.
  * `400 Bad Request`: Validation failure.

---

### 4.3 Sighting Report Submission
* **Endpoint**: `POST /api/v1/reports/sighting`
* **Authentication**: Required
* **Roles**: Any authenticated role (`PUBLIC`, `VOLUNTEER`, `RESPONDER_ADMIN`, etc.)
* **Request Body**:
```json
{
  "targetCaseId": "CASE-10291",
  "personDescription": "Young male walking towards relief camp",
  "location": { "lat": 28.6150, "lng": 77.2100, "zone": "Zone A" },
  "clothingDescription": "Torn blue shirt",
  "directionOfMovement": "North toward Sector 5",
  "confidenceScore": 0.85
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "sightingId": "SIGHT-5510",
  "verificationState": "UNVERIFIED"
}
```

---

### 4.4 Safe Check-in ("I'M SAFE" Broadcast)
* **Endpoint**: `POST /api/v1/safe-checkin`
* **Authentication**: Required
* **Roles**: Any authenticated role
* **Request Body**:
```json
{
  "personName": "Aman Verma",
  "phoneNumber": "+919812345678",
  "location": { "lat": 28.6120, "lng": 77.2050, "zone": "Zone A" },
  "statusMessage": "Sheltered at City High School, safe and unhurt",
  "affectedFamilyMembers": ["Sunita Verma", "Rohan Verma"]
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "checkInId": "SAFE-9012"
}
```

---

### 4.5 Case Details with Role-Based Sensitive Data Filtering
* **Endpoint**: `GET /api/v1/cases/:caseId`
* **Authentication**: Required
* **Roles**: All roles (`PUBLIC`, `FAMILY`, `VOLUNTEER`, `HOSPITAL`, `RELIEF_CAMP`, `RESPONDER_ADMIN`)
* **Behavior**:
  * For `PUBLIC`, `FAMILY`, `VOLUNTEER`: Exact GPS coordinates (`lat`, `lng`) are stripped and only `zone` is shown. Phone numbers, alternate contacts, parent names, medical details, and minor photographs are redacted.
  * For `HOSPITAL`, `RELIEF_CAMP`: Complete medical and intake information with full coordinates is provided.
  * For `RESPONDER_ADMIN`: Full case graph including evidence IDs and audit references is returned.
* **Response (200 OK)**:
```json
{
  "caseId": "CASE-10291",
  "type": "MISSING",
  "status": "SEARCHING",
  "priority": "HIGH",
  "person": {
    "name": "Rahul Sharma",
    "gender": "MALE",
    "age": 22,
    "clothing": "Blue t-shirt, black denim jeans"
  },
  "lastKnownLocation": {
    "zone": "Zone A - Sector 4"
  },
  "lastKnownTime": "2026-09-11T08:30:00.000Z",
  "source": "FAMILY",
  "sourceTrustScore": 0.8,
  "verificationState": "UNVERIFIED",
  "createdAt": "2026-09-11T09:00:00.000Z",
  "updatedAt": "2026-09-11T09:00:00.000Z",
  "corroborationCount": 0,
  "evidenceIds": []
}
```

---

### 4.6 Idempotent Mesh Sync Gateway
* **Endpoint**: `POST /api/v1/sync/batch`
* **Authentication**: Required
* **Roles**: All authenticated mobile devices and mesh gateways
* **Request Body**:
```json
{
  "deviceId": "DEVICE-UUID-ABC",
  "lastSyncTimestamp": 1726050000000,
  "outboundEnvelopes": [
    {
      "messageId": "msg-9901-uuid",
      "messageType": "MISSING_PERSON",
      "priority": "HIGH",
      "createdAt": 1726050100000,
      "expiresAt": 1726136500000,
      "hopCount": 2,
      "maxHops": 7,
      "senderPseudonym": "PSEUDO-88F",
      "destinationType": "GATEWAY",
      "payload": {
        "person": {
          "name": "Pooja Patel",
          "gender": "FEMALE",
          "age": 25
        },
        "source": "PUBLIC"
      }
    }
  ]
}
```
* **Idempotency Guarantee**:
  * The `messageId` field has a database-level unique constraint (`SyncMessage.messageId`).
  * If a packet with the same `messageId` is re-transmitted across the mesh network, it is safely acknowledged without duplicating records.
  * Concurrent identical messages are caught by database constraint handling (Prisma P2002 error mapping).
* **Response (200 OK)**:
```json
{
  "acknowledgedMessageIds": ["msg-9901-uuid"],
  "inboundCases": [ ... ],
  "inboundMatches": [ ... ],
  "inboundTimelineEvents": [ ... ],
  "serverTimestamp": 1726051000000
}
```

---

### 4.7 Command Center & Verification Endpoints
* **Get Pending Matches**: `GET /api/v1/admin/matches/pending` (Role: `RESPONDER_ADMIN`)
* **Verify / Reject Match**: `POST /api/v1/admin/matches/:matchId/verify` (Role: `RESPONDER_ADMIN`)
  * Request:
    ```json
    {
      "decision": "VERIFY",
      "reviewerId": "ADMIN-RUCHIT",
      "evidenceUsed": ["EVID-PHOTO-01", "EVID-HOSPITAL-ADM-44"],
      "notes": "Verified visually with family contact and hospital intake record."
    }
    ```
  * Effect: Match becomes `VERIFIED` and `HUMAN_VERIFIED`; target case becomes `VERIFIED` and `FAMILY_NOTIFIED`; audit log recorded.
* **Merge Duplicate Cases**: `POST /api/v1/admin/cases/merge` (Role: `RESPONDER_ADMIN`)

---

## 5. Testing & Verification

The test suite covers all critical business logic and safety guarantees without requiring external network access:

```bash
cd backend
npm test
```

### Test Coverage Summary (31 Tests, 5 Test Files):
* `matching.test.ts` (11 tests): Name fuzzy/phonetic similarity, age difference scoring, Haversine geographic proximity, timeline plausibility, physical/clothing similarity, weighted scorer proportions, and the **CRITICAL AI SAFETY RULE** ensuring AI never sets `HUMAN_VERIFIED`.
* `cases.test.ts` (7 tests): Missing case creation, found case intake, 401 unauthenticated, 400 validation errors, 403 unauthorized role rejection, and role-based sensitive data projection (PII and GPS redaction).
* `sightings.test.ts` (4 tests): Sighting report validation, missing field detection, unauthenticated rejection, and safe check-in 200 OK handling.
* `sync.test.ts` (4 tests): New mesh envelope ingestion, duplicate message deduplication, batch idempotency, and concurrent insert constraint safety (`P2002`).
* `verification.test.ts` (5 tests): AI generates `PENDING_REVIEW` candidate only, non-admin role rejection (403), authorized responder verification (`VERIFY` and `REJECT`), and pending queue retrieval.
