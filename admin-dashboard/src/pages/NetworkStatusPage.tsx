import React from 'react';
import { MeshNodeStatus } from '../types';
import { MeshTopologyVisualizer } from '../components/network/MeshTopologyVisualizer';

interface NetworkStatusPageProps {
  nodes: MeshNodeStatus[];
}

export const NetworkStatusPage: React.FC<NetworkStatusPageProps> = ({ nodes }) => {
  return (
    <div className="space-y-6">
      <MeshTopologyVisualizer nodes={nodes} />
    </div>
  );
};
