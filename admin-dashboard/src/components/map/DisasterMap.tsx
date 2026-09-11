import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DisasterZone, FacilityLocation, MeshNodeStatus, DisasterCase, PhoneMeshCluster } from '../../types';
import {
  Shield, Eye, EyeOff, Radio, Hospital, Tent, Layers, Users, MapPin,
  Navigation, Compass, Info, CheckCircle2, AlertTriangle, Activity,
  Smartphone, Waves, Flame, Zap, X, Signal, Battery, ChevronRight
} from 'lucide-react';

interface DisasterMapProps {
  zones: DisasterZone[];
  facilities: FacilityLocation[];
  meshNodes: MeshNodeStatus[];
  cases: DisasterCase[];
  phoneClusters?: PhoneMeshCluster[];
  selectedCaseId?: string;
  onSelectCase?: (caseId: string) => void;
}

// Controller component to smoothly invalidate size and fly to coordinates
const MapController: React.FC<{ targetCoords: [number, number] | null; zoom: number }> = ({ targetCoords, zoom }) => {
  const map = useMap();
  const prevTargetRef = useRef<string>('');

  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (targetCoords) {
      const key = `${targetCoords[0].toFixed(5)},${targetCoords[1].toFixed(5)}-${zoom}`;
      if (prevTargetRef.current !== key) {
        prevTargetRef.current = key;
        map.flyTo(targetCoords, zoom, { duration: 1.2 });
      }
    }
  }, [map, targetCoords, zoom]);

  return null;
};

// ============================================================================
// CUSTOM CRISP LEAFLET ICONS (Uncluttered, High Information Density)
// ============================================================================

// P2P Phone Cluster Icon showing exact device count
const createPhoneClusterIcon = (cluster: PhoneMeshCluster, isSelected: boolean) => {
  const isCourier = cluster.role === 'COURIER_MULES';
  const isCamp = cluster.role === 'CAMP_AGGREGATOR';
  const isMedics = cluster.role === 'MEDIC_FIELD';
  const isSearch = cluster.role === 'SEARCH_TEAM';

  const badgeColor = isCourier ? '#2563eb' : isCamp ? '#16a34a' : isMedics ? '#0284c7' : isSearch ? '#d97706' : '#64748b';

  return L.divIcon({
    className: 'custom-phone-cluster-pin',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 4px; background: #ffffff; border: 2px solid ${badgeColor}; border-radius: 20px; padding: 2px 7px; box-shadow: 0 4px 10px rgba(0,0,0,0.18); transition: transform 0.15s ease;">
          <span style="font-size: 13px;">📱</span>
          <span style="font-size: 11px; font-weight: 800; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            ${cluster.phoneCount} <span style="font-weight: 600; font-size: 10px; color: ${badgeColor};">Phones</span>
          </span>
          <span style="width: 7px; height: 7px; border-radius: 50%; background: #16a34a; display: inline-block;"></span>
        </div>
        <div style="width: 2px; height: 6px; background: ${badgeColor};"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: ${badgeColor};"></div>
      </div>
    `,
    iconSize: [80, 42],
    iconAnchor: [40, 42],
    popupAnchor: [0, -36]
  });
};

// Clean Flood Hazard Marker
const createCleanFloodIcon = (label: string) => {
  return L.divIcon({
    className: 'clean-flood-pin',
    html: `
      <div style="display: flex; items-center; gap: 4px; background: #0284c7; color: #ffffff; border: 2px solid #ffffff; border-radius: 6px; padding: 2px 6px; font-size: 10px; font-weight: 800; box-shadow: 0 3px 8px rgba(2, 132, 199, 0.4); cursor: pointer; white-space: nowrap;">
        <span>🌊</span> <span>${label}</span>
      </div>
    `,
    iconSize: [110, 26],
    iconAnchor: [55, 13],
    popupAnchor: [0, -14]
  });
};

// Clean Quake Hazard Marker
const createCleanQuakeIcon = (label: string) => {
  return L.divIcon({
    className: 'clean-quake-pin',
    html: `
      <div style="display: flex; items-center; gap: 4px; background: #ea580c; color: #ffffff; border: 2px solid #ffffff; border-radius: 6px; padding: 2px 6px; font-size: 10px; font-weight: 800; box-shadow: 0 3px 8px rgba(234, 88, 12, 0.4); cursor: pointer; white-space: nowrap;">
        <span>🏚️</span> <span>${label}</span>
      </div>
    `,
    iconSize: [110, 26],
    iconAnchor: [55, 13],
    popupAnchor: [0, -14]
  });
};

// People Icons
const createPersonIcon = (c: DisasterCase, isSelected: boolean) => {
  const isMissing = c.type === 'MISSING';
  const color = isMissing ? '#dc2626' : '#16a34a';
  const size = isSelected ? 38 : 30;
  const innerSize = isSelected ? 30 : 22;

  return L.divIcon({
    className: 'custom-person-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: ${size}px; height: ${size}px; cursor: pointer;">
        <div style="position: relative; width: ${innerSize}px; height: ${innerSize}px; border-radius: 50%; border: ${isSelected ? '3px' : '2px'} solid #ffffff; background: #0f172a; overflow: hidden; box-shadow: 0 3px 6px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center;">
          ${c.person.photoUrl ? `<img src="${c.person.photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'" />` : `<span style="font-size: 10px; font-weight: 800; color: #ffffff;">${c.person.name.charAt(0)}</span>`}
        </div>
        <div style="position: absolute; bottom: 0; right: 0; width: 9px; height: 9px; border-radius: 50%; background: ${color}; border: 1.5px solid #ffffff;"></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

const createFacilityIcon = (facility: FacilityLocation) => {
  const isHospital = facility.type === 'HOSPITAL';
  const bg = isHospital ? '#dc2626' : '#059669';
  const label = isHospital ? 'H' : '⛺';

  return L.divIcon({
    className: 'custom-facility-pin',
    html: `
      <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 7px; background: ${bg}; border: 2px solid #ffffff; box-shadow: 0 3px 6px rgba(0,0,0,0.25); color: #ffffff; font-weight: 900; font-size: 13px; cursor: pointer;">
        ${label}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

export const DisasterMap: React.FC<DisasterMapProps> = ({
  zones,
  facilities,
  meshNodes,
  cases,
  phoneClusters = [],
  selectedCaseId,
  onSelectCase
}) => {
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [privacyMode, setPrivacyMode] = useState<'RESPONDER' | 'PUBLIC'>('RESPONDER');

  // Default to 100% free OSM standard tiles (NO WATERMARK, NO API KEY)
  const [mapTileStyle, setMapTileStyle] = useState<'OSM' | 'SATELLITE' | 'TOPO'>('OSM');

  // Layer Toggles
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showFacilities, setShowFacilities] = useState<boolean>(true);
  const [showCases, setShowCases] = useState<boolean>(true);
  const [showPhoneMesh, setShowPhoneMesh] = useState<boolean>(true);
  const [showDisasters, setShowDisasters] = useState<boolean>(true);

  // Selected Phone Cluster Drawer state
  const [activeCluster, setActiveCluster] = useState<PhoneMeshCluster | null>(null);

  // Selected Incident Inspection Drawer State
  const [activeIncidentModal, setActiveIncidentModal] = useState<any | null>(null);

  // Focus coordinates
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>([28.6139, 77.2090]);
  const [zoomLevel, setZoomLevel] = useState<number>(14);

  // Total active phones calculation
  const totalPhonesCount = phoneClusters.reduce((acc, curr) => acc + curr.phoneCount, 0);

  // Centroid helper for privacy mode
  const getCentroid = (coords: [number, number][]): [number, number] => {
    if (!coords || coords.length === 0) return [28.6180, 77.2150];
    const sumLat = coords.reduce((acc, curr) => acc + curr[0], 0);
    const sumLng = coords.reduce((acc, curr) => acc + curr[1], 0);
    return [sumLat / coords.length, sumLng / coords.length];
  };

  const getZoneColor = (risk: string) => {
    switch (risk) {
      case 'CRITICAL': return '#0284c7'; // Flood Blue
      case 'HIGH': return '#2563eb';     // Metro Blue
      case 'MODERATE': return '#ea580c'; // Collapse Orange
      default: return '#64748b';
    }
  };

  // Filter entities
  const activeZones = zones.filter((z) => selectedZone === 'ALL' || z.id === selectedZone);
  const activeFacilities = facilities.filter((f) => selectedZone === 'ALL' || f.zone.includes(selectedZone.replace('ZONE-', 'Zone ')));
  const activeClusters = phoneClusters.filter((c) => selectedZone === 'ALL' || c.zone.includes(selectedZone.replace('ZONE-', 'Zone ')));

  const displayedCases = cases
    .filter((c) => selectedZone === 'ALL' || (c.lastKnownLocation?.zone && c.lastKnownLocation.zone.includes(selectedZone.replace('ZONE-', 'Zone '))))
    .map((c) => {
      if (c.person.isMinor && privacyMode === 'PUBLIC') {
        const matchingZone = zones.find((z) => (c.lastKnownLocation?.zone && (z.id === c.lastKnownLocation.zone || c.lastKnownLocation.zone.includes(z.name))));
        const [fuzzLat, fuzzLng] = matchingZone ? getCentroid(matchingZone.polygonCoords) : [28.6180, 77.2150];
        return {
          ...c,
          person: {
            ...c.person,
            photoUrl: undefined,
            name: `${c.person.name.charAt(0)}. (Minor Protected)`
          },
          lastKnownLocation: {
            ...c.lastKnownLocation,
            lat: fuzzLat,
            lng: fuzzLng,
            address: 'Location fuzzed to Zone centroid for child safety'
          }
        };
      }
      return c;
    });

  // P2P Bluetooth Mesh Multi-Hop Connection Polyline
  const p2pMeshConnectionRoutes: [number, number][] = [
    [28.6130, 77.2085], // Zone A Citizens Phone Cluster
    [28.6165, 77.2120], // Volunteer Courier Mules
    [28.6145, 77.2110], // Relief Camp #1 Station
    [28.6195, 77.2165], // Hospital Trauma Medics
    [28.6210, 77.2190]  // Starlink Gateway
  ];

  const handleZoneSelect = (zoneId: string) => {
    setSelectedZone(zoneId);
    if (zoneId === 'ALL') {
      setFlyTarget([28.6139, 77.2150]);
      setZoomLevel(13);
    } else if (zoneId === 'ZONE-A') {
      setFlyTarget([28.6135, 77.2090]);
      setZoomLevel(15);
    } else if (zoneId === 'ZONE-B') {
      setFlyTarget([28.6195, 77.2165]);
      setZoomLevel(15);
    } else if (zoneId === 'ZONE-C') {
      setFlyTarget([28.6075, 77.2270]);
      setZoomLevel(15);
    }
  };

  const locatePerson = (c: DisasterCase) => {
    if (c.lastKnownLocation) {
      setFlyTarget([c.lastKnownLocation.lat, c.lastKnownLocation.lng]);
      setZoomLevel(16);
      if (onSelectCase) onSelectCase(c.caseId);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Top Map Action Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Sector Selector */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Compass className="h-3.5 w-3.5 text-blue-600" /> Sector:
          </span>
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
            {[
              { id: 'ALL', label: 'All Sectors' },
              { id: 'ZONE-A', label: 'Zone A (Flood)' },
              { id: 'ZONE-B', label: 'Zone B (Hospital)' },
              { id: 'ZONE-C', label: 'Zone C (Quake)' }
            ].map((z) => (
              <button
                key={z.id}
                onClick={() => handleZoneSelect(z.id)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  selectedZone === z.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clean Layer Toggles */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
          {/* P2P Phones Layer Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 select-none bg-blue-50/70 border border-blue-200 rounded px-2 py-0.5">
            <input
              type="checkbox"
              checked={showPhoneMesh}
              onChange={(e) => setShowPhoneMesh(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-0"
            />
            <span className="font-bold text-[11px] text-blue-800 flex items-center gap-1">
              <span>📱</span> P2P Phones ({totalPhonesCount || 37})
            </span>
          </label>

          <label className="flex items-center gap-1 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={showDisasters}
              onChange={(e) => setShowDisasters(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-0"
            />
            <span className="font-medium text-[11px]">Disasters</span>
          </label>

          <label className="flex items-center gap-1 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={showCases}
              onChange={(e) => setShowCases(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-0"
            />
            <span className="font-medium text-[11px]">People ({displayedCases.length})</span>
          </label>

          <label className="flex items-center gap-1 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={showFacilities}
              onChange={(e) => setShowFacilities(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-0"
            />
            <span className="font-medium text-[11px]">Facilities</span>
          </label>
        </div>

        {/* Free Map Tile Selector (NO WATERMARKS) & Privacy Mode */}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
          <select
            value={mapTileStyle}
            onChange={(e) => setMapTileStyle(e.target.value as any)}
            className="bg-slate-100 border border-slate-300 text-slate-800 text-xs rounded px-2 py-1 font-bold focus:outline-none"
          >
            <option value="OSM">Clean Street Map (OpenStreetMap)</option>
            <option value="SATELLITE">Esri Satellite Aerial</option>
            <option value="TOPO">Esri World Topo</option>
          </select>

          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
            <button
              onClick={() => setPrivacyMode('RESPONDER')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                privacyMode === 'RESPONDER' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <Eye className="h-3 w-3" /> Responder
            </button>
            <button
              onClick={() => setPrivacyMode('PUBLIC')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                privacyMode === 'PUBLIC' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <EyeOff className="h-3 w-3" /> Public Safe
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Canvas */}
      <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-300 shadow-md bg-slate-100">
        <MapContainer
          center={[28.6139, 77.2090]}
          zoom={14}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <MapController targetCoords={flyTarget} zoom={zoomLevel} />

          {/* 100% Free, High-Quality Tile Layers with ZERO Watermark */}
          {mapTileStyle === 'OSM' && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}
          {mapTileStyle === 'SATELLITE' && (
            <TileLayer
              attribution='&copy; Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
            />
          )}
          {mapTileStyle === 'TOPO' && (
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
            />
          )}

          {/* Disaster Hazard Boundaries (Clean, Uncluttered, NO permanent overlapping tooltips) */}
          {showZones &&
            activeZones.map((zone) => (
              <Polygon
                key={zone.id}
                positions={zone.polygonCoords}
                pathOptions={{
                  color: getZoneColor(zone.riskLevel),
                  fillColor: getZoneColor(zone.riskLevel),
                  fillOpacity: 0.10,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              >
                {/* Non-permanent tooltip: Only appears when user hovers over zone */}
                <Tooltip direction="top">
                  <div className="text-xs font-bold font-sans">
                    <span style={{ color: getZoneColor(zone.riskLevel) }}>{zone.name}</span>
                    <div className="text-[10px] text-slate-300 font-normal">
                      Missing: <strong>{zone.missingCount}</strong> • Found: <strong>{zone.foundCount}</strong>
                    </div>
                  </div>
                </Tooltip>
              </Polygon>
            ))}

          {/* Clean Disaster Hazard Markers (No clutter) */}
          {showDisasters && (
            <>
              {/* Flood Breach Point */}
              <Marker
                position={[28.6148, 77.2065]}
                icon={createCleanFloodIcon('Flood Breach +2.4m')}
                eventHandlers={{
                  click: () => {
                    setActiveIncidentModal({
                      title: 'Zone A River Embankment Breach Point',
                      type: 'FLASH_FLOOD',
                      severity: 'CRITICAL',
                      waterLevel: '+2.4m Above Danger Mark',
                      flowRate: '14,800 cusecs (Surging)',
                      damage: '65-meter river wall fracture; floodwaters overflowing into Sector 4 residential corridor.',
                      photoUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80',
                      responders: '3 Amphibious NDRF boats active; 18 civilians evacuated.',
                      status: 'EVACUATION ACTIVE'
                    });
                  }
                }}
              />

              {/* Quake Collapse Point */}
              <Marker
                position={[28.6080, 77.2250]}
                icon={createCleanQuakeIcon('Sector 9 Rubble (85%)')}
                eventHandlers={{
                  click: () => {
                    setActiveIncidentModal({
                      title: 'Sector 9 Industrial Block B — Factory Collapse',
                      type: 'STRUCTURAL_COLLAPSE',
                      severity: 'CATASTROPHIC',
                      waterLevel: 'Ground Subsidence',
                      flowRate: 'M5.4 Sub-surface Tremor',
                      damage: 'Heavy concrete slab failure. 3 trapped survivors located by acoustic sensors in cavity #3.',
                      photoUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&auto=format&fit=crop&q=80',
                      responders: 'Search & rescue dog team deployed with hydraulic cutters.',
                      status: 'ACOUSTIC MICROPHONES ACTIVE'
                    });
                  }
                }}
              />
            </>
          )}

          {/* ================================================================ */}
          {/* P2P SMARTPHONE MESH NETWORK (Shows how many phones are where)     */}
          {/* ================================================================ */}
          {showPhoneMesh && (
            <>
              {/* Animated P2P BLE Packet Relay Links */}
              <Polyline
                positions={p2pMeshConnectionRoutes}
                pathOptions={{
                  color: '#2563eb',
                  weight: 3,
                  dashArray: '6, 8',
                  opacity: 0.85
                }}
              >
                <Tooltip direction="top">
                  <span className="font-mono text-[11px] font-bold text-blue-800 bg-white p-1 rounded shadow-xs">
                    P2P Bluetooth Low Energy Store-and-Forward Mesh Backbone (37 Phones Connected)
                  </span>
                </Tooltip>
              </Polyline>

              {/* Phone Cluster Markers with Exact Phone Count Badges */}
              {activeClusters.map((cluster) => (
                <Marker
                  key={cluster.clusterId}
                  position={[cluster.lat, cluster.lng]}
                  icon={createPhoneClusterIcon(cluster, activeCluster?.clusterId === cluster.clusterId)}
                  eventHandlers={{
                    click: () => {
                      setActiveCluster(cluster);
                    }
                  }}
                >
                  <Tooltip direction="top">
                    <div className="text-xs font-sans">
                      <strong className="text-blue-400">{cluster.name}</strong>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        📱 <strong>{cluster.phoneCount} Active Phones</strong> • {cluster.totalPackets} pkts in queue
                      </div>
                    </div>
                  </Tooltip>
                </Marker>
              ))}
            </>
          )}

          {/* Render Facilities (Hospitals & Relief Camps) */}
          {showFacilities &&
            activeFacilities.map((f) => (
              <Marker
                key={f.id}
                position={[f.lat, f.lng]}
                icon={createFacilityIcon(f)}
              >
                <Popup>
                  <div className="p-1 min-w-[210px] text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-200 pb-1.5 mb-1.5">
                      <span className={f.type === 'HOSPITAL' ? 'text-red-600' : 'text-emerald-600'}>
                        {f.type === 'HOSPITAL' ? '🏥' : '⛺'}
                      </span>
                      <span>{f.name}</span>
                    </div>
                    <div className="space-y-1 text-slate-600 text-[11px]">
                      <div className="flex justify-between">
                        <span>Beds:</span>
                        <strong className="font-mono text-slate-900">{f.currentOccupancy} / {f.capacity}</strong>
                      </div>
                      <div className="flex justify-between text-amber-700 font-medium">
                        <span>Unidentified Intake:</span>
                        <strong className="font-mono">{f.unidentifiedCount} patients</strong>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Render People / Casualties with Photos & Badges */}
          {showCases &&
            displayedCases.map((c) => {
              if (!c.lastKnownLocation) return null;
              const isSelected = selectedCaseId === c.caseId;

              return (
                <Marker
                  key={c.caseId}
                  position={[c.lastKnownLocation.lat, c.lastKnownLocation.lng]}
                  icon={createPersonIcon(c, isSelected)}
                  eventHandlers={{
                    click: () => {
                      if (onSelectCase) onSelectCase(c.caseId);
                    }
                  }}
                >
                  <Popup>
                    <div className="p-1 min-w-[220px]">
                      <div className="flex gap-2">
                        <div className="w-10 h-12 rounded bg-slate-200 flex-shrink-0 overflow-hidden border border-slate-300">
                          {c.person.photoUrl ? (
                            <img src={c.person.photoUrl} alt={c.person.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">
                              {c.person.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-slate-500 font-bold">{c.caseId}</span>
                            <span className={`text-[9px] font-black px-1 rounded ${c.type === 'MISSING' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {c.type}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 truncate mt-0.5">{c.person.name}</h4>
                          <p className="text-[10px] text-slate-500">
                            Age: {c.person.age || c.person.approximateAge || 'N/A'} • {c.person.gender}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-200 text-[11px] text-slate-700">
                        <p className="truncate"><strong>Location:</strong> {c.lastKnownLocation.address || c.lastKnownLocation.zone}</p>
                      </div>

                      <button
                        onClick={() => locatePerson(c)}
                        className="mt-2 w-full py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded transition-colors"
                      >
                        Inspect Dossier
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </MapContainer>

        {/* Floating Map HUD Legend */}
        <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs border border-slate-300 rounded-lg p-2.5 shadow-lg text-xs space-y-1.5 max-w-[200px] pointer-events-auto">
          <div className="font-extrabold text-[11px] text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center justify-between">
            <span>Tactical Legend</span>
            <span className="text-[9px] bg-blue-100 text-blue-800 px-1 rounded font-bold">OSM LIVE</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-[11px]">
            <span className="text-xs">📱</span>
            <span>P2P Phone Mesh Nodes</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-[11px]">
            <span className="text-xs">🌊</span>
            <span>Flood Breach Point</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-[11px]">
            <span className="text-xs">🏚️</span>
            <span>Quake Rubble Collapse</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white"></span>
            <span>Missing Casualty Pin</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-white"></span>
            <span>Hospital Intake Pin</span>
          </div>
        </div>

        {/* P2P Phone Mesh Inspector Drawer (Shows phone devices, battery, and packets) */}
        {activeCluster && (
          <div className="absolute top-3 right-3 z-[500] bg-white border border-slate-300 rounded-xl shadow-2xl p-4 text-xs text-slate-800 space-y-3 w-80 animate-in fade-in duration-200">
            <div className="flex items-start justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">📱</span>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 leading-tight">{activeCluster.name}</h4>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                    {activeCluster.phoneCount} SMARTPHONES IN MESH
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveCluster(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200 text-center font-mono text-[10px]">
              <div>
                <span className="text-slate-500 block">Avg Battery</span>
                <strong className="text-emerald-700 text-xs">{activeCluster.avgBattery}%</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Hop Distance</span>
                <strong className="text-blue-700 text-xs">{activeCluster.hopDistanceToGateway} Hops</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Queue</span>
                <strong className="text-amber-700 text-xs">{activeCluster.totalPackets} pkts</strong>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider block mb-1.5">
                Active Participating Smartphones:
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {activeCluster.devices.map((device) => (
                  <div key={device.id} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                    <div>
                      <div className="font-bold text-slate-900">{device.model}</div>
                      <div className="text-[10px] text-slate-500">
                        {device.ownerType} • Ping: {device.lastHopTime}
                      </div>
                    </div>
                    <div className="text-right font-mono text-[10px]">
                      <div className="text-emerald-700 font-bold">{device.battery}% Bat</div>
                      <div className="text-slate-500">{device.signalRssi} dBm</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveCluster(null)}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition-colors"
            >
              Close Mesh Inspector
            </button>
          </div>
        )}

        {/* Disaster Photo Detail Drawer */}
        {activeIncidentModal && (
          <div className="absolute top-3 left-3 right-3 sm:right-auto sm:w-96 z-[500] bg-white border border-slate-300 rounded-xl shadow-2xl p-4 text-xs text-slate-800 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-start justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {activeIncidentModal.type === 'FLASH_FLOOD' ? '🌊' : '🏚️'}
                </span>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 leading-tight">{activeIncidentModal.title}</h4>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-red-100 text-red-800">
                    SEVERITY: {activeIncidentModal.severity}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveIncidentModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            {activeIncidentModal.photoUrl && (
              <div className="w-full h-36 rounded-lg overflow-hidden border border-slate-200 relative bg-slate-900">
                <img
                  src={activeIncidentModal.photoUrl}
                  alt={activeIncidentModal.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] text-white font-mono flex justify-between">
                  <span>Sensor Photographic Feed</span>
                  <span className="text-amber-300 font-bold">{activeIncidentModal.status}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-[11px] text-slate-700">
              <p>
                <strong className="text-slate-900">Impact:</strong> {activeIncidentModal.damage}
              </p>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[10px]">
                <div>
                  <span className="text-slate-500 block">Telemetry / Water:</span>
                  <strong className="text-blue-700">{activeIncidentModal.waterLevel}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Flow / Sensor:</span>
                  <strong className="text-amber-700">{activeIncidentModal.flowRate}</strong>
                </div>
              </div>
              <p className="text-[10px] text-emerald-800 font-medium bg-emerald-50 p-1.5 rounded border border-emerald-200">
                🚑 <strong>Response:</strong> {activeIncidentModal.responders}
              </p>
            </div>

            <button
              onClick={() => setActiveIncidentModal(null)}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded transition-colors"
            >
              Dismiss Incident Dossier
            </button>
          </div>
        )}
      </div>

      {/* People Quick Locate Carousel Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={14} className="text-blue-600" />
            Reported Casualties & Field Sightings ({cases.length})
          </span>
          <span className="text-[11px] text-slate-500">Click photo to center map coordinate</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {cases.map((c) => {
            const isMissing = c.type === 'MISSING';
            const isSelected = selectedCaseId === c.caseId;

            return (
              <div
                key={c.caseId}
                onClick={() => locatePerson(c)}
                className={`flex-shrink-0 flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-all w-56 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-200 flex-shrink-0 border border-slate-300 relative">
                  {c.person.photoUrl ? (
                    <img src={c.person.photoUrl} alt={c.person.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">
                      {c.person.name.charAt(0)}
                    </div>
                  )}
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${isMissing ? 'bg-red-500' : 'bg-emerald-500'}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-slate-500 font-bold">{c.caseId}</span>
                    <span className={`font-bold ${isMissing ? 'text-red-700' : 'text-emerald-700'}`}>
                      {c.type === 'MISSING' ? 'MISSING' : 'INTAKE'}
                    </span>
                  </div>
                  <h5 className="font-bold text-xs text-slate-900 truncate">{c.person.name}</h5>
                  <p className="text-[10px] text-slate-500 truncate">
                    {c.lastKnownLocation?.zone ? c.lastKnownLocation.zone.split('—')[0] : 'Zone'} • Age: {c.person.age || c.person.approximateAge || 'N/A'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
