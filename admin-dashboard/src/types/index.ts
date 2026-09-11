export * from '../../../shared/types/index';

export interface DisasterZone {
  id: string;
  name: string;
  polygonCoords: [number, number][];
  riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  missingCount: number;
  foundCount: number;
  activeMeshNodes: number;
}

export interface FacilityLocation {
  id: string;
  name: string;
  type: 'HOSPITAL' | 'RELIEF_CAMP' | 'COMMAND_POST';
  lat: number;
  lng: number;
  zone: string;
  capacity?: number;
  currentOccupancy?: number;
  unidentifiedCount?: number;
  contactNumber?: string;
}

export interface MeshNodeStatus {
  nodeId: string;
  name: string;
  role: 'PHONE_RELAY' | 'GATEWAY' | 'VEHICLE_NODE' | 'CAMP_STATION';
  batteryLevel?: number;
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  zone?: string;
  connectedPeersCount: number;
  nearbyPeerIds?: string[];
  messagesInQueue: number;
  lastSeenMs: number;
  lastSeenAt?: string;
  locationObservedAt?: string;
  lastGatewayContactAt?: string;
  transportMode?: 'MOCK_IN_PROCESS' | 'DEV_EMULATOR_MESH' | 'NATIVE_BLE';
  connectionState?: 'ONLINE_DIRECT' | 'OFFLINE_RELAYED' | 'STALE';
  connectivitySource?: 'DIRECT' | 'RELAYED';
  relayedByNodeId?: string;
  isOnlineGateway: boolean;
}

export interface PhoneDeviceInfo {
  id: string;
  model: string;
  ownerType: 'FAMILY' | 'VOLUNTEER' | 'MEDIC' | 'SEARCH_TEAM' | 'DISPLACED';
  battery: number;
  packetsInQueue: number;
  signalRssi: number;
  lastHopTime: string;
}

export interface PhoneMeshCluster {
  clusterId: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  phoneCount: number;
  role: 'CITIZEN_CLUSTER' | 'COURIER_MULES' | 'CAMP_AGGREGATOR' | 'MEDIC_FIELD' | 'SEARCH_TEAM' | 'STARLINK_GATEWAY';
  avgBattery: number;
  totalPackets: number;
  hopDistanceToGateway: number;
  devices: PhoneDeviceInfo[];
}

export interface VerificationAuditEntry {
  id: string;
  matchId: string;
  missingCaseId: string;
  candidateCaseId: string;
  missingPersonName: string;
  candidatePersonName: string;
  decision: 'VERIFY' | 'REJECT' | 'NEEDS_MORE_INFO';
  reviewerName: string;
  timestamp: string;
  notes?: string;
  evidenceItems: string[];
}
