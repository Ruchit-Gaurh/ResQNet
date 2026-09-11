import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { NetworkHealthStatus } from '../../../shared/types/index';
import { colors, radii, spacing, typography } from '../theme';

const PRESENTATION: Record<
  NetworkHealthStatus['connectivity'],
  { label: string; detail: (health: NetworkHealthStatus) => string; color: string }
> = {
  INTERNET_CONNECTED: {
    label: 'Disaster network available',
    detail: () => 'Reports can reach the coordination service',
    color: colors.safe,
  },
  MESH_CONNECTED: {
    label: 'Nearby network available',
    detail: (health) => `${health.nearbyPeerCount} nearby device${health.nearbyPeerCount === 1 ? '' : 's'}`,
    color: colors.warning,
  },
  OFFLINE_QUEUED: {
    label: 'Offline, saved on this phone',
    detail: (health) => `${health.queuedMessageCount} report${health.queuedMessageCount === 1 ? '' : 's'} waiting to send`,
    color: colors.sighting,
  },
  ISOLATED: {
    label: 'No network connection',
    detail: () => 'New reports will still be saved on this phone',
    color: colors.isolated,
  },
};

interface NetworkStatusPillProps {
  health: NetworkHealthStatus;
  onPress?: () => void;
}

export function NetworkStatusPill({ health, onPress }: NetworkStatusPillProps) {
  const state = PRESENTATION[health.connectivity];
  const spokenText = `Network status: ${state.label}. ${state.detail(health)}`;
  const content = (
    <>
      <View accessible={false} style={[styles.dot, { backgroundColor: state.color }]} />
      <View style={styles.textArea}>
        <Text style={styles.label}>{state.label}</Text>
        <Text style={styles.detail}>{state.detail(health)}</Text>
      </View>
      {onPress ? <Text accessible={false} style={styles.chevron}>›</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        accessibilityHint="Opens network status and connected device details"
        accessibilityLabel={spokenText}
        accessibilityLiveRegion="polite"
        accessibilityRole="button"
        activeOpacity={0.72}
        onPress={onPress}
        style={styles.container}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      accessibilityLabel={spokenText}
      accessibilityLiveRegion="polite"
      accessible
      style={styles.container}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    marginRight: spacing.sm,
  },
  textArea: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: colors.textStrong,
    ...typography.label,
    fontWeight: '700',
  },
  detail: {
    color: colors.muted,
    ...typography.caption,
    marginTop: 1,
  },
  chevron: {
    color: colors.muted,
    fontSize: 28,
    lineHeight: 30,
    marginLeft: spacing.xs,
  },
});
