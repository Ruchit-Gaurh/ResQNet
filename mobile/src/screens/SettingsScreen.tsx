import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme';

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  return (
    <Screen title="Settings & safety" onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.title}>Transport</Text>
        <Text style={styles.body}>Mock mesh is active for development. This build does not claim native BLE connectivity.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Privacy</Text>
        <Text style={styles.body}>Reports are stored locally before relay. Avoid adding phone numbers, medical details, or exact private locations unless necessary.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Verification</Text>
        <Text style={styles.body}>Possible matches are suggestions. Only an authorized human verification can create a verified case update.</Text>
      </View>
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
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  body: {
    color: colors.muted,
    lineHeight: 22,
    marginTop: 7,
  },
});
