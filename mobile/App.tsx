import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text } from 'react-native';
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
  const services = useMemo(() => createMobileServices(), []);
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
    setHealth({
      ...nextHealth,
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

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route === 'HOME') {
        return false;
      }
      setRoute('HOME');
      return true;
    });
    return () => subscription.remove();
  }, [route]);

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
      return <HomeScreen health={health} transportMode={services.transportMode} onNavigate={setRoute} />;
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
});
