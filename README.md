# RESQNET — Disaster Missing-Person Coordination Network

> **Offline-first, privacy-preserving missing-person coordination platform for major disasters where cellular networks and internet connectivity are unavailable or unreliable.**

---

## 🚨 Key Principles
1. **Not a Search-and-Rescue Drone/Physical System**: RESQNET is an information transport and coordination platform.
2. **Offline-First & Store-and-Forward**: Reports are created and queued locally on-device, hopping peer-to-peer via Bluetooth Low Energy (BLE) until reaching an internet-connected gateway.
3. **AI Recommends, Humans Confirm**: AI computes explainable similarity candidates with detailed match reasons. AI **never** automatically verifies a person's identity.
4. **Data Provenance**: Evidence and original reports are preserved forever in a canonical case graph.

---

## 👥 4-Person Team Ownership & Directory Map

| Team Member | Role | Owned Directory | Branch |
| :--- | :--- | :--- | :--- |
| **Vishal** | 📡 Mesh Networking Engineer | `mesh/` | `feature/mesh` |
| **Gaurav** | 🧠 Backend & AI Matching | `backend/`, `matching-engine/` | `feature/backend` |
| **Aman** | 📱 Lead Mobile UX (Codex) | `mobile/` | `feature/mobile` |
| **Ruchit** | 🖥️ Admin, Verification & Tech Lead | `admin-dashboard/`, `shared/` | `feature/admin` |

---

## 📁 Repository Structure

```
ResQNet/
├── shared/
│   ├── types/               <-- SINGLE SOURCE OF TRUTH (TypeScript contracts)
│   │   └── index.ts
│   └── schemas/             <-- JSON Schemas for cross-language validation
│       └── resqnet-contract.json
├── docs/
│   ├── ARCHITECTURE.md      <-- Full system architecture & 3 connectivity states
│   ├── API_CONTRACT.md      <-- REST API & batch synchronization spec
│   ├── TEAM_PLAYBOOK.md     <-- Git branching, lead governance & demo flow
│   └── PROMPTS_FOR_TEAM.md  <-- Copy-paste AI prompts for Aman, Gaurav, Vishal, Ruchit
├── mesh/                    <-- Vishal (BLE P2P, store-and-forward, ProtestChat)
├── backend/                 <-- Gaurav (Node.js API, PostgreSQL database)
├── matching-engine/         <-- Gaurav (Python FastAPI, RapidFuzz, explainable XAI)
├── mobile/                  <-- Aman (React Native / Expo client, emergency UI)
└── admin-dashboard/         <-- Ruchit (Next.js Command Center, verification queue)
```

---

## ⚡ Quick Setup & Git Workflow

### 1. Initialize Git Remote
```bash
git remote add origin https://github.com/<your-username>/ResQNet.git
git branch -M main
git push -u origin main
```

### 2. Feature Branches
Each member checks out their branch:
```bash
# Vishal:
git checkout -b feature/mesh

# Gaurav:
git checkout -b feature/backend

# Aman:
git checkout -b feature/mobile

# Ruchit:
git checkout -b feature/admin
```

---

## 📖 Essential Documentation
- [System Architecture](file:///docs/ARCHITECTURE.md)
- [API & Sync Contract](file:///docs/API_CONTRACT.md)
- [Team Playbook & Demo Script](file:///docs/TEAM_PLAYBOOK.md)
- [AI Prompts for All 4 Members](file:///docs/PROMPTS_FOR_TEAM.md)
