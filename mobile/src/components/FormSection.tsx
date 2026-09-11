import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  heading: {
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textStrong,
    ...typography.sectionTitle,
  },
  description: {
    color: colors.muted,
    ...typography.body,
    marginTop: spacing.xxs,
  },
});
