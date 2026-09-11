import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { MeshMessageType, NetworkHealthStatus } from '../../../shared/types/index';
import { Disclosure } from '../components/Disclosure';
import { NetworkStatusPill } from '../components/NetworkStatusPill';
import { Screen } from '../components/Screen';
import type { MobileMeshActivity } from '../services/createMobileServices';
import { colors, radii, spacing, typography } from '../theme';

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

const MESSAGE_LABELS: Partial<Record<MeshMessageType, string>> = {
  MISSING_PERSON: 'missing person report',
  FOUND_PERSON: 'found person report',
  SAFE_STATUS: 'safe check-in',
  SIGHTING: 'sighting report',
};

function displayNodeId(nodeId: string): string {
  return nodeId.length <= 24 ? nodeId : `${nodeId.slice(0, 14)}…${nodeId.slice(-6)}`;
}

function DeviceRow({ nodeId, state }: { nodeId: string; state: 'Connected' | 'Nearby' }) {
  const connected = state === 'Connected';
  return (
    <View
      accessibilityLabel={`${nodeId}. ${state} ResQNet device.`}
      accessible
      style={styles.deviceRow}
    >
      <View style={[styles.deviceDot, { backgroundColor: connected ? colors.safe : colors.warning }]} />
      <Text selectable style={styles.deviceId}>{displayNodeId(nodeId)}</Text>
      <Text style={[styles.deviceState, { color: connected ? colors.safe : colors.warning }]}>{state}</Text>
    </View>
  );
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const nativeBle = activity.transportMode === 'NATIVE_BLE';
  const connectedDevices = useMemo(
    () => [...activity.connectedPeerIds].sort((left, right) => left.localeCompare(right)),
    [activity.connectedPeerIds],
  );
  const nearbyDevices = useMemo(() => {
    const connected = new Set(activity.connectedPeerIds);
    return [...(activity.discoveredPeerIds ?? [])]
      .filter((nodeId) => !connected.has(nodeId))
      .sort((left, right) => left.localeCompare(right));
  }, [activity.connectedPeerIds, activity.discoveredPeerIds]);

  async function runDemoGatewaySync(): Promise<void> {
    setSyncing(true);
    try {
      const response = await onDemoGatewaySync();
      Alert.alert(
        'Demo sync complete',
        response.acknowledgedMessageIds.length === 0
          ? 'There were no new reports waiting to send.'
          : `${response.acknowledgedMessageIds.length} report${response.acknowledgedMessageIds.length === 1 ? '' : 's'} reached the demo network.`,
      );
    } catch (error) {
      Alert.alert('Could not sync', error instanceof Error ? error.message : 'Reports remain saved on this phone.');
    } finally {
      setSyncing(false);
    }
  }

  async function runBackendSync(): Promise<void> {
    setSyncing(true);
    try {
      const response = await onBackendSync();
      Alert.alert(
        'Status checked',
        response.acknowledgedMessageIds.length === 0
          ? 'No new reports were waiting to send. Case updates are current.'
          : `${response.acknowledgedMessageIds.length} report${response.acknowledgedMessageIds.length === 1 ? '' : 's'} reached the disaster network.`,
      );
    } catch {
      Alert.alert('Network unavailable', 'Reports remain saved on this phone and will retry automatically.');
    } finally {
      setSyncing(false);
    }
  }

  async function retryBluetooth(): Promise<void> {
    setSyncing(true);
    try {
      await onRetryNativeBle();
    } catch (error) {
      Alert.alert('Bluetooth unavailable', error instanceof Error ? error.message : 'Could not restart Bluetooth sharing.');
    } finally {
      setSyncing(false);
    }
  }

  async function sendTestEnvelope(): Promise<void> {
    setSyncing(true);
    try {
      const messageId = await onSendBleTestEnvelope();
      Alert.alert('Test report queued', `${messageId.slice(0, 12)} is saved locally. A nearby receipt is not final delivery.`);
    } catch (error) {
      Alert.alert('Test failed', error instanceof Error ? error.message : 'The test report was not sent.');
    } finally {
      setSyncing(false);
    }
  }

  const gatewayCopy = activity.gatewayState === 'ACKNOWLEDGED'
    ? 'Disaster network confirmed'
    : activity.gatewayState === 'FAILED'
      ? 'Disaster network unavailable'
      : 'Waiting for disaster network';

  return (
    <Screen title="Network status" subtitle="Reports save on this phone first, even when every connection is unavailable." onBack={onBack}>
      <NetworkStatusPill health={health} />

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Connected devices</Text>
        <Text style={styles.sectionDescription}>
          Nearby ResQNet devices can carry reports onward. Their receipt does not mean authorities have received a report.
        </Text>
        {connectedDevices.length > 0 ? (
          <View style={styles.deviceList}>
            {connectedDevices.map((nodeId) => <DeviceRow key={nodeId} nodeId={nodeId} state="Connected" />)}
          </View>
        ) : (
          <View style={styles.emptyDevices}>
            <Text style={styles.emptyTitle}>No devices connected right now</Text>
            <Text style={styles.emptyBody}>
              {activity.brokerConnected
                ? 'The development relay is ready and waiting for another device.'
                : nativeBle && activity.radioReady
                  ? 'Bluetooth sharing is ready. Keep ResQNet open while looking for nearby phones.'
                  : 'Your reports remain saved and will retry automatically.'}
            </Text>
          </View>
        )}

        {nativeBle && nearbyDevices.length > 0 ? (
          <View style={styles.nearbyGroup}>
            <Text style={styles.nearbyTitle}>Seen nearby, not connected</Text>
            {nearbyDevices.map((nodeId) => <DeviceRow key={nodeId} nodeId={nodeId} state="Nearby" />)}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Reports and relay</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Waiting to reach the network</Text>
          <Text accessibilityLiveRegion="polite" style={styles.statValue}>{activity.queuedCount}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Received from nearby devices</Text>
          <Text accessibilityLiveRegion="polite" style={styles.statValue}>{activity.receivedCount}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Shared with nearby devices</Text>
          <Text accessibilityLiveRegion="polite" style={styles.statValue}>{activity.relayedCount}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Central network</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.statValue, styles.gatewayValue]}>{gatewayCopy}</Text>
        </View>
        {showBackendSync ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ busy: syncing, disabled: syncing }}
            disabled={syncing}
            onPress={() => void runBackendSync()}
            style={[styles.primaryButton, syncing ? styles.disabled : null]}
          >
            <Text style={styles.primaryButtonText}>{syncing ? 'Checking…' : 'Check for updates'}</Text>
          </TouchableOpacity>
        ) : null}
        {nativeBle && !activity.radioReady ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ busy: syncing, disabled: syncing }}
            disabled={syncing}
            onPress={() => void retryBluetooth()}
            style={[styles.secondaryButton, syncing ? styles.disabled : null]}
          >
            <Text style={styles.secondaryButtonText}>{syncing ? 'Checking…' : 'Try Bluetooth again'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Latest activity</Text>
        {activity.lastReceived ? (
          <View style={styles.activityPanel}>
            <Text style={styles.activityEyebrow}>Received from {activity.lastReceived.fromNodeId ?? 'a nearby device'}</Text>
            <Text style={styles.activityTitle}>{activity.lastReceived.summary}</Text>
            <Text style={styles.activityBody}>
              {MESSAGE_LABELS[activity.lastReceived.messageType] ?? 'network message'} received and saved once on this phone.
            </Text>
          </View>
        ) : (
          <Text style={styles.sectionDescription}>No report has been received from another device on this installation.</Text>
        )}
        <Text style={health.lastSuccessfulSyncTimestamp ? styles.syncSuccess : styles.syncPending}>
          {health.lastSuccessfulSyncTimestamp
            ? `Last central network contact: ${new Date(health.lastSuccessfulSyncTimestamp).toLocaleString()}`
            : 'No central network confirmation yet.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>How delivery works</Text>
        <View style={styles.deliveryStep}>
          <Text style={styles.stepNumber}>1</Text>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>Saved on this phone</Text>
            <Text style={styles.stepBody}>The report is protected from a sudden connection loss.</Text>
          </View>
        </View>
        <View style={styles.deliveryStep}>
          <Text style={styles.stepNumber}>2</Text>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>Sharing with nearby devices</Text>
            <Text style={styles.stepBody}>Other ResQNet phones may carry it closer to a connection.</Text>
          </View>
        </View>
        <View style={styles.deliveryStep}>
          <Text style={styles.stepNumber}>3</Text>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>Reached the disaster network</Text>
            <Text style={styles.stepBody}>Shown only after the central coordination service confirms receipt.</Text>
          </View>
        </View>
      </View>

      <Disclosure
        expanded={advancedOpen}
        label="Advanced diagnostics"
        onPress={() => setAdvancedOpen((value) => !value)}
      >
        <View style={styles.diagnosticRows}>
          <Text selectable style={styles.diagnostic}>Node ID: {activity.nodeId}</Text>
          <Text style={styles.diagnostic}>Transport: {activity.transportMode.replaceAll('_', ' ')}</Text>
          {nativeBle ? (
            <>
              <Text style={styles.diagnostic}>Bluetooth: {activity.bluetoothEnabled ? 'ENABLED' : 'OFF OR UNAVAILABLE'}</Text>
              <Text style={styles.diagnostic}>Radio: {activity.radioReady ? 'ADVERTISING AND SCANNING' : 'NOT READY'}</Text>
              <Text style={styles.diagnostic}>Permission: {(activity.radioPermissionState ?? 'UNKNOWN').replaceAll('_', ' ')}</Text>
            </>
          ) : (
            <Text style={styles.diagnostic}>Development broker: {activity.brokerConnected ? 'CONNECTED' : 'DISCONNECTED'}</Text>
          )}
          <Text style={styles.diagnostic}>Peer receipts: {activity.peerReceiptCount}</Text>
          <Text style={styles.diagnostic}>Gateway state: {activity.gatewayState.replaceAll('_', ' ')}</Text>
          {showBackendSync ? <Text selectable style={styles.diagnostic}>Backend: {backendBaseUrl}</Text> : null}
          <Text style={styles.diagnostic}>Battery mode: {health.batteryMode.replaceAll('_', ' ')}</Text>
          <Text style={styles.diagnostic}>Last transport event: {activity.lastActivity ?? 'None'}</Text>
        </View>
        {showDemoGateway ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ busy: syncing, disabled: syncing }}
            disabled={syncing}
            onPress={() => void runDemoGatewaySync()}
            style={[styles.secondaryButton, syncing ? styles.disabled : null]}
          >
            <Text style={styles.secondaryButtonText}>{syncing ? 'Running…' : 'Run demo network confirmation'}</Text>
          </TouchableOpacity>
        ) : null}
        {nativeBle && showBleDiagnostics ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ busy: syncing, disabled: syncing }}
            disabled={syncing}
            onPress={() => void sendTestEnvelope()}
            style={[styles.secondaryButton, syncing ? styles.disabled : null]}
          >
            <Text style={styles.secondaryButtonText}>Send test envelope</Text>
          </TouchableOpacity>
        ) : null}
      </Disclosure>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xl,
  },
  sectionTitle: {
    color: colors.textStrong,
    ...typography.sectionTitle,
  },
  sectionDescription: {
    color: colors.muted,
    ...typography.body,
    marginTop: spacing.xs,
  },
  deviceList: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  deviceRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  deviceDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
    marginRight: spacing.sm,
  },
  deviceId: {
    flex: 1,
    minWidth: 0,
    color: colors.textStrong,
    ...typography.label,
  },
  deviceState: {
    ...typography.caption,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  emptyDevices: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.textStrong,
    ...typography.bodyStrong,
  },
  emptyBody: {
    color: colors.muted,
    ...typography.caption,
    marginTop: spacing.xxs,
  },
  nearbyGroup: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  nearbyTitle: {
    color: colors.muted,
    ...typography.label,
  },
  statRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  statLabel: {
    flex: 1,
    color: colors.text,
    ...typography.label,
  },
  statValue: {
    color: colors.textStrong,
    ...typography.bodyStrong,
    textAlign: 'right',
  },
  gatewayValue: {
    flex: 1,
    color: colors.primary,
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    color: colors.onAccent,
    ...typography.button,
  },
  secondaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.primary,
    ...typography.bodyStrong,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.58,
  },
  activityPanel: {
    backgroundColor: colors.infoTint,
    borderRadius: radii.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  activityEyebrow: {
    color: colors.info,
    ...typography.caption,
    fontWeight: '700',
  },
  activityTitle: {
    color: colors.textStrong,
    ...typography.bodyStrong,
    marginTop: spacing.xxs,
  },
  activityBody: {
    color: colors.text,
    ...typography.caption,
    marginTop: spacing.xxs,
  },
  syncSuccess: {
    color: colors.safe,
    ...typography.caption,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  syncPending: {
    color: colors.warning,
    ...typography.caption,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  deliveryStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
    color: colors.primary,
    fontSize: 14,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.sm,
  },
  stepTitle: {
    color: colors.textStrong,
    ...typography.bodyStrong,
  },
  stepBody: {
    color: colors.muted,
    ...typography.caption,
    marginTop: 1,
  },
  diagnosticRows: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  diagnostic: {
    color: colors.text,
    ...typography.caption,
    marginBottom: spacing.xs,
  },
});
