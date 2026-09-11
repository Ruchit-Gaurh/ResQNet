import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { NetworkHealthStatus } from '../../../shared/types/index';
import { DeliveryJourney } from '../components/DeliveryJourney';
import { DemoOfflineControl } from '../components/DemoOfflineControl';
import { NetworkStatusPill } from '../components/NetworkStatusPill';
import { Screen } from '../components/Screen';
import type { MobileMeshActivity } from '../services/createMobileServices';
import { colors, radii, spacing, typography } from '../theme';

export type AppRoute =
  | 'HOME'
  | 'SAFE'
  | 'MISSING'
  | 'FOUND'
  | 'SIGHTING'
  | 'HELP'
  | 'RESCUER'
  | 'CASES'
  | 'NETWORK'
  | 'SETTINGS';

interface HomeScreenProps {
  activity: MobileMeshActivity;
  demoOffline: boolean;
  demoModeBusy: boolean;
  health: NetworkHealthStatus;
  onNavigate: (route: AppRoute) => void;
  onToggleDemoOffline: (enabled: boolean) => void;
}

interface EmergencyAction {
  route: AppRoute;
  marker: string;
  label: string;
  description: string;
  color: string;
  tint: string;
  filled?: boolean;
}

const ACTIONS: EmergencyAction[] = [
  {
    route: 'SAFE',
    marker: '✓',
    label: "I'm safe",
    description: 'Let family and responders know',
    color: colors.safe,
    tint: colors.safeTint,
    filled: true,
  },
  {
    route: 'MISSING',
    marker: '!',
    label: 'Someone is missing',
    description: 'Start a missing person report',
    color: colors.missing,
    tint: colors.missingTint,
    filled: true,
  },
  {
    route: 'FOUND',
    marker: '+',
    label: 'I found someone',
    description: 'Their name can be unknown',
    color: colors.found,
    tint: colors.foundTint,
  },
  {
    route: 'SIGHTING',
    marker: '•',
    label: 'Report a sighting',
    description: 'Share unverified information',
    color: colors.sighting,
    tint: colors.sightingTint,
  },
];

export function HomeScreen({
  activity,
  demoOffline,
  demoModeBusy,
  health,
  onNavigate,
  onToggleDemoOffline,
}: HomeScreenProps) {
  return (
    <Screen title="ResQNet" subtitle="Disaster response and family coordination">
      <NetworkStatusPill health={health} onPress={() => onNavigate('NETWORK')} />

      <TouchableOpacity
        accessibilityHint="Share this phone's current location with nearby devices and responders"
        accessibilityRole="button"
        activeOpacity={0.82}
        onPress={() => onNavigate('HELP')}
        style={styles.helpButton}
      >
        <View style={styles.helpMarker}>
          <Text accessible={false} style={styles.helpMarkerText}>SOS</Text>
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.helpTitle}>I need help</Text>
          <Text style={styles.helpBody}>Share my location for rescue</Text>
        </View>
        <Text accessible={false} style={styles.helpChevron}>›</Text>
      </TouchableOpacity>

      <View style={styles.prompt}>
        <Text accessibilityRole="header" style={styles.promptTitle}>What do you need help with?</Text>
        <Text style={styles.promptBody}>Choose one action. Every report is saved on this phone first.</Text>
      </View>

      <View style={styles.actions}>
        {ACTIONS.map((action) => {
          const foreground = action.filled ? colors.onAccent : action.color;
          const secondary = action.filled ? colors.onAccent : colors.muted;
          return (
            <TouchableOpacity
              accessibilityHint={action.description}
              accessibilityRole="button"
              activeOpacity={0.78}
              key={action.route}
              onPress={() => onNavigate(action.route)}
              style={[
                styles.action,
                { backgroundColor: action.filled ? action.color : colors.surface },
                action.filled ? null : styles.outlineAction,
              ]}
            >
              <View style={[styles.marker, { backgroundColor: action.filled ? 'rgba(255, 255, 255, 0.14)' : action.tint }]}>
                <Text style={[styles.markerText, { color: foreground }]}>{action.marker}</Text>
              </View>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionLabel, { color: foreground }]}>{action.label}</Text>
                <Text style={[styles.actionDescription, { color: secondary }]}>{action.description}</Text>
              </View>
              <Text accessible={false} style={[styles.actionChevron, { color: foreground }]}>›</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <DeliveryJourney activity={activity} demoOffline={demoOffline} />
      <DemoOfflineControl
        busy={demoModeBusy}
        compact
        enabled={demoOffline}
        onChange={onToggleDemoOffline}
      />

      <TouchableOpacity
        accessibilityHint="View updates for reports created on this phone"
        accessibilityRole="button"
        onPress={() => onNavigate('CASES')}
        style={styles.casesButton}
      >
        <View style={styles.casesCopy}>
          <Text style={styles.casesTitle}>My cases and updates</Text>
          <Text style={styles.casesBody}>Track searches, possible matches, and verified news</Text>
        </View>
        <Text accessible={false} style={styles.casesChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityHint="Open field directions to a missing person's last reported location"
        accessibilityRole="button"
        onPress={() => onNavigate('RESCUER')}
        style={styles.rescuerButton}
      >
        <View style={styles.rescuerMarker}>
          <Text accessible={false} style={styles.rescuerMarkerText}>↑</Text>
        </View>
        <View style={styles.casesCopy}>
          <Text style={styles.rescuerTitle}>Rescuer navigation</Text>
          <Text style={styles.rescuerBody}>Field guidance to a last reported location</Text>
        </View>
        <Text accessible={false} style={styles.casesChevron}>›</Text>
      </TouchableOpacity>

      <View style={styles.utilityRow}>
        <TouchableOpacity accessibilityRole="button" onPress={() => onNavigate('NETWORK')} style={styles.utilityButton}>
          <Text style={styles.utilityText}>Network status</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => onNavigate('SETTINGS')} style={styles.utilityButton}>
          <Text style={styles.utilityText}>Safety & privacy</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  prompt: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  helpButton: {
    minHeight: 82,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.danger,
  },
  helpMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  helpMarkerText: { color: colors.onAccent, fontSize: 13, lineHeight: 16, fontWeight: '900' },
  helpTitle: { color: colors.onAccent, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  helpBody: { color: colors.onAccent, ...typography.caption, marginTop: 2 },
  helpChevron: { color: colors.onAccent, fontSize: 30, lineHeight: 34, marginLeft: spacing.xs },
  promptTitle: {
    color: colors.textStrong,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },
  promptBody: {
    color: colors.muted,
    ...typography.label,
    fontWeight: '400',
    marginTop: spacing.xxs,
  },
  actions: {
    gap: 10,
  },
  action: {
    minHeight: 76,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  outlineAction: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  marker: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '900',
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 13,
  },
  actionLabel: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  actionChevron: {
    fontSize: 28,
    lineHeight: 30,
    marginLeft: spacing.xs,
  },
  casesButton: {
    minHeight: 68,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  casesCopy: {
    flex: 1,
    minWidth: 0,
  },
  casesTitle: {
    color: colors.textStrong,
    ...typography.bodyStrong,
  },
  casesBody: {
    color: colors.muted,
    ...typography.caption,
    marginTop: 2,
  },
  casesChevron: {
    color: colors.primary,
    fontSize: 28,
    marginLeft: spacing.sm,
  },
  rescuerButton: {
    minHeight: 68,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.infoTint,
  },
  rescuerMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    backgroundColor: colors.primary,
  },
  rescuerMarkerText: {
    color: colors.onAccent,
    fontSize: 26,
    lineHeight: 29,
    fontWeight: '800',
  },
  rescuerTitle: {
    color: colors.textStrong,
    ...typography.bodyStrong,
  },
  rescuerBody: {
    color: colors.muted,
    ...typography.caption,
    marginTop: 2,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  utilityButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  utilityText: {
    color: colors.primary,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '700',
  },
});
