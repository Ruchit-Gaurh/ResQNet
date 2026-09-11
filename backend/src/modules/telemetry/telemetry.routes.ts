import { Router, Request, Response } from 'express';

export const telemetryRouter = Router();

const DISASTER_ZONES = [
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

const EMERGENCY_FACILITIES = [
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

const MESH_NODES = [
  {
    nodeId: 'NODE-GW-01',
    name: 'Sector 4 Starlink Satellite Gateway',
    role: 'GATEWAY',
    batteryLevel: 98,
    lat: 28.6139,
    lng: 77.2090,
    zone: 'Zone A',
    connectedPeersCount: 12,
    messagesInQueue: 4,
    lastSeenMs: 1200,
    isOnlineGateway: true
  },
  {
    nodeId: 'NODE-RELAY-02',
    name: 'Civil Hospital Tower Relay #2',
    role: 'CAMP_STATION',
    batteryLevel: 74,
    lat: 28.6190,
    lng: 77.2160,
    zone: 'Zone B',
    connectedPeersCount: 18,
    messagesInQueue: 15,
    lastSeenMs: 3400,
    isOnlineGateway: true
  },
  {
    nodeId: 'NODE-VEHICLE-03',
    name: 'NDRF Ambulance Unit Echo-7',
    role: 'VEHICLE_NODE',
    batteryLevel: 88,
    lat: 28.6110,
    lng: 77.2130,
    zone: 'Zone A',
    connectedPeersCount: 7,
    messagesInQueue: 2,
    lastSeenMs: 900,
    isOnlineGateway: false
  },
  {
    nodeId: 'NODE-PHONE-04',
    name: 'Volunteer Relay Cluster (Sector 9)',
    role: 'PHONE_RELAY',
    batteryLevel: 42,
    lat: 28.6085,
    lng: 77.2240,
    zone: 'Zone C',
    connectedPeersCount: 5,
    messagesInQueue: 28,
    lastSeenMs: 12000,
    isOnlineGateway: false
  }
];

const PHONE_CLUSTERS = [
  {
    clusterId: 'CLUSTER-01',
    name: 'Riverfront Displaced Citizens Mesh',
    zone: 'Zone A - Riverfront',
    lat: 28.6120,
    lng: 77.2070,
    phoneCount: 38,
    role: 'CITIZEN_CLUSTER',
    avgBattery: 61,
    totalPackets: 182,
    hopDistanceToGateway: 2
  },
  {
    clusterId: 'CLUSTER-02',
    name: 'Trauma Center Medic Field Network',
    zone: 'Zone B - Metro Corridor',
    lat: 28.6185,
    lng: 77.2145,
    phoneCount: 24,
    role: 'MEDIC_FIELD',
    avgBattery: 82,
    totalPackets: 410,
    hopDistanceToGateway: 1
  },
  {
    clusterId: 'CLUSTER-03',
    name: 'Sector 9 Industrial Search Teams',
    zone: 'Zone C - Industrial Sector 9',
    lat: 28.6090,
    lng: 77.2280,
    phoneCount: 17,
    role: 'SEARCH_TEAM',
    avgBattery: 54,
    totalPackets: 97,
    hopDistanceToGateway: 4
  }
];

// GET /api/v1/telemetry/zones
telemetryRouter.get('/zones', (_req: Request, res: Response) => {
  res.json({ success: true, zones: DISASTER_ZONES });
});

// GET /api/v1/telemetry/facilities
telemetryRouter.get('/facilities', (_req: Request, res: Response) => {
  res.json({ success: true, facilities: EMERGENCY_FACILITIES });
});

// GET /api/v1/telemetry/mesh-nodes
telemetryRouter.get('/mesh-nodes', (_req: Request, res: Response) => {
  res.json({ success: true, nodes: MESH_NODES });
});

// GET /api/v1/telemetry/phone-clusters
telemetryRouter.get('/phone-clusters', (_req: Request, res: Response) => {
  res.json({ success: true, clusters: PHONE_CLUSTERS });
});
