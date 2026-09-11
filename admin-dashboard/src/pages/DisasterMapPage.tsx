import React from 'react';
import { DisasterZone, FacilityLocation, MeshNodeStatus, DisasterCase } from '../types';
import { DisasterMap } from '../components/map/DisasterMap';

interface DisasterMapPageProps {
  zones: DisasterZone[];
  facilities: FacilityLocation[];
  meshNodes: MeshNodeStatus[];
  cases: DisasterCase[];
}

export const DisasterMapPage: React.FC<DisasterMapPageProps> = ({
  zones,
  facilities,
  meshNodes,
  cases
}) => {
  return (
    <div className="space-y-6">
      <DisasterMap
        zones={zones}
        facilities={facilities}
        meshNodes={meshNodes}
        cases={cases}
      />
    </div>
  );
};
