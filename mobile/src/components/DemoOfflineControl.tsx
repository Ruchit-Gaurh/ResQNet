import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, minimumTouchTarget, radii, spacing, typography } from '../theme';

interface DemoOfflineControlProps {
  enabled: boolean;
  busy?: boolean;
  onChange: (enabled: boolean) => void;
  compact?: boolean;
}

export function DemoOfflineControl({
  enabled,
  busy = false,
  onChange,
  compact = false,
}: DemoOfflineControlProps) {
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled: busy }}
      accessibilityLabel={`Demo offline mode. ${enabled ? 'On' : 'Off'}. Pauses internet sync in ResQNet on this phone only.`}
      activeOpacity={0.78}
      disabled={busy}
      onPress={() => onChange(!enabled)}
      style={[
        styles.container,
        enabled ? styles.containerEnabled : null,
        busy ? styles.containerBusy : null,
        compact ? styles.compact : null,
      ]}
    >
      <View style={styles.copy}>
        <Text style={styles.label}>Demo offline mode</Text>
        <Text style={styles.description}>
          {enabled
            ? 'Internet sync is paused on this phone. Nearby sharing stays active.'
            : 'Turn on to demonstrate local saving and nearby sharing without internet.'}
        </Text>
      </View>
      <View style={[styles.modeBadge, enabled ? styles.modeBadgeEnabled : null]}>
        <Text style={[styles.modeBadgeText, enabled ? styles.modeBadgeTextEnabled : null]}>
          {busy ? 'WAIT' : enabled ? 'ON' : 'OFF'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: minimumTouchTarget + 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compact: {
    marginTop: spacing.sm,
  },
  containerEnabled: {
    backgroundColor: colors.warningTint,
    borderColor: colors.warning,
  },
  containerBusy: {
    opacity: 0.6,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  label: {
    color: colors.textStrong,
    ...typography.label,
  },
  description: {
    color: colors.muted,
    ...typography.caption,
    marginTop: 2,
  },
  modeBadge: {
    minWidth: minimumTouchTarget,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  modeBadgeEnabled: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  modeBadgeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modeBadgeTextEnabled: {
    color: colors.textStrong,
  },
});
