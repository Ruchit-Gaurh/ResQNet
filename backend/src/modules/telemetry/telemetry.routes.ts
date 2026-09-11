import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';

export const telemetryRouter = Router();

// Authority-managed zones and facilities are not connected yet. An empty live
// dataset is safer than presenting synthetic locations as operational facts.
telemetryRouter.get('/zones', requireAuth, requireRole('RESPONDER_ADMIN'), (_req: Request, res: Response) => {
  res.json({ success: true, zones: [] });
});

telemetryRouter.get('/facilities', requireAuth, requireRole('RESPONDER_ADMIN'), (_req: Request, res: Response) => {
  res.json({ success: true, facilities: [] });
});

// DIRECT means the originating phone contacted this backend itself. RELAYED
// means another internet-capable phone carried the observation; that phone is
// intentionally displayed as offline/last-seen, never as directly connected.
telemetryRouter.get(
  '/mesh-nodes',
  requireAuth,
  requireRole('RESPONDER_ADMIN'),
  async (_req: Request, res: Response) => {
    const now = Date.now();
    const presence = await prisma.devicePresence.findMany({
      orderBy: { presenceObservedAt: 'desc' },
      take: 1_000,
    });

    const nodes = presence.map((item) => {
      const lastSeenMs = Math.max(0, now - item.presenceObservedAt.getTime());
      const connectionState = item.connectivitySource === 'DIRECT' && lastSeenMs <= 20_000
        ? 'ONLINE_DIRECT'
        : item.connectivitySource === 'RELAYED' && lastSeenMs <= 30 * 60_000
          ? 'OFFLINE_RELAYED'
          : 'STALE';
      const peers = Array.isArray(item.nearbyPeerIds)
        ? item.nearbyPeerIds.filter((peer): peer is string => typeof peer === 'string')
        : [];

      return {
        nodeId: item.nodeId,
        name: item.displayName,
        role: 'PHONE_RELAY',
        transportMode: item.transportMode,
        connectionState,
        connectivitySource: item.connectivitySource,
        lat: item.latitude,
        lng: item.longitude,
        accuracyMeters: item.accuracyMeters,
        zone: item.zone,
        connectedPeersCount: peers.length,
        nearbyPeerIds: peers,
        messagesInQueue: item.queuedMessageCount,
        lastSeenMs,
        lastSeenAt: item.presenceObservedAt.toISOString(),
        locationObservedAt: item.locationObservedAt?.toISOString(),
        lastGatewayContactAt: item.lastGatewayContactAt.toISOString(),
        relayedByNodeId: item.relayedByNodeId,
        isOnlineGateway: connectionState === 'ONLINE_DIRECT',
      };
    });

    res.json({ success: true, nodes, serverTimestamp: now });
  },
);

telemetryRouter.get('/phone-clusters', requireAuth, requireRole('RESPONDER_ADMIN'), (_req: Request, res: Response) => {
  res.json({ success: true, clusters: [] });
});
