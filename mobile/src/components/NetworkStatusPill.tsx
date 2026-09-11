import { StyleSheet, Text, View } from 'react-native';

import type { NetworkHealthStatus } from '../../../shared/types/index';
import { colors } from '../theme';

const PRESENTATION: Record<
  NetworkHealthStatus['connectivity'],
  { icon: string; label: string; color: string }
> = {
  INTERNET_CONNECTED: { icon: '●', label: 'Internet Connected', color: colors.safe },
  MESH_CONNECTED: { icon: '●', label: 'Mesh Connected', color: colors.warning },
  OFFLINE_QUEUED: { icon: '●', label: 'Offline — Queued', color: colors.sighting },
  ISOLATED: { icon: '●', label: 'Isolated', color: colors.isolated },
};

interface NetworkStatusPillProps {
  health: NetworkHealthStatus;
}

export function NetworkStatusPill({ health }: NetworkStatusPillProps) {
  const state = PRESENTATION[health.connectivity];
  return (
    <View accessibilityLabel={`Network status: ${state.label}`} style={styles.container}>
      <Text style={[styles.icon, { color: state.color }]}>{state.icon}</Text>
      <View style={styles.textArea}>
        <Text style={styles.label}>{state.label}</Text>
        <Text style={styles.detail}>
          {health.connectivity === 'MESH_CONNECTED'
            ? `${health.nearbyPeerCount} nearby peer${health.nearbyPeerCount === 1 ? '' : 's'}`
            : `${health.queuedMessageCount} message${health.queuedMessageCount === 1 ? '' : 's'} queued`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  icon: {
    fontSize: 23,
    marginRight: 10,
  },
  textArea: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  detail: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
});
