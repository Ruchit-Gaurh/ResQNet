# RESQNET — API Contract & Sync Protocol

All backend endpoints accept and return JSON. Authentication uses Bearer JWT tokens (`Authorization: Bearer <token>`).

---

## 1. Case Management Endpoints (Backend - Gaurav)

### `POST /api/v1/cases/missing`
Creates a new missing-person case.
- **Request Body**:
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
- **Response (201 Created)**:
```json
{
  "success": true,
  "caseId": "CASE-10291",
  "status": "SEARCHING",
  "verificationState": "UNVERIFIED",
  "createdAt": "2026-09-11T09:00:00Z"
}
```

---

### `POST /api/v1/cases/found`
Creates a found-person or unidentified patient report.
- **Request Body**:
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
- **Response (201 Created)**:
```json
{
  "success": true,
  "caseId": "CASE-10305",
  "status": "INFORMATION_RECEIVED"
}
```

---

### `POST /api/v1/reports/sighting`
Submits a public or volunteer sighting report.
- **Request Body**:
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
- **Response (201 Created)**:
```json
{
  "success": true,
  "sightingId": "SIGHT-5510",
  "verificationState": "UNVERIFIED"
}
```

---

### `POST /api/v1/safe-checkin`
Registers an "I'M SAFE" broadcast.
- **Request Body**:
```json
{
  "personName": "Aman Verma",
  "phoneNumber": "+919812345678",
  "location": { "lat": 28.6120, "lng": 77.2050, "zone": "Zone A" },
  "statusMessage": "Sheltered at City High School, safe and unhurt",
  "affectedFamilyMembers": ["Sunita Verma", "Rohan Verma"]
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "checkInId": "SAFE-9012"
}
```

---

### `GET /api/v1/cases/:caseId`
Retrieves case details, linked evidence, and timeline.
- **Query Params**: `?role=FAMILY|PUBLIC|RESPONDER_ADMIN`
- **Behavior**: Filters PII and exact GPS coordinates according to caller's role.

---

## 2. Sync Engine Endpoint (Mobile <-> Backend)

### `POST /api/v1/sync/batch`
Idempotent batch upload from offline mobile queue or mesh gateway.
- **Request Body**:
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
      "payload": { ... }
    }
  ]
}
```
- **Response (200 OK)**:
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

## 3. Matching Microservice Endpoints (Python FastAPI - Gaurav)

### `POST /match/evaluate`
Evaluates similarity between a target missing case and candidate records.
- **Request Body**:
```json
{
  "target": {
    "name": "Rahul Sharma",
    "age": 22,
    "gender": "MALE",
    "clothing": "Blue t-shirt, black denim",
    "location": { "lat": 28.6139, "lng": 77.2090 }
  },
  "candidate": {
    "name": "Rahool Sharma",
    "age": 23,
    "gender": "MALE",
    "clothing": "Blue shirt",
    "location": { "lat": 28.6180, "lng": 77.2150 }
  }
}
```
- **Response (200 OK)**:
```json
{
  "overallScore": 91.2,
  "confidenceLevel": "STRONG_CANDIDATE",
  "breakdown": {
    "nameScore": 94.0,
    "ageScore": 95.0,
    "locationScore": 88.5,
    "timelineScore": 90.0,
    "physicalScore": 85.0
  },
  "reasons": [
    "✓ High phonetic name similarity (Rahool Sharma vs Rahul Sharma)",
    "✓ Age difference is within 1 year",
    "✓ Location distance is 0.7 km (within Zone A/B corridor)",
    "✓ Clothing description matches (Blue shirt)"
  ],
  "warnings": [
    "⚠ Photograph requires human verification"
  ]
}
```

---

## 4. Verification & Command Center Endpoints (Backend <-> Admin Dashboard)

### `GET /api/v1/admin/matches/pending`
Returns pending potential matches awaiting human verification.

### `POST /api/v1/admin/matches/:matchId/verify`
Authorizes and verifies identity candidate.
- **Request Body**:
```json
{
  "decision": "VERIFY",
  "reviewerId": "ADMIN-RUCHIT",
  "evidenceUsed": ["EVID-PHOTO-01", "EVID-HOSPITAL-ADM-44"],
  "notes": "Verified visually with family contact and hospital intake record."
}
```
- **Effect**:
  - Sets match status to `VERIFIED`.
  - Transitions case status to `VERIFIED` and `FAMILY_NOTIFIED`.
  - Generates audit log entry.
  - Pushes notification envelope to mesh/online family subscriber.

### `POST /api/v1/admin/cases/merge`
Consolidates multiple duplicate reports into a canonical case.
- **Request Body**:
```json
{
  "canonicalCaseId": "CASE-10291",
  "duplicateCaseIds": ["CASE-10305", "CASE-10311"],
  "reason": "Confirmed same individual across hospital intake and camp registration"
}
```
