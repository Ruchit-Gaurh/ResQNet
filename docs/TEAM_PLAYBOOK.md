# RESQNET — Team Playbook & Git Governance

## 1. Team Ownership Matrix

| Member | Domain | Branch | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| **Vishal** | 📡 Mesh Transport & BLE | `feature/mesh` | BLE discovery, store-and-forward, deduplication, offline queue, transport API |
| **Gaurav** | 🧠 Backend & AI Matching | `feature/backend` | Node/Express API, PostgreSQL DB, Python FastAPI fuzzy matching, duplicate detection |
| **Aman** | 📱 Mobile App (Codex) | `feature/mobile` | Emergency UI (4 buttons), offline forms, family dashboard, local queue UX |
| **Ruchit** | 🖥️ Admin, Integration & Tech Lead | `feature/admin` | Command Center UI, verification queue, disaster map, PR reviews, demo orchestrator |

---

## 2. Tech Lead Governance Rules (Ruchit)

1. **Contract Supremacy**:
   - `shared/types/index.ts` and `shared/schemas/resqnet-contract.json` are immutable without explicit approval from Ruchit.
   - No individual developer may invent arbitrary field names (`person_id` vs `caseId`).
2. **Directory Isolation**:
   - Vishal stays in `mesh/`.
   - Gaurav stays in `backend/` and `matching-engine/`.
   - Aman stays in `mobile/`.
   - Ruchit stays in `admin-dashboard/` and handles `shared/` & integration.
   - **Never edit files in another person's directory** without coordinating!
3. **Daily / Hourly Integration Checkpoints**:
   - Rebase feature branches onto `main` regularly.
   - Run mock-based unit tests before merging PRs.
   - Ruchit holds final review authority before merging to `main`.

---

## 3. Git Workflow & Remote Setup

### Pushing this repository to GitHub:
```bash
# 1. Create a repository named "ResQNet" on GitHub (github.com/new)
# 2. Add remote origin and push initial scaffolding:
git remote add origin https://github.com/<your-github-username>/ResQNet.git
git branch -M main
git push -u origin main

# 3. Teammates create and checkout their feature branches:
git checkout -b feature/mesh      # Vishal
git checkout -b feature/backend   # Gaurav
git checkout -b feature/mobile    # Aman
git checkout -b feature/admin     # Ruchit
```

---

## 4. The Golden Hackathon Demo Flow (5-Minute Winner)

To blow the judges away, rehearse this exact 6-step sequence:

```
[Phone A: Family]
1. Reports missing brother "Rahul Sharma", Age 22, Zone A, wearing Blue T-shirt.
2. Turns Wi-Fi/Cellular OFF.
3. Status shows: "🟡 Saved locally — waiting for connectivity."

[BLE Mesh Hop]
4. Vishal brings Phone B nearby.
5. Phone A detects Phone B via BLE; envelope hops to Phone B.
6. Phone A updates: "🔵 Relayed through nearby device."

[Gateway to Cloud]
7. Phone B moves into an area with Wi-Fi / cellular (or gateway node).
8. Phone B triggers batch sync to Backend API.
9. Backend acknowledges message and registers canonical CASE-10291.

[Hospital Ingestion & AI Matching]
10. Hospital enters unidentified patient: "Rahool Sharma", Age 23, Zone B, Blue Shirt.
11. FastAPI matching microservice triggers automatically.
12. AI outputs: 91.2% MATCH CANDIDATE with explainable reasons.

[Admin Command Center (Ruchit)]
13. Admin dashboard highlights: "🚨 NEW POTENTIAL MATCH — 91%".
14. Ruchit reviews the explainable audit card (Name similarity, age delta, zone proximity).
15. Ruchit clicks [ VERIFY IDENTITY ].

[Instant Family Notification]
16. Phone A receives verified update:
    "🟢 PERSON LOCATED: Admitted at Zone B General Hospital. Family contact authorized."
```
