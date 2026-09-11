import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../theme';

interface FormFieldProps extends Pick<
  ComponentProps<typeof TextInput>,
  'value' | 'onChangeText' | 'keyboardType' | 'multiline' | 'placeholder' | 'autoCapitalize'
> {
  label: string;
  optional?: boolean;
}

export function FormField({ label, optional = true, multiline, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label} {optional ? <Text style={styles.optional}>— optional</Text> : null}
      </Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        multiline={multiline}
        placeholderTextColor="#7B8494"
        style={[styles.input, multiline ? styles.multiline : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 15,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 7,
  },
  optional: {
    color: colors.muted,
    fontWeight: '500',
  },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
