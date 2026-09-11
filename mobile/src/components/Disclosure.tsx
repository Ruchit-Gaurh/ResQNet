import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minimumTouchTarget, spacing, typography } from '../theme';

export interface DisclosureProps {
  label: string;
  expanded: boolean;
  onPress: () => void;
  children: ReactNode;
}

export function Disclosure({ label, expanded, onPress, children }: DisclosureProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityHint={expanded ? 'Hides these optional fields' : 'Shows more optional fields'}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={({ pressed }) => [styles.trigger, pressed ? styles.triggerPressed : null]}
      >
        <Text style={styles.label}>{label}</Text>
        <Text accessible={false} style={styles.symbol}>
          {expanded ? '−' : '+'}
        </Text>
      </Pressable>
      {expanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.lg,
  },
  trigger: {
    minHeight: minimumTouchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  triggerPressed: {
    opacity: 0.68,
  },
  label: {
    flex: 1,
    color: colors.primary,
    ...typography.bodyStrong,
    paddingRight: spacing.md,
  },
  symbol: {
    width: minimumTouchTarget,
    color: colors.primary,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '400',
    textAlign: 'right',
  },
  content: {
    paddingTop: spacing.sm,
  },
});
