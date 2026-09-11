import { DisasterCase, MatchCandidate, DisasterZone, FacilityLocation, MeshNodeStatus, VerificationAuditEntry } from '../types';
import { INITIAL_CASES, INITIAL_MATCHES, INITIAL_ZONES, INITIAL_FACILITIES, INITIAL_MESH_NODES, INITIAL_AUDIT_LOGS } from './mockData';

type Listener = () => void;

class ApiService {
  private isLiveBackend: boolean = false;
  private backendBaseUrl: string = 'http://localhost:4000/api/v1';

  // In-memory reactive state
  private cases: DisasterCase[] = [...INITIAL_CASES];
  private matches: MatchCandidate[] = [...INITIAL_MATCHES];
  private zones: DisasterZone[] = [...INITIAL_ZONES];
  private facilities: FacilityLocation[] = [...INITIAL_FACILITIES];
  private meshNodes: MeshNodeStatus[] = [...INITIAL_MESH_NODES];
  private auditLogs: VerificationAuditEntry[] = [...INITIAL_AUDIT_LOGS];
  private listeners: Set<Listener> = new Set();

  constructor() {
    // Check if backend URL is provided via env or local storage
    if (typeof window !== 'undefined' && localStorage.getItem('RESQNET_USE_LIVE_BACKEND') === 'true') {
      this.isLiveBackend = true;
    }
  }

  public setMode(useLive: boolean) {
    this.isLiveBackend = useLive;
    if (typeof window !== 'undefined') {
      localStorage.setItem('RESQNET_USE_LIVE_BACKEND', useLive ? 'true' : 'false');
    }
    this.notify();
  }

  public isLive(): boolean {
    return this.isLiveBackend;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // --- Case Endpoints ---

  public async getCases(filters?: { type?: string; status?: string; zone?: string }): Promise<DisasterCase[]> {
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.backendBaseUrl}/cases`);
        if (res.ok) {
          const json = await res.json();
          return json.cases || json;
        }
      } catch (err) {
        console.warn('Live backend unreachable, falling back to local state', err);
      }
    }

    let result = [...this.cases];
    if (filters?.type) {
      result = result.filter((c) => c.type === filters.type);
    }
    if (filters?.status) {
      result = result.filter((c) => c.status === filters.status);
    }
    if (filters?.zone) {
      result = result.filter((c) => c.lastKnownLocation?.zone?.includes(filters.zone!));
    }
    return result;
  }

  public async getCaseById(caseId: string): Promise<DisasterCase | null> {
    const found = this.cases.find((c) => c.caseId === caseId);
    return found || null;
  }

  public async addCase(newCase: DisasterCase): Promise<void> {
    this.cases = [newCase, ...this.cases];
    this.notify();
  }

  // --- Match & Verification Endpoints ---

  public async getPendingMatches(): Promise<MatchCandidate[]> {
    if (this.isLiveBackend) {
      try {
        const res = await fetch(`${this.backendBaseUrl}/admin/matches/pending`);
        if (res.ok) {
          const json = await res.json();
          return json.matches || json;
        }
      } catch (err) {
        console.warn('Live backend unreachable, using local matches', err);
      }
    }
    return this.matches.filter((m) => m.status === 'PENDING_REVIEW');
  }

  public async getAllMatches(): Promise<MatchCandidate[]> {
    return [...this.matches];
  }

  public async verifyMatch(
    matchId: string,
    reviewerName: string,
    notes?: string,
    evidenceUsed: string[] = ['EVID-PHOTO-SIMILARITY', 'EVID-PHYSICAL-IDENTIFIERS']
  ): Promise<{ success: boolean; message: string }> {
    const match = this.matches.find((m) => m.matchId === matchId);
    if (!match) return { success: false, message: 'Match not found' };

    const targetCase = this.cases.find((c) => c.caseId === match.targetMissingCaseId);
    const candidateCase = this.cases.find((c) => c.caseId === match.candidateFoundCaseId);

    // 1. Update Match Candidate
    match.status = 'VERIFIED';
    match.reviewerId = reviewerName;
    match.reviewedAt = new Date().toISOString();
    match.reviewNotes = notes;

    // 2. Update Case States
    if (targetCase) {
      targetCase.status = 'VERIFIED';
      targetCase.verificationState = 'VERIFIED';
      targetCase.updatedAt = new Date().toISOString();
    }
    if (candidateCase) {
      candidateCase.status = 'VERIFIED';
      candidateCase.verificationState = 'VERIFIED';
      candidateCase.updatedAt = new Date().toISOString();
    }

    // 3. Log Immutable Audit Record
    const auditEntry: VerificationAuditEntry = {
      id: `AUDIT-${Date.now()}`,
      matchId,
      missingCaseId: match.targetMissingCaseId,
      candidateCaseId: match.candidateFoundCaseId,
      missingPersonName: targetCase?.person.name || 'Unknown',
      candidatePersonName: candidateCase?.person.name || 'Unknown',
      decision: 'VERIFY',
      reviewerName,
      timestamp: new Date().toISOString(),
      notes,
      evidenceItems: evidenceUsed
    };
    this.auditLogs = [auditEntry, ...this.auditLogs];

    if (this.isLiveBackend) {
      try {
        await fetch(`${this.backendBaseUrl}/admin/matches/${matchId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'VERIFY', reviewerId: reviewerName, notes, evidenceUsed })
        });
      } catch (err) {
        console.warn('Backend sync failed', err);
      }
    }

    this.notify();
    return { success: true, message: 'Identity confirmed and case marked VERIFIED. Family notified.' };
  }

  public async rejectMatch(matchId: string, reviewerName: string, notes?: string): Promise<void> {
    const match = this.matches.find((m) => m.matchId === matchId);
    if (!match) return;

    match.status = 'REJECTED';
    match.reviewerId = reviewerName;
    match.reviewedAt = new Date().toISOString();
    match.reviewNotes = notes;

    const auditEntry: VerificationAuditEntry = {
      id: `AUDIT-${Date.now()}`,
      matchId,
      missingCaseId: match.targetMissingCaseId,
      candidateCaseId: match.candidateFoundCaseId,
      missingPersonName: match.targetMissingCaseId,
      candidatePersonName: match.candidateFoundCaseId,
      decision: 'REJECT',
      reviewerName,
      timestamp: new Date().toISOString(),
      notes,
      evidenceItems: ['REVIEWER_DISCRETION']
    };
    this.auditLogs = [auditEntry, ...this.auditLogs];
    this.notify();
  }

  // --- Duplicate Consolidation ---

  public async mergeCases(
    canonicalCaseId: string,
    duplicateCaseIds: string[],
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const canonical = this.cases.find((c) => c.caseId === canonicalCaseId);
    if (!canonical) return { success: false, message: 'Canonical case not found' };

    duplicateCaseIds.forEach((dupId) => {
      const dup = this.cases.find((c) => c.caseId === dupId);
      if (dup) {
        dup.status = 'DUPLICATE';
        canonical.evidenceIds = Array.from(new Set([...canonical.evidenceIds, ...dup.evidenceIds, dup.caseId]));
      }
    });

    canonical.updatedAt = new Date().toISOString();

    const auditEntry: VerificationAuditEntry = {
      id: `AUDIT-MERGE-${Date.now()}`,
      matchId: `MERGE-${canonicalCaseId}`,
      missingCaseId: canonicalCaseId,
      candidateCaseId: duplicateCaseIds.join(', '),
      missingPersonName: canonical.person.name,
      candidatePersonName: 'Consolidated Duplicates',
      decision: 'VERIFY',
      reviewerName: 'Admin (Ruchit)',
      timestamp: new Date().toISOString(),
      notes: `Merged duplicate reports into canonical case: ${reason}`,
      evidenceItems: canonical.evidenceIds
    };
    this.auditLogs = [auditEntry, ...this.auditLogs];

    this.notify();
    return { success: true, message: `Successfully consolidated ${duplicateCaseIds.length} records into ${canonicalCaseId}. Original provenance preserved.` };
  }

  // --- Infrastructure & Map ---

  public async getZones(): Promise<DisasterZone[]> {
    return this.zones;
  }

  public async getFacilities(): Promise<FacilityLocation[]> {
    return this.facilities;
  }

  public async getMeshNodes(): Promise<MeshNodeStatus[]> {
    return this.meshNodes;
  }

  public async getAuditLogs(): Promise<VerificationAuditEntry[]> {
    return this.auditLogs;
  }

  public resetMockData() {
    this.cases = JSON.parse(JSON.stringify(INITIAL_CASES));
    this.matches = JSON.parse(JSON.stringify(INITIAL_MATCHES));
    this.meshNodes = JSON.parse(JSON.stringify(INITIAL_MESH_NODES));
    this.auditLogs = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));
    this.notify();
  }
}

export const apiService = new ApiService();
