import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors } from '../theme';

interface SubmitButtonProps {
  label: string;
  busy: boolean;
  color?: string;
  onPress: () => void;
}

export function SubmitButton({ label, busy, color = colors.text, onPress }: SubmitButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={[styles.button, { backgroundColor: color }, busy ? styles.disabled : null]}
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.text}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disabled: {
    opacity: 0.65,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
});
