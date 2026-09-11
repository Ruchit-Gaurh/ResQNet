import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';

export interface SubmitButtonProps {
  label: string;
  busy: boolean;
  color?: string;
  disabled?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
}

export function SubmitButton({
  label,
  busy,
  color = colors.primary,
  disabled = false,
  accessibilityHint,
  onPress,
}: SubmitButtonProps) {
  const unavailable = busy || disabled;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={busy ? `${label}, saving` : label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color },
        pressed ? styles.pressed : null,
        unavailable ? styles.disabled : null,
      ]}
    >
      {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.text}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    backgroundColor: colors.disabledSurface,
  },
  text: {
    color: colors.onAccent,
    ...typography.button,
    textAlign: 'center',
  },
});
