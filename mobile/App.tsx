import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { NetworkHealthStatus } from '../shared/types/index';
import {
  createMobileServices,
  type MobileMeshActivity,
} from './src/services/createMobileServices';
import { FamilyDashboardScreen } from './src/screens/FamilyDashboardScreen';
import { FoundReportScreen } from './src/screens/FoundReportScreen';
import { type AppRoute, HomeScreen } from './src/screens/HomeScreen';
import { MissingReportScreen } from './src/screens/MissingReportScreen';
import { NetworkStatusScreen } from './src/screens/NetworkStatusScreen';
import { SafeCheckInScreen } from './src/screens/SafeCheckInScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SightingReportScreen } from './src/screens/SightingReportScreen';
import { colors } from './src/theme';

const INITIAL_HEALTH: NetworkHealthStatus = {
  connectivity: 'ISOLATED',
  nearbyPeerCount: 0,
  queuedMessageCount: 0,
  batteryMode: 'NORMAL',
};

const INITIAL_ACTIVITY: MobileMeshActivity = {
  transportMode: 'MOCK_IN_PROCESS',
  nodeId: 'INITIALIZING',
  brokerConnected: false,
  connectedPeerIds: [],
  queuedCount: 0,
  receivedCount: 0,
  relayedCount: 0,
  peerReceiptCount: 0,
  gatewayState: 'NOT_CONNECTED',
};

function AppContent() {
  const [serviceGeneration, setServiceGeneration] = useState(0);
  const services = useMemo(() => createMobileServices(), [serviceGeneration]);
  const [route, setRoute] = useState<AppRoute>('HOME');
  const [health, setHealth] = useState<NetworkHealthStatus>(INITIAL_HEALTH);
  const [meshActivity, setMeshActivity] = useState<MobileMeshActivity>(INITIAL_ACTIVITY);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string>();

  const refreshHealth = useCallback(async () => {
    await services.mesh.getQueuedMessages();
    const nextHealth = services.mesh.getNetworkHealth();
    const nextActivity = await services.getMeshActivity();
    const deliveredRecords = (await services.localQueue.getRecords()).filter(
      (record) => record.deliveryState === 'DELIVERED_TO_NETWORK',
    );
    const persistedAcknowledgement = deliveredRecords.reduce<number | undefined>(
      (latest, record) => latest === undefined || record.updatedAt > latest ? record.updatedAt : latest,
      undefined,
    );
    const connectivity: NetworkHealthStatus['connectivity'] =
      services.canSyncBackend && nextActivity.gatewayState === 'ACKNOWLEDGED'
        ? 'INTERNET_CONNECTED'
        : nextActivity.connectedPeerIds.length > 0
          ? 'MESH_CONNECTED'
          : nextActivity.queuedCount > 0
            ? 'OFFLINE_QUEUED'
            : 'ISOLATED';
    setHealth({
      ...nextHealth,
      connectivity,
      nearbyPeerCount: nextActivity.connectedPeerIds.length,
      queuedMessageCount: nextActivity.queuedCount,
      lastSuccessfulSyncTimestamp:
        nextHealth.lastSuccessfulSyncTimestamp ?? persistedAcknowledgement,
    });
    setMeshActivity(nextActivity);
  }, [services]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    services.initialize()
      .then(async () => {
        if (active) {
          unsubscribe = services.subscribeMeshActivity(() => {
            if (active) void refreshHealth();
          });
          await refreshHealth();
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setStartupError(error instanceof Error ? error.message : 'Could not initialize local services.');
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
      services.shutdown();
    };
  }, [refreshHealth, services]);

  const onSaved = useCallback(() => {
    void refreshHealth();
    if (services.canSyncBackend) {
      void services.syncBackend().then(refreshHealth).catch((error: unknown) => {
        console.info('Report remains local until backend connectivity returns.', error);
      });
    }
    setRoute('CASES');
  }, [refreshHealth, services]);

  const syncDemoGateway = useCallback(async () => {
    const response = await services.syncDemoGateway();
    await refreshHealth();
    return response;
  }, [refreshHealth, services]);

  const syncBackend = useCallback(async () => {
    const response = await services.syncBackend();
    await refreshHealth();
    return response;
  }, [refreshHealth, services]);

  if (startupError) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorTitle}>ResQNet could not start</Text>
        <Text style={styles.errorText}>{startupError}</Text>
        <Text style={styles.errorHelp}>Your report has not been submitted. Check the message above, then try again.</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            setStartupError(undefined);
            setReady(false);
            setServiceGeneration((generation) => generation + 1);
          }}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.info} size="large" />
        <Text style={styles.loading}>Opening local emergency storage…</Text>
      </SafeAreaView>
    );
  }

  switch (route) {
    case 'MISSING':
      return <MissingReportScreen submissions={services.submissions} onBack={() => setRoute('HOME')} onSaved={onSaved} />;
    case 'FOUND':
      return <FoundReportScreen submissions={services.submissions} onBack={() => setRoute('HOME')} onSaved={onSaved} />;
    case 'SAFE':
      return <SafeCheckInScreen submissions={services.submissions} onBack={() => setRoute('HOME')} onSaved={onSaved} />;
    case 'SIGHTING':
      return <SightingReportScreen submissions={services.submissions} onBack={() => setRoute('HOME')} onSaved={onSaved} />;
    case 'CASES':
      return (
        <FamilyDashboardScreen
          localQueue={services.localQueue}
          onBack={() => setRoute('HOME')}
          onReportMissing={() => setRoute('MISSING')}
          onRefreshServer={services.canSyncBackend ? syncBackend : undefined}
        />
      );
    case 'NETWORK':
      return (
        <NetworkStatusScreen
          health={health}
          activity={meshActivity}
          onBack={() => setRoute('HOME')}
          onDemoGatewaySync={syncDemoGateway}
          onBackendSync={syncBackend}
          onRetryNativeBle={() => services.retryNativeBle()}
          onSendBleTestEnvelope={() => services.sendBleTestEnvelope()}
          showDemoGateway={services.canRunDemoGateway}
          showBackendSync={services.canSyncBackend}
          backendBaseUrl={services.backendBaseUrl}
          showBleDiagnostics={services.transportMode === 'NATIVE_BLE' && __DEV__}
        />
      );
    case 'SETTINGS':
      return <SettingsScreen onBack={() => setRoute('HOME')} />;
    case 'HOME':
    default:
      return <HomeScreen health={health} onNavigate={setRoute} />;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  loading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 22,
    fontWeight: '900',
  },
  errorText: {
    color: colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  errorHelp: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 360,
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    minHeight: 52,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.info,
    borderRadius: 12,
    marginTop: 20,
    paddingHorizontal: 22,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
