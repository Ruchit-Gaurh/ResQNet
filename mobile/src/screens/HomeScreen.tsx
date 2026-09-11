import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { NetworkHealthStatus } from '../../../shared/types/index';
import { NetworkStatusPill } from '../components/NetworkStatusPill';
import { Screen } from '../components/Screen';
import { colors } from '../theme';
import type { MobileMeshMode } from '../services/createMobileServices';

export type AppRoute =
  | 'HOME'
  | 'SAFE'
  | 'MISSING'
  | 'FOUND'
  | 'SIGHTING'
  | 'CASES'
  | 'NETWORK'
  | 'SETTINGS';

interface HomeScreenProps {
  health: NetworkHealthStatus;
  transportMode: MobileMeshMode;
  onNavigate: (route: AppRoute) => void;
}

const ACTIONS: Array<{ route: AppRoute; icon: string; label: string; color: string }> = [
  { route: 'SAFE', icon: '✓', label: "I'M SAFE", color: colors.safe },
  { route: 'MISSING', icon: '!', label: 'SOMEONE IS MISSING', color: colors.missing },
  { route: 'FOUND', icon: '+', label: 'I FOUND SOMEONE', color: colors.found },
  { route: 'SIGHTING', icon: '◉', label: 'REPORT A SIGHTING', color: colors.sighting },
];

export function HomeScreen({ health, transportMode, onNavigate }: HomeScreenProps) {
  const transportLabel = transportMode === 'DEV_EMULATOR_MESH'
    ? 'Development emulator mesh is active through the local broker. This is not BLE.'
    : 'Development mode uses the in-process A to B to C mock mesh. This is not BLE.';
  return (
    <Screen title="RESQNET" subtitle="Emergency identity and family coordination">
      <NetworkStatusPill health={health} />
      <View style={styles.mockNotice}>
        <Text style={styles.mockText}>{transportLabel}</Text>
      </View>
      <View style={styles.actions}>
        {ACTIONS.map((action) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={action.route}
            onPress={() => onNavigate(action.route)}
            style={[styles.action, { backgroundColor: action.color }]}
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.secondary}>
        <TouchableOpacity onPress={() => onNavigate('NETWORK')} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Network Status</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onNavigate('CASES')} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>My Cases</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onNavigate('SETTINGS')} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mockNotice: {
    backgroundColor: colors.overlay,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  mockText: {
    color: '#6B4B00',
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    gap: 12,
    marginTop: 20,
  },
  action: {
    minHeight: 86,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionIcon: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    width: 48,
  },
  actionLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  secondary: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '800',
  },
});
