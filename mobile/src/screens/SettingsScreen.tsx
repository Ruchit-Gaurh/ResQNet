import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme';

interface SettingsScreenProps {
  onBack: () => void;
}

interface SafetyItemProps {
  title: string;
  children: string;
}

function SafetyItem({ title, children }: SafetyItemProps) {
  return (
    <View style={styles.item}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  return (
    <Screen
      title="Safety & privacy"
      subtitle="Simple rules that protect people while reports move through ResQNet."
      onBack={onBack}
    >
      <SafetyItem title="Your report saves first">
        Reports are stored on this phone before any network attempt. Losing a connection will not erase a saved report.
      </SafetyItem>
      <SafetyItem title="Share only what helps">
        Avoid private home addresses, unnecessary medical details, or family contact information unless responders truly need it.
      </SafetyItem>
      <SafetyItem title="Nearby sharing is limited">
        ResQNet shares the report information needed to help route and compare records. A nearby device receiving it is not the same as authority confirmation.
      </SafetyItem>
      <SafetyItem title="People confirm identities">
        A possible match is only a lead. An authorized responder must review the evidence before a person is shown as located.
      </SafetyItem>
      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Need connection details?</Text>
        <Text style={styles.footerBody}>Open Network status from Home to see connected devices, waiting reports, and technical diagnostics.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.lg,
  },
  title: {
    color: colors.textStrong,
    ...typography.sectionTitle,
  },
  body: {
    color: colors.muted,
    ...typography.body,
    marginTop: spacing.xs,
  },
  footer: {
    backgroundColor: colors.primaryTint,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  footerTitle: {
    color: colors.primary,
    ...typography.bodyStrong,
  },
  footerBody: {
    color: colors.text,
    ...typography.caption,
    marginTop: spacing.xxs,
  },
});
