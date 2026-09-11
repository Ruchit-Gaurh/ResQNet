/**
 * RESQNET — Shared Types and Data Contracts
 * This is the SINGLE SOURCE OF TRUTH for all team members (Mobile, Mesh, Backend, Admin).
 * DO NOT modify field names without team alignment.
 */

// ==========================================
// 1. Core Enumerations
// ==========================================

export type UserRole =
  | 'FAMILY'
  | 'PUBLIC'
  | 'VOLUNTEER'
  | 'HOSPITAL'
  | 'RELIEF_CAMP'
  | 'RESPONDER_ADMIN';

export type ReportSource =
  | 'FAMILY'
  | 'PUBLIC'
  | 'VOLUNTEER'
  | 'HOSPITAL'
  | 'RELIEF_CAMP'
  | 'RESPONDER';

export type CaseType =
  | 'MISSING'
  | 'FOUND'
  | 'UNIDENTIFIED_PATIENT';

export type CaseStatus =
  | 'REGISTERED'
  | 'SEARCHING'
  | 'INFORMATION_RECEIVED'
  | 'POSSIBLE_MATCH'
  | 'UNDER_VERIFICATION'
  | 'VERIFIED'
  | 'FAMILY_NOTIFIED'
  | 'REUNITED'
  | 'CLOSED'
  | 'REJECTED'
  | 'DUPLICATE';

export type PriorityLevel =
  | 'CRITICAL'
  | 'HIGH'
  | 'NORMAL'
  | 'LOW';

export type VerificationState =
  | 'UNVERIFIED'
  | 'CORROBORATED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED';

export type MatchConfidenceLevel =
  | 'NO_MATCH'        // 0-39%
  | 'WEAK_CANDIDATE'   // 40-59%
  | 'POSSIBLE_MATCH'   // 60-79%
  | 'STRONG_CANDIDATE' // 80-99%
  | 'HUMAN_VERIFIED';  // Confirmed by authorized human

export type MeshConnectivityState =
  | 'INTERNET_CONNECTED'
  | 'MESH_CONNECTED'
  | 'OFFLINE_QUEUED'
  | 'ISOLATED';

export type MeshMessageType =
  | 'SAFE_STATUS'
  | 'MISSING_PERSON'
  | 'FOUND_PERSON'
  | 'SIGHTING'
  | 'EMERGENCY'
  | 'CASE_UPDATE'
  | 'MATCH_CANDIDATE'
  | 'VERIFICATION_REQUEST'
  | 'VERIFICATION_RESULT'
  | 'CASE_MERGE'
  | 'CASE_SPLIT'
  | 'HOSPITAL_ADMISSION'
  | 'CAMP_REGISTRATION'
  | 'SYNC_REQUEST'
  | 'SYNC_RESPONSE'
  | 'NETWORK_STATUS';

// ==========================================
// 2. Person & Location Definitions
// ==========================================

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  address?: string;
  zone?: string; // e.g. "Zone A - Sector 4"
}

export interface PersonProfile {
  name: string;
  nickname?: string;
  age?: number;
  approximateAge?: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  fatherMotherName?: string;
  phoneNumber?: string;
  alternateContact?: string;
  identifyingMarks?: string;
  height?: string;
  clothing?: string;
  medicalNeeds?: string;
  isMinor?: boolean;
  photoUrl?: string; // Base64 or local URI or S3/cloud URL
  languageSpoken?: string;
}

// ==========================================
// 3. Case & Evidence Graph
// ==========================================

export interface DisasterCase {
  caseId: string; // e.g. "CASE-10291"
  type: CaseType;
  status: CaseStatus;
  priority: PriorityLevel;
  person: PersonProfile;
  lastKnownLocation?: GeoLocation;
  lastKnownTime?: string; // ISO 8601 string
  source: ReportSource;
  sourceTrustScore: number; // 0.0 - 1.0
  verificationState: VerificationState;
  createdAt: string;
  updatedAt: string;
  createdById?: string;
  assignedVerifierId?: string;
  corroborationCount?: number;
  evidenceIds: string[];
}

export interface CaseTimelineEvent {
  eventId: string;
  caseId: string;
  timestamp: string;
  source: ReportSource;
  actorName?: string;
  title: string;
  description: string;
  verificationStatus: VerificationState;
}

export interface SightingReport {
  sightingId: string;
  targetCaseId?: string; // Optional if reported without known case
  personDescription: string;
  location: GeoLocation;
  timestamp: string;
  clothingDescription?: string;
  directionOfMovement?: string;
  confidenceScore: number; // Contributor self-assessed or computed
  photoUrl?: string;
  reportedByPseudonym: string;
  verificationState: VerificationState;
}

export interface SafeCheckIn {
  checkInId: string;
  personName: string;
  phoneNumber?: string;
  location: GeoLocation;
  timestamp: string;
  statusMessage?: string;
  affectedFamilyMembers?: string[];
  senderPseudonym: string;
}

// ==========================================
// 4. AI Matching & Verification Contracts
// ==========================================

export interface MatchScoreBreakdown {
  nameScore: number;       // Weight ~20%
  ageScore: number;        // Weight ~10%
  locationScore: number;   // Weight ~20%
  timelineScore: number;   // Weight ~15%
  physicalScore: number;   // Weight ~10%
  photoScore?: number;     // Weight ~25%
}

export interface MatchCandidate {
  matchId: string;
  targetMissingCaseId: string;
  candidateFoundCaseId: string; // Found person, hospital, or camp case
  overallScore: number; // 0 to 100
  confidenceLevel: MatchConfidenceLevel;
  breakdown: MatchScoreBreakdown;
  reasons: string[]; // Explainable bullet points e.g. ["✓ Similar name (94%)", "✓ Location within 1.8km"]
  warnings: string[]; // e.g. ["⚠ Photo requires human manual verification"]
  status: 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'NEEDS_MORE_INFO';
  reviewerId?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface VerificationSubmission {
  matchId: string;
  decision: 'VERIFY' | 'REJECT' | 'NEEDS_MORE_INFO';
  reviewerId: string;
  reviewerRole: UserRole;
  evidenceUsed: string[];
  notes?: string;
  timestamp: string;
}

// ==========================================
// 5. Mesh Networking Envelope (ProtestChat compatible)
// ==========================================

export interface MeshEnvelope<T = any> {
  messageId: string;              // UUID v4
  messageType: MeshMessageType;
  priority: PriorityLevel;
  createdAt: number;              // Epoch ms
  expiresAt: number;              // Epoch ms (TTL enforcement)
  hopCount: number;               // Incremented per hop
  maxHops: number;                // Default 5-7
  senderPseudonym: string;        // Ephemeral rotating ID
  destinationType: 'BROADCAST' | 'GATEWAY' | 'SPECIFIC_NODE';
  destinationId?: string;
  payload: T;                     // JSON payload matching messageType
  signature?: string;             // Integrity check
  acknowledged?: boolean;
}

export interface NetworkHealthStatus {
  connectivity: MeshConnectivityState;
  nearbyPeerCount: number;
  queuedMessageCount: number;
  lastSuccessfulSyncTimestamp?: number;
  batteryMode: 'NORMAL' | 'BATTERY_SAVER' | 'EMERGENCY_RELAY';
}

// ==========================================
// 6. Sync Engine Request / Response
// ==========================================

export interface SyncBatchRequest {
  deviceId: string;
  lastSyncTimestamp: number;
  outboundEnvelopes: MeshEnvelope[];
}

export interface SyncBatchResponse {
  acknowledgedMessageIds: string[];
  inboundCases: DisasterCase[];
  inboundMatches: MatchCandidate[];
  inboundTimelineEvents: CaseTimelineEvent[];
  serverTimestamp: number;
}
