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

export const INITIAL_PHONE_CLUSTERS: import('../types').PhoneMeshCluster[] = [
  {
    clusterId: 'CLUSTER-A-CITIZENS',
    name: 'Zone A Riverfront — Stranded Citizens Phone Mesh',
    zone: 'Zone A',
    lat: 28.6130,
    lng: 77.2085,
    phoneCount: 8,
    role: 'CITIZEN_CLUSTER',
    avgBattery: 74,
    totalPackets: 12,
    hopDistanceToGateway: 3,
    devices: [
      { id: 'PH-A01', model: 'Samsung Galaxy M34', ownerType: 'FAMILY', battery: 78, packetsInQueue: 3, signalRssi: -62, lastHopTime: '1m ago' },
      { id: 'PH-A02', model: 'Redmi Note 12 5G', ownerType: 'FAMILY', battery: 65, packetsInQueue: 2, signalRssi: -71, lastHopTime: '3m ago' },
      { id: 'PH-A03', model: 'OnePlus Nord CE 3', ownerType: 'FAMILY', battery: 82, packetsInQueue: 1, signalRssi: -58, lastHopTime: '45s ago' },
      { id: 'PH-A04', model: 'Realme Narzo 60', ownerType: 'FAMILY', battery: 59, packetsInQueue: 4, signalRssi: -77, lastHopTime: '2m ago' },
      { id: 'PH-A05', model: 'Vivo T2x', ownerType: 'DISPLACED', battery: 91, packetsInQueue: 0, signalRssi: -64, lastHopTime: 'Just now' },
      { id: 'PH-A06', model: 'POCO X5 Pro', ownerType: 'FAMILY', battery: 73, packetsInQueue: 1, signalRssi: -69, lastHopTime: '5m ago' },
      { id: 'PH-A07', model: 'Motorola G54', ownerType: 'DISPLACED', battery: 68, packetsInQueue: 1, signalRssi: -73, lastHopTime: '1m ago' },
      { id: 'PH-A08', model: 'iPhone 13', ownerType: 'FAMILY', battery: 80, packetsInQueue: 0, signalRssi: -60, lastHopTime: '30s ago' }
    ]
  },
  {
    clusterId: 'CLUSTER-COURIER-MULES',
    name: 'Sector A-B Corridor — Volunteer Courier Mules',
    zone: 'Zone B',
    lat: 28.6165,
    lng: 77.2120,
    phoneCount: 5,
    role: 'COURIER_MULES',
    avgBattery: 68,
    totalPackets: 8,
    hopDistanceToGateway: 2,
    devices: [
      { id: 'PH-B01', model: 'OnePlus 11R', ownerType: 'VOLUNTEER', battery: 72, packetsInQueue: 3, signalRssi: -55, lastHopTime: 'Just now' },
      { id: 'PH-B02', model: 'Samsung Galaxy A54', ownerType: 'VOLUNTEER', battery: 64, packetsInQueue: 2, signalRssi: -60, lastHopTime: '40s ago' },
      { id: 'PH-B03', model: 'iQOO Z7 Pro', ownerType: 'VOLUNTEER', battery: 81, packetsInQueue: 1, signalRssi: -63, lastHopTime: '1m ago' },
      { id: 'PH-B04', model: 'Pixel 7a', ownerType: 'VOLUNTEER', battery: 55, packetsInQueue: 2, signalRssi: -72, lastHopTime: '2m ago' },
      { id: 'PH-B05', model: 'Redmi K50i', ownerType: 'VOLUNTEER', battery: 70, packetsInQueue: 0, signalRssi: -58, lastHopTime: '30s ago' }
    ]
  },
  {
    clusterId: 'CLUSTER-CAMP-1',
    name: 'Relief Camp #1 Station — Displaced Families Mesh',
    zone: 'Zone A',
    lat: 28.6145,
    lng: 77.2110,
    phoneCount: 14,
    role: 'CAMP_AGGREGATOR',
    avgBattery: 86,
    totalPackets: 19,
    hopDistanceToGateway: 2,
    devices: [
      { id: 'PH-C01', model: 'Redmi Note 11', ownerType: 'DISPLACED', battery: 88, packetsInQueue: 2, signalRssi: -52, lastHopTime: 'Just now' },
      { id: 'PH-C02', model: 'Samsung Galaxy F14', ownerType: 'DISPLACED', battery: 92, packetsInQueue: 3, signalRssi: -48, lastHopTime: 'Just now' },
      { id: 'PH-C03', model: 'Vivo Y200', ownerType: 'DISPLACED', battery: 79, packetsInQueue: 1, signalRssi: -66, lastHopTime: '2m ago' },
      { id: 'PH-C04', model: 'Realme 11 Pro', ownerType: 'DISPLACED', battery: 85, packetsInQueue: 4, signalRssi: -54, lastHopTime: '1m ago' },
      { id: 'PH-C05', model: 'iPhone 12', ownerType: 'DISPLACED', battery: 94, packetsInQueue: 2, signalRssi: -50, lastHopTime: '30s ago' }
    ]
  },
  {
    clusterId: 'CLUSTER-HOSPITAL-MEDICS',
    name: 'Zone B Trauma Center — Medical Intake Mesh',
    zone: 'Zone B',
    lat: 28.6195,
    lng: 77.2165,
    phoneCount: 6,
    role: 'MEDIC_FIELD',
    avgBattery: 91,
    totalPackets: 5,
    hopDistanceToGateway: 1,
    devices: [
      { id: 'PH-M01', model: 'Samsung Galaxy Tab S8', ownerType: 'MEDIC', battery: 95, packetsInQueue: 2, signalRssi: -42, lastHopTime: 'Just now' },
      { id: 'PH-M02', model: 'Pixel 8', ownerType: 'MEDIC', battery: 88, packetsInQueue: 1, signalRssi: -46, lastHopTime: '15s ago' },
      { id: 'PH-M03', model: 'iPad Air 5th Gen', ownerType: 'MEDIC', battery: 92, packetsInQueue: 1, signalRssi: -40, lastHopTime: 'Just now' },
      { id: 'PH-M04', model: 'OnePlus 10 Pro', ownerType: 'MEDIC', battery: 89, packetsInQueue: 1, signalRssi: -50, lastHopTime: '1m ago' }
    ]
  },
  {
    clusterId: 'CLUSTER-SEARCH-TEAM',
    name: 'Sector 9 Collapse — Canine & Search Rescue Mesh',
    zone: 'Zone C',
    lat: 28.6080,
    lng: 77.2260,
    phoneCount: 4,
    role: 'SEARCH_TEAM',
    avgBattery: 79,
    totalPackets: 6,
    hopDistanceToGateway: 2,
    devices: [
      { id: 'PH-S01', model: 'Cat S62 Pro (Rugged Thermal)', ownerType: 'SEARCH_TEAM', battery: 84, packetsInQueue: 2, signalRssi: -59, lastHopTime: 'Just now' },
      { id: 'PH-S02', model: 'Ulefone Armor 21', ownerType: 'SEARCH_TEAM', battery: 76, packetsInQueue: 2, signalRssi: -64, lastHopTime: '45s ago' },
      { id: 'PH-S03', model: 'Samsung Galaxy XCover 6', ownerType: 'SEARCH_TEAM', battery: 82, packetsInQueue: 1, signalRssi: -61, lastHopTime: '2m ago' },
      { id: 'PH-S04', model: 'Blackview BV9900', ownerType: 'SEARCH_TEAM', battery: 74, packetsInQueue: 1, signalRssi: -68, lastHopTime: '1m ago' }
    ]
  }
];
