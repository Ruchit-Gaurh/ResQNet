import { DisasterCase, MatchCandidate, DisasterZone, FacilityLocation, MeshNodeStatus, VerificationAuditEntry, PhoneMeshCluster } from '../types';
import { INITIAL_CASES, INITIAL_MATCHES, INITIAL_ZONES, INITIAL_FACILITIES, INITIAL_MESH_NODES, INITIAL_AUDIT_LOGS, INITIAL_PHONE_CLUSTERS } from './mockData';

type Listener = () => void;

const DEFAULT_BACKEND_ORIGIN = 'https://resqnet-backend-2gof.onrender.com';
const ADMIN_TOKEN_STORAGE_KEY = 'RESQNET_ADMIN_TOKEN';

function normalizedBackendOrigin(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  // Local Vite development uses same-origin /api and /health proxy routes.
  // This avoids CORS/browser-extension blocking of direct Render requests.
  if (import.meta.env.DEV && !configured) return '';
  const origin = configured || DEFAULT_BACKEND_ORIGIN;
  return origin.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
}

class ApiService {
  private isLiveBackend: boolean = true;
  private readonly backendOrigin = normalizedBackendOrigin();
  private readonly backendBaseUrl = this.backendOrigin ? `${this.backendOrigin}/api/v1` : '/api/v1';
  private authToken: string | null = null;

  // In-memory reactive state (always available as fallback & immediate cache)
  private cases: DisasterCase[] = [...INITIAL_CASES];
  private matches: MatchCandidate[] = [...INITIAL_MATCHES];
  private zones: DisasterZone[] = [];
  private facilities: FacilityLocation[] = [];
  private meshNodes: MeshNodeStatus[] = [];
  private auditLogs: VerificationAuditEntry[] = [...INITIAL_AUDIT_LOGS];
  private listeners: Set<Listener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('RESQNET_USE_LIVE_BACKEND');
      // Default to live backend enabled
      this.isLiveBackend = stored !== null ? stored === 'true' : true;
      this.authToken = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      if (this.isLiveBackend) {
        this.cases = [];
        this.matches = [];
        this.auditLogs = [];
      }
    }
  }

  public setMode(useLive: boolean) {
    this.isLiveBackend = useLive;
    if (typeof window !== 'undefined') {
      localStorage.setItem('RESQNET_USE_LIVE_BACKEND', useLive ? 'true' : 'false');
    }
    if (useLive) {
      this.cases = [];
      this.matches = [];
      this.auditLogs = [];
      this.zones = [];
      this.facilities = [];
      this.meshNodes = [];
    } else {
      this.resetMockData(false);
    }
    this.notify();
  }

  public isLive(): boolean {
    return this.isLiveBackend;
  }

  public getBackendOrigin(): string {
    return this.backendOrigin || `${DEFAULT_BACKEND_ORIGIN} (via localhost proxy)`;
  }

  public isAdminAuthenticated(): boolean {
    return Boolean(this.authToken);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // --- Production responder authentication ---

  public async authenticateAdmin(accessKey: string): Promise<void> {
    const response = await fetch(`${this.backendBaseUrl}/auth/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey: accessKey.trim() }),
    });
    const payload = await response.json().catch(() => ({})) as { token?: string; error?: string };
    if (!response.ok || !payload.token) {
      throw new Error(payload.error || `Administrator sign-in failed with HTTP ${response.status}.`);
    }
    this.authToken = payload.token;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, payload.token);
    }
    this.notify();
  }

  public logoutAdmin(): void {
    this.clearAdminSession();
    this.notify();
  }

  private clearAdminSession(): void {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  }

  private async authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    const response = await fetch(`${this.backendBaseUrl}${endpoint}`, {
      ...options,
      headers
    });
    if (response.status === 401 || response.status === 403) {
      this.clearAdminSession();
      this.notify();
    }
    return response;
  }

  public async checkBackendHealth(): Promise<{ online: boolean; port: number; service?: string }> {
    try {
      const res = await fetch(this.backendOrigin ? `${this.backendOrigin}/health` : '/health');
      if (res.ok) {
        const data = await res.json();
        return { online: true, port: 443, service: data.service };
      }
    } catch {
      return { online: false, port: 443 };
    }
    return { online: false, port: 443 };
  }

  // --- Case Endpoints ---

  public async getCases(filters?: { type?: string; status?: string; zone?: string }): Promise<DisasterCase[]> {
    if (this.isLiveBackend) {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.zone) params.set('zone', filters.zone);

      const url = `/cases${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await this.authFetch(url);
      if (!res.ok) throw new Error(`Live cases request failed with HTTP ${res.status}.`);
      const json = await res.json();
      const remoteCases = json.cases || json;
      if (Array.isArray(remoteCases)) {
        this.cases = remoteCases;
        return remoteCases;
      }
      throw new Error('Live cases response was not a case list.');
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
    if (this.isLiveBackend) {
      try {
        const res = await this.authFetch(`/cases/${caseId}`);
        if (res.ok) {
          const json = await res.json();
          return json;
        }
      } catch (err) {
        console.warn('Live backend getCaseById unreachable, falling back to cache', err);
      }
    }
    const found = this.cases.find((c) => c.caseId === caseId);
    return found || null;
  }

  public async addCase(newCase: DisasterCase): Promise<void> {
    this.cases = [newCase, ...this.cases];

    if (this.isLiveBackend) {
      try {
        const endpoint = newCase.type === 'MISSING' ? '/cases/missing' : '/cases/found';
        const payload = newCase.type === 'MISSING' ? {
          person: newCase.person,
          priority: newCase.priority,
          lastKnownLocation: newCase.lastKnownLocation,
          lastKnownTime: newCase.lastKnownTime,
          source: newCase.source
        } : {
          person: newCase.person,
          location: newCase.lastKnownLocation,
          source: newCase.source
        };

        await this.authFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.warn('Failed to sync new case to backend', err);
      }
    }

    this.notify();
  }

  // --- Match & Verification Endpoints ---

  public async getPendingMatches(): Promise<MatchCandidate[]> {
    if (this.isLiveBackend) {
      try {
        const res = await this.authFetch('/admin/matches/pending');
        if (res.ok) {
          const json = await res.json();
          const remoteMatches = json.matches || json;
          if (Array.isArray(remoteMatches)) {
            return remoteMatches;
          }
        }
      } catch (err) {
        console.warn('Live backend unreachable, using local matches', err);
      }
    }
    return this.matches.filter((m) => m.status === 'PENDING_REVIEW');
  }

  public async getAllMatches(): Promise<MatchCandidate[]> {
    if (this.isLiveBackend) {
      const res = await this.authFetch('/admin/matches');
      if (!res.ok) throw new Error(`Live matches request failed with HTTP ${res.status}.`);
      const json = await res.json();
      const remoteMatches = json.matches || json;
      if (Array.isArray(remoteMatches)) {
        this.matches = remoteMatches;
        return remoteMatches;
      }
      throw new Error('Live matches response was not a match list.');
    }
    return [...this.matches];
  }

  public async verifyMatch(
    matchId: string,
    reviewerName: string,
    notes?: string,
    evidenceUsed: string[] = ['EVID-PHOTO-SIMILARITY', 'EVID-PHYSICAL-IDENTIFIERS']
  ): Promise<{ success: boolean; message: string }> {
    if (this.isLiveBackend) {
      const response = await this.authFetch(`/admin/matches/${matchId}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'VERIFY',
          reviewerId: reviewerName,
          notes: notes || 'Verified identity by responder',
          evidenceUsed
        })
      });
      if (!response.ok) {
        throw new Error(`Backend verification failed with HTTP ${response.status}.`);
      }
      await Promise.all([this.getCases(), this.getAllMatches()]);
      this.notify();
      return { success: true, message: 'Identity confirmed by the backend. Family notified.' };
    }

    const match = this.matches.find((m) => m.matchId === matchId);
    if (match) {
      match.status = 'VERIFIED';
      match.reviewerId = reviewerName;
      match.reviewedAt = new Date().toISOString();
      match.reviewNotes = notes;
    }

    const targetCase = this.cases.find((c) => c.caseId === match?.targetMissingCaseId);
    const candidateCase = this.cases.find((c) => c.caseId === match?.candidateFoundCaseId);

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

    const auditEntry: VerificationAuditEntry = {
      id: `AUDIT-${Date.now()}`,
      matchId,
      missingCaseId: match?.targetMissingCaseId || 'CASE-TARGET',
      candidateCaseId: match?.candidateFoundCaseId || 'CASE-CANDIDATE',
      missingPersonName: targetCase?.person.name || 'Subject',
      candidatePersonName: candidateCase?.person.name || 'Candidate',
      decision: 'VERIFY',
      reviewerName,
      timestamp: new Date().toISOString(),
      notes,
      evidenceItems: evidenceUsed
    };
    this.auditLogs = [auditEntry, ...this.auditLogs];

    this.notify();
    return { success: true, message: 'Identity confirmed in local demonstration data.' };
  }

  public async rejectMatch(matchId: string, reviewerName: string, notes?: string): Promise<void> {
    if (this.isLiveBackend) {
      const response = await this.authFetch(`/admin/matches/${matchId}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'REJECT',
          reviewerId: reviewerName,
          notes: notes || 'Rejected candidate match',
          evidenceUsed: ['REVIEWER_DISCRETION']
        })
      });
      if (!response.ok) {
        throw new Error(`Backend rejection failed with HTTP ${response.status}.`);
      }
      await this.getAllMatches();
      this.notify();
      return;
    }

    const match = this.matches.find((m) => m.matchId === matchId);
    if (match) {
      match.status = 'REJECTED';
      match.reviewerId = reviewerName;
      match.reviewedAt = new Date().toISOString();
      match.reviewNotes = notes;
    }

    const auditEntry: VerificationAuditEntry = {
      id: `AUDIT-${Date.now()}`,
      matchId,
      missingCaseId: match?.targetMissingCaseId || 'CASE-TARGET',
      candidateCaseId: match?.candidateFoundCaseId || 'CASE-CANDIDATE',
      missingPersonName: match?.targetMissingCaseId || 'Target Case',
      candidatePersonName: match?.candidateFoundCaseId || 'Candidate Case',
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

    if (this.isLiveBackend) {
      try {
        await this.authFetch('/admin/cases/merge', {
          method: 'POST',
          body: JSON.stringify({
            canonicalCaseId,
            duplicateCaseIds,
            reason
          })
        });
        await this.getCases();
      } catch (err) {
        console.warn('Backend merge cases sync failed', err);
      }
    }

    this.notify();
    return { success: true, message: `Successfully consolidated ${duplicateCaseIds.length} records into ${canonicalCaseId}. Original provenance preserved.` };
  }

  // --- Infrastructure & Map ---

  public async getZones(): Promise<DisasterZone[]> {
    if (this.isLiveBackend) {
      try {
        const res = await this.authFetch('/telemetry/zones');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.zones)) {
            this.zones = json.zones;
            return this.zones;
          }
        }
      } catch { /* Fallback */ }
    }
    return this.zones;
  }

  public async getFacilities(): Promise<FacilityLocation[]> {
    if (this.isLiveBackend) {
      try {
        const res = await this.authFetch('/telemetry/facilities');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.facilities)) {
            this.facilities = json.facilities;
            return this.facilities;
          }
        }
      } catch { /* Fallback */ }
    }
    return this.facilities;
  }

  public async getMeshNodes(): Promise<MeshNodeStatus[]> {
    if (this.isLiveBackend) {
      try {
        const res = await this.authFetch('/telemetry/mesh-nodes');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.nodes)) {
            this.meshNodes = json.nodes;
            return this.meshNodes;
          }
        }
      } catch { /* Fallback */ }
    }
    return this.meshNodes;
  }

  public async getAuditLogs(): Promise<VerificationAuditEntry[]> {
    if (this.isLiveBackend) {
      const res = await this.authFetch('/admin/audit-logs');
      if (!res.ok) throw new Error(`Live audit request failed with HTTP ${res.status}.`);
      const json = await res.json();
      if (Array.isArray(json.logs)) {
        this.auditLogs = json.logs;
        return json.logs;
      }
      throw new Error('Live audit response was not an audit list.');
    }
    return this.auditLogs;
  }

  public async getPhoneClusters(): Promise<PhoneMeshCluster[]> {
    if (this.isLiveBackend) {
      try {
        const res = await this.authFetch('/telemetry/phone-clusters');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.clusters)) {
            return json.clusters;
          }
        }
      } catch { /* Fallback */ }
    }
    return this.isLiveBackend ? [] : INITIAL_PHONE_CLUSTERS;
  }

  public resetMockData(shouldNotify: boolean = true) {
    this.cases = JSON.parse(JSON.stringify(INITIAL_CASES));
    this.matches = JSON.parse(JSON.stringify(INITIAL_MATCHES));
    this.meshNodes = JSON.parse(JSON.stringify(INITIAL_MESH_NODES));
    this.auditLogs = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));
    if (shouldNotify) this.notify();
  }
}

export const apiService = new ApiService();
