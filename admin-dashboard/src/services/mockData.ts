import { DisasterCase, MatchCandidate, DisasterZone, FacilityLocation, MeshNodeStatus, VerificationAuditEntry } from '../types';

export const INITIAL_ZONES: DisasterZone[] = [
  {
    id: 'ZONE-A',
    name: 'Zone A — Riverfront Flash Flood',
    polygonCoords: [[28.6110, 77.2050], [28.6180, 77.2080], [28.6150, 77.2180], [28.6080, 77.2120]],
    riskLevel: 'CRITICAL',
    missingCount: 68,
    foundCount: 34,
    activeMeshNodes: 9
  },
  {
    id: 'ZONE-B',
    name: 'Zone B — Metro Corridor & General Hospital',
    polygonCoords: [[28.6180, 77.2100], [28.6250, 77.2150], [28.6220, 77.2280], [28.6150, 77.2200]],
    riskLevel: 'HIGH',
    missingCount: 45,
    foundCount: 52,
    activeMeshNodes: 14
  },
  {
    id: 'ZONE-C',
    name: 'Zone C — Industrial Sector 9 Collapse',
    polygonCoords: [[28.6050, 77.2200], [28.6120, 77.2250], [28.6090, 77.2350], [28.6000, 77.2280]],
    riskLevel: 'MODERATE',
    missingCount: 29,
    foundCount: 12,
    activeMeshNodes: 6
  }
];

export const INITIAL_FACILITIES: FacilityLocation[] = [
  {
    id: 'FAC-HOSP-01',
    name: 'Zone B General Trauma Center',
    type: 'HOSPITAL',
    lat: 28.6195,
    lng: 77.2165,
    zone: 'Zone B',
    capacity: 250,
    currentOccupancy: 232,
    unidentifiedCount: 7,
    contactNumber: '+91-11-2345-0011'
  },
  {
    id: 'FAC-CAMP-01',
    name: 'City High School Relief Camp #1',
    type: 'RELIEF_CAMP',
    lat: 28.6145,
    lng: 77.2110,
    zone: 'Zone A',
    capacity: 800,
    currentOccupancy: 640,
    unidentifiedCount: 3,
    contactNumber: '+91-11-2345-0022'
  },
  {
    id: 'FAC-CAMP-02',
    name: 'Sector 9 Stadium Evacuation Center',
    type: 'RELIEF_CAMP',
    lat: 28.6075,
    lng: 77.2270,
    zone: 'Zone C',
    capacity: 1200,
    currentOccupancy: 890,
    unidentifiedCount: 4,
    contactNumber: '+91-11-2345-0033'
  }
];

export const INITIAL_CASES: DisasterCase[] = [
  {
    caseId: 'CASE-10291',
    type: 'MISSING',
    status: 'SEARCHING',
    priority: 'HIGH',
    person: {
      name: 'Rahul Sharma',
      nickname: 'Bittu',
      age: 22,
      gender: 'MALE',
      fatherMotherName: 'Ramesh Sharma (Father)',
      phoneNumber: '+91 98765 43210',
      alternateContact: '+91 98111 22334',
      identifyingMarks: 'Small scar above left eyebrow, black birthmark on neck',
      clothing: 'Navy blue round-neck t-shirt, dark denim jeans, grey sneakers',
      medicalNeeds: 'Asthma inhaler required daily',
      isMinor: false,
      photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80'
    },
    lastKnownLocation: {
      lat: 28.6139,
      lng: 77.2090,
      zone: 'Zone A — Riverfront Flash Flood',
      address: 'Near Old River Bridge, Sector 4'
    },
    lastKnownTime: '2026-09-11T07:45:00Z',
    source: 'FAMILY',
    sourceTrustScore: 0.95,
    verificationState: 'UNDER_REVIEW',
    createdAt: '2026-09-11T08:15:00Z',
    updatedAt: '2026-09-11T09:20:00Z',
    evidenceIds: ['EVID-FAM-10291', 'EVID-SIGHT-5510']
  },
  {
    caseId: 'CASE-10305',
    type: 'UNIDENTIFIED_PATIENT',
    status: 'INFORMATION_RECEIVED',
    priority: 'HIGH',
    person: {
      name: 'UNKNOWN PERSON (Tag: Rahool S.)',
      approximateAge: 23,
      gender: 'MALE',
      identifyingMarks: 'Laceration scar on left forehead/eyebrow, neck birthmark',
      clothing: 'Blue t-shirt (stained), black trousers',
      medicalNeeds: 'Treated for mild concussion & smoke inhalation. Stable.',
      isMinor: false,
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80'
    },
    lastKnownLocation: {
      lat: 28.6195,
      lng: 77.2165,
      zone: 'Zone B — General Trauma Center',
      address: 'Trauma Ward 2, Bed 14'
    },
    lastKnownTime: '2026-09-11T09:10:00Z',
    source: 'HOSPITAL',
    sourceTrustScore: 0.98,
    verificationState: 'UNVERIFIED',
    createdAt: '2026-09-11T09:15:00Z',
    updatedAt: '2026-09-11T09:15:00Z',
    evidenceIds: ['EVID-HOSP-10305']
  },
  {
    caseId: 'CASE-10292',
    type: 'MISSING',
    status: 'SEARCHING',
    priority: 'CRITICAL',
    person: {
      name: 'Riya Patel',
      age: 8,
      gender: 'FEMALE',
      fatherMotherName: 'Pooja Patel',
      clothing: 'Bright yellow raincoat with blue school uniform skirt',
      identifyingMarks: 'Small mole on right cheek',
      isMinor: true,
      photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80'
    },
    lastKnownLocation: {
      lat: 28.6190,
      lng: 77.2130,
      zone: 'Zone B',
      address: 'Near Primary School Bus Stop'
    },
    lastKnownTime: '2026-09-11T08:00:00Z',
    source: 'FAMILY',
    sourceTrustScore: 0.92,
    verificationState: 'UNDER_REVIEW',
    createdAt: '2026-09-11T08:30:00Z',
    updatedAt: '2026-09-11T08:30:00Z',
    evidenceIds: ['EVID-FAM-10292']
  },
  {
    caseId: 'CASE-10293',
    type: 'MISSING',
    status: 'SEARCHING',
    priority: 'HIGH',
    person: {
      name: 'Vikram Malhotra',
      age: 67,
      gender: 'MALE',
      clothing: 'White kurta-pyjama, brown cardigan',
      identifyingMarks: 'Spectacles, walking stick, silver wristwatch',
      medicalNeeds: 'Diabetic — requires regular insulin administration',
      isMinor: false,
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80'
    },
    lastKnownLocation: {
      lat: 28.6080,
      lng: 77.2250,
      zone: 'Zone C',
      address: 'Industrial Colony Gate 2'
    },
    lastKnownTime: '2026-09-11T06:30:00Z',
    source: 'FAMILY',
    sourceTrustScore: 0.90,
    verificationState: 'UNDER_REVIEW',
    createdAt: '2026-09-11T07:15:00Z',
    updatedAt: '2026-09-11T07:15:00Z',
    evidenceIds: ['EVID-FAM-10293']
  },
  {
    caseId: 'CASE-10307',
    type: 'FOUND',
    status: 'INFORMATION_RECEIVED',
    priority: 'HIGH',
    person: {
      name: 'UNKNOWN ELDERLY CITIZEN',
      approximateAge: 68,
      gender: 'MALE',
      clothing: 'Torn white kurta with brown cardigan',
      identifyingMarks: 'Disoriented, silver watch, lost spectacles',
      medicalNeeds: 'Low blood sugar symptoms, receiving glucose IV',
      isMinor: false,
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80'
    },
    lastKnownLocation: {
      lat: 28.6075,
      lng: 77.2270,
      zone: 'Zone C',
      address: 'Relief Camp #3 Medical Tent'
    },
    lastKnownTime: '2026-09-11T09:40:00Z',
    source: 'RELIEF_CAMP',
    sourceTrustScore: 0.96,
    verificationState: 'UNVERIFIED',
    createdAt: '2026-09-11T09:45:00Z',
    updatedAt: '2026-09-11T09:45:00Z',
    evidenceIds: ['EVID-CAMP-10307']
  }
];

export const INITIAL_MATCHES: MatchCandidate[] = [
  {
    matchId: 'MATCH-4821',
    targetMissingCaseId: 'CASE-10291',
    candidateFoundCaseId: 'CASE-10305',
    overallScore: 91.2,
    confidenceLevel: 'STRONG_CANDIDATE',
    breakdown: {
      nameScore: 94.0,
      ageScore: 95.0,
      locationScore: 88.5,
      timelineScore: 92.0,
      physicalScore: 86.0,
      photoScore: 82.0
    },
    reasons: [
      '✓ High phonetic name similarity: "Rahool Sharma" vs "Rahul Sharma" (RapidFuzz token score: 94%)',
      '✓ Age difference is within 1 year (23 vs 22)',
      '✓ Location proximity: 0.7 km between Zone A riverfront and Zone B General Hospital',
      '✓ Clothing match: Navy blue t-shirt matches hospital intake clothing description',
      '✓ Identifying marks: Facial eyebrow scar & birthmark verified on admission form'
    ],
    warnings: [
      '⚠ Facial photo embedding similarity is 82% — requires mandatory human responder confirmation',
      '⚠ Minor spelling variance recorded at emergency intake desk'
    ],
    status: 'PENDING_REVIEW',
    createdAt: '2026-09-11T09:20:00Z'
  },
  {
    matchId: 'MATCH-4822',
    targetMissingCaseId: 'CASE-10293',
    candidateFoundCaseId: 'CASE-10307',
    overallScore: 84.8,
    confidenceLevel: 'STRONG_CANDIDATE',
    breakdown: {
      nameScore: 40.0, // Name unknown
      ageScore: 98.0,
      locationScore: 94.0,
      timelineScore: 90.0,
      physicalScore: 96.0,
      photoScore: 78.0
    },
    reasons: [
      '✓ Exact physical match: White kurta with brown cardigan and silver wristwatch',
      '✓ Medical condition correlation: Known diabetic missing person vs disoriented patient in hypoglycemic state',
      '✓ Age match: 67 years reported vs ~68 years estimated by camp doctor',
      '✓ Location proximity: Found 200m from reported Gate 2 location'
    ],
    warnings: [
      '⚠ Name unknown on intake — patient currently disoriented and unable to speak clearly',
      '⚠ Direct family confirmation recommended via video or photograph review'
    ],
    status: 'PENDING_REVIEW',
    createdAt: '2026-09-11T09:50:00Z'
  }
];

export const INITIAL_MESH_NODES: MeshNodeStatus[] = [
  {
    nodeId: 'NODE-PHONE-A',
    name: 'Volunteer Relay (Zone A)',
    role: 'PHONE_RELAY',
    batteryLevel: 78,
    lat: 28.6130,
    lng: 77.2085,
    zone: 'Zone A',
    connectedPeersCount: 4,
    messagesInQueue: 2,
    lastSeenMs: Date.now() - 15000,
    isOnlineGateway: false
  },
  {
    nodeId: 'NODE-PHONE-B',
    name: 'Courier Relay Mobile (Zone A-B Corridor)',
    role: 'PHONE_RELAY',
    batteryLevel: 62,
    lat: 28.6165,
    lng: 77.2120,
    zone: 'Zone B',
    connectedPeersCount: 6,
    messagesInQueue: 5,
    lastSeenMs: Date.now() - 4000,
    isOnlineGateway: false
  },
  {
    nodeId: 'NODE-CAMP-STATION',
    name: 'Relief Camp Station #1',
    role: 'CAMP_STATION',
    batteryLevel: 95,
    lat: 28.6145,
    lng: 77.2110,
    zone: 'Zone A',
    connectedPeersCount: 9,
    messagesInQueue: 11,
    lastSeenMs: Date.now() - 2000,
    isOnlineGateway: false
  },
  {
    nodeId: 'NODE-GATEWAY-01',
    name: 'Disaster Command Starlink Gateway',
    role: 'GATEWAY',
    batteryLevel: 100,
    lat: 28.6210,
    lng: 77.2190,
    zone: 'Zone B',
    connectedPeersCount: 18,
    messagesInQueue: 0,
    lastSeenMs: Date.now() - 500,
    isOnlineGateway: true
  }
];

export const INITIAL_AUDIT_LOGS: VerificationAuditEntry[] = [
  {
    id: 'AUDIT-101',
    matchId: 'MATCH-4819',
    missingCaseId: 'CASE-10280',
    candidateCaseId: 'CASE-10299',
    missingPersonName: 'Sunita Devi',
    candidatePersonName: 'Sunita Devi',
    decision: 'VERIFY',
    reviewerName: 'Ruchit Gaurh (Lead)',
    timestamp: '2026-09-11T07:10:00Z',
    notes: 'Confirmed with family photo and voter ID found in purse. Reunited at Relief Camp #1.',
    evidenceItems: ['EVID-PHOTO-01', 'EVID-ID-CARD']
  }
];
