import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { NetworkHealthStatus } from '../../../shared/types/index';
import { NetworkStatusPill } from '../components/NetworkStatusPill';
import { Screen } from '../components/Screen';
import type { MobileMeshActivity } from '../services/createMobileServices';
import { colors } from '../theme';

interface NetworkStatusScreenProps {
  health: NetworkHealthStatus;
  activity: MobileMeshActivity;
  onBack: () => void;
  onDemoGatewaySync: () => Promise<{ acknowledgedMessageIds: string[] }>;
  onBackendSync: () => Promise<{ acknowledgedMessageIds: string[] }>;
  onRetryNativeBle: () => Promise<void>;
  onSendBleTestEnvelope: () => Promise<string>;
  showDemoGateway: boolean;
  showBackendSync: boolean;
  backendBaseUrl: string;
  showBleDiagnostics: boolean;
}

export function NetworkStatusScreen({
  health,
  activity,
  onBack,
  onDemoGatewaySync,
  onBackendSync,
  onRetryNativeBle,
  onSendBleTestEnvelope,
  showDemoGateway,
  showBackendSync,
  backendBaseUrl,
  showBleDiagnostics,
}: NetworkStatusScreenProps) {
  const [syncing, setSyncing] = useState(false);
  const nativeBle = activity.transportMode === 'NATIVE_BLE';

  async function runDemoGatewaySync(): Promise<void> {
    setSyncing(true);
    try {
      const response = await onDemoGatewaySync();
      Alert.alert(
        'Mock gateway acknowledged',
        `${response.acknowledgedMessageIds.length} queued message${response.acknowledgedMessageIds.length === 1 ? '' : 's'} acknowledged. This is the development gateway boundary, not a production backend.`,
      );
    } catch (error) {
      Alert.alert(
        'Gateway sync failed',
        error instanceof Error ? error.message : 'Unacknowledged messages remain queued.',
      );
    } finally {
      setSyncing(false);
    }
  }

  async function runBackendSync(): Promise<void> {
    setSyncing(true);
    try {
      const response = await onBackendSync();
      Alert.alert(
        'Backend sync complete',
        `${response.acknowledgedMessageIds.length} message${response.acknowledgedMessageIds.length === 1 ? '' : 's'} acknowledged by the real local backend.`,
      );
    } catch (error) {
      Alert.alert(
        'Backend unavailable',
        error instanceof Error ? error.message : 'Unacknowledged messages remain queued locally.',
      );
    } finally {
      setSyncing(false);
    }
  }

  async function retryBluetooth(): Promise<void> {
    setSyncing(true);
    try {
      await onRetryNativeBle();
    } catch (error) {
      Alert.alert('Bluetooth unavailable', error instanceof Error ? error.message : 'Could not restart Bluetooth mesh.');
    } finally {
      setSyncing(false);
    }
  }

  async function sendTestEnvelope(): Promise<void> {
    setSyncing(true);
    try {
      const messageId = await onSendBleTestEnvelope();
      Alert.alert('BLE test queued', `${messageId.slice(0, 12)} is queued locally. Peer receipt is not a gateway ACK.`);
    } catch (error) {
      Alert.alert('BLE test failed', error instanceof Error ? error.message : 'Test envelope remains unsent.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Screen title="Network status" subtitle="Delivery states are shown separately and never inferred from a local save." onBack={onBack}>
      <NetworkStatusPill health={health} />
      <View style={styles.card}>
        <Text style={styles.title}>{nativeBle ? 'Native Bluetooth Mesh' : 'Development Mesh'}</Text>
        <Text style={styles.topology}>
          {nativeBle
            ? 'This phone ↔ nearby physical ResQNet phones'
            : activity.transportMode === 'DEV_EMULATOR_MESH'
            ? 'This app ↔ Mac broker ↔ separate emulator'
            : 'This app → MOCK-B → MOCK-C → gateway boundary'}
        </Text>
        <Text style={styles.body}>
          {nativeBle
            ? 'Foreground BLE scans only for the ResQNet service. Peer receipt means nearby relay only; gateway delivery remains pending.'
            : activity.transportMode === 'DEV_EMULATOR_MESH'
            ? 'Serialized MeshEnvelope traffic leaves this app process over WebSocket. This is a development transport, not BLE or a backend.'
            : 'A and C have no direct link. This is the in-process simulator; native BLE is not connected.'}
        </Text>
        <View style={styles.metrics}>
          <Text style={styles.metric}>Node ID: {activity.nodeId}</Text>
          <Text style={styles.metric}>Transport: {activity.transportMode.replaceAll('_', ' ')}</Text>
          {nativeBle ? (
            <>
              <Text style={styles.metric}>Bluetooth: {activity.bluetoothEnabled ? 'ENABLED' : 'OFF / UNAVAILABLE'}</Text>
              <Text style={styles.metric}>Radio: {activity.radioReady ? 'ADVERTISING + SCANNING' : 'NOT READY'}</Text>
              <Text style={styles.metric}>Permission: {(activity.radioPermissionState ?? 'UNKNOWN').replaceAll('_', ' ')}</Text>
              <Text style={styles.metric}>Nearby ResQNet peers: {activity.discoveredPeerIds?.length ?? 0}</Text>
            </>
          ) : (
            <Text style={styles.metric}>Broker: {activity.brokerConnected ? 'CONNECTED' : 'DISCONNECTED'}</Text>
          )}
          <Text style={styles.metric}>Connected peers: {activity.connectedPeerIds.length}</Text>
          {activity.connectedPeerIds.length > 0 ? (
            <Text style={styles.peerIds}>{activity.connectedPeerIds.join(', ')}</Text>
          ) : null}
          <Text style={styles.metric}>Queued for gateway: {activity.queuedCount}</Text>
          <Text style={styles.metric}>Received mesh messages: {activity.receivedCount}</Text>
          <Text style={styles.metric}>Relayed sends: {activity.relayedCount}</Text>
          <Text style={styles.metric}>Peer receipts: {activity.peerReceiptCount}</Text>
          <Text style={styles.metric}>Gateway state: {activity.gatewayState.replaceAll('_', ' ')}</Text>
          {showBackendSync ? <Text style={styles.metric}>Backend: {backendBaseUrl}</Text> : null}
          <Text style={styles.metric}>Battery mode: {health.batteryMode.replaceAll('_', ' ')}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Mesh activity</Text>
        <Text style={styles.body}>{activity.lastActivity ?? 'No activity yet.'}</Text>
        {activity.lastReceived ? (
          <View style={styles.lastReceived}>
            <Text style={styles.receivedType}>{activity.lastReceived.messageType.replaceAll('_', ' ')}</Text>
            <Text style={styles.receivedName}>Last received report: {activity.lastReceived.summary}</Text>
            <Text style={styles.receivedMeta}>
              {activity.lastReceived.messageId.slice(0, 12)} from {activity.lastReceived.fromNodeId ?? 'development peer'}
            </Text>
          </View>
        ) : (
          <Text style={styles.body}>No peer envelope has been accepted on this installation.</Text>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Honest delivery states</Text>
        <Text style={styles.item}>1. Saved locally — durable on this device</Text>
        <Text style={styles.item}>2. Relaying — sent to a nearby {nativeBle ? 'Bluetooth peer' : 'simulated node'}</Text>
        <Text style={styles.item}>3. Delivered — shown only after gateway/server ACK</Text>
      </View>
      {health.lastSuccessfulSyncTimestamp ? (
        <Text style={styles.sync}>Last acknowledged sync: {new Date(health.lastSuccessfulSyncTimestamp).toLocaleString()}</Text>
      ) : (
        <Text style={styles.pending}>No gateway/server acknowledgement received yet.</Text>
      )}
      {showDemoGateway ? (
        <>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={syncing}
            onPress={() => void runDemoGatewaySync()}
            style={[styles.syncButton, syncing ? styles.syncButtonDisabled : null]}
          >
            <Text style={styles.syncButtonText}>{syncing ? 'SYNCING…' : 'RUN MOCK GATEWAY ACK'}</Text>
          </TouchableOpacity>
          <Text style={styles.demoNote}>Demo-only: proves ACK handling without claiming the production backend is connected.</Text>
        </>
      ) : (
        <Text style={styles.demoNote}>Peer receipt does not remove an item from the gateway queue.</Text>
      )}
      {showBackendSync ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={syncing}
          onPress={() => void runBackendSync()}
          style={[styles.syncButton, syncing ? styles.syncButtonDisabled : null]}
        >
          <Text style={styles.syncButtonText}>{syncing ? 'SYNCING…' : 'SYNC WITH REAL BACKEND'}</Text>
        </TouchableOpacity>
      ) : null}
      {nativeBle ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={syncing}
          onPress={() => void retryBluetooth()}
          style={[styles.syncButton, syncing ? styles.syncButtonDisabled : null]}
        >
          <Text style={styles.syncButtonText}>{syncing ? 'CHECKING…' : 'RETRY BLUETOOTH'}</Text>
        </TouchableOpacity>
      ) : null}
      {nativeBle && showBleDiagnostics ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={syncing}
          onPress={() => void sendTestEnvelope()}
          style={[styles.diagnosticButton, syncing ? styles.syncButtonDisabled : null]}
        >
          <Text style={styles.diagnosticButtonText}>SEND TEST ENVELOPE</Text>
        </TouchableOpacity>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  topology: {
    color: colors.info,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
  },
  body: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: 8,
  },
  metrics: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 8,
  },
  metric: {
    color: colors.text,
    fontWeight: '700',
    marginTop: 6,
  },
  peerIds: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  lastReceived: {
    backgroundColor: colors.background,
    borderRadius: 10,
    marginTop: 12,
    padding: 12,
  },
  receivedType: {
    color: colors.info,
    fontSize: 12,
    fontWeight: '900',
  },
  receivedName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  receivedMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  item: {
    color: colors.text,
    lineHeight: 22,
    marginTop: 7,
  },
  pending: {
    color: colors.warning,
    fontWeight: '800',
    marginTop: 16,
  },
  sync: {
    color: colors.safe,
    fontWeight: '800',
    marginTop: 16,
  },
  syncButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.info,
    marginTop: 18,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  demoNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },
  diagnosticButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.info,
    marginTop: 10,
  },
  diagnosticButtonText: {
    color: colors.info,
    fontWeight: '900',
  },
});
