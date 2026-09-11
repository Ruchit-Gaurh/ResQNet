import { useState, type ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';

export interface FormFieldProps extends Omit<ComponentProps<typeof TextInput>, 'style'> {
  label: string;
  optional?: boolean;
  helperText?: string;
  error?: string;
}

export function FormField({
  label,
  optional = true,
  helperText,
  error,
  multiline,
  editable = true,
  onBlur,
  onFocus,
  placeholderTextColor,
  accessibilityLabel,
  accessibilityHint,
  ...inputProps
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const fieldDescription = error ?? helperText;

  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label}{' '}
        <Text style={optional ? styles.optional : styles.required}>
          {optional ? 'Optional' : 'Required'}
        </Text>
      </Text>
      <TextInput
        {...inputProps}
        accessibilityHint={accessibilityHint ?? fieldDescription}
        accessibilityLabel={accessibilityLabel ?? `${label}, ${optional ? 'optional' : 'required'}`}
        accessibilityState={{ disabled: !editable }}
        editable={editable}
        multiline={multiline}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={placeholderTextColor ?? colors.placeholder}
        selectionColor={colors.focus}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
          !editable ? styles.inputDisabled : null,
        ]}
      />
      {fieldDescription ? (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          accessibilityRole={error ? 'alert' : undefined}
          style={[styles.supportingText, error ? styles.errorText : null]}
        >
          {fieldDescription}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.text,
    ...typography.label,
    marginBottom: spacing.xs,
  },
  optional: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '400',
  },
  required: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputFocused: {
    borderColor: colors.focus,
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerTint,
  },
  inputDisabled: {
    backgroundColor: colors.disabledSurface,
    color: colors.disabledText,
  },
  multiline: {
    minHeight: 108,
    textAlignVertical: 'top',
  },
  supportingText: {
    color: colors.muted,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '600',
  },
});
