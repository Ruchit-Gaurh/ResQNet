import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minimumTouchTarget, radii, spacing, typography } from '../theme';

export interface PhotoFieldProps {
  photoUri?: string;
  onChange: (uri: string | undefined) => void;
  label?: string;
  hint?: string;
}

export function PhotoField({
  photoUri,
  onChange,
  label = 'Photo',
  hint = 'Optional. Add a clear, recent photo if one is available.',
}: PhotoFieldProps) {
  async function choosePhoto(): Promise<void> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled) {
        const selectedUri = result.assets[0]?.uri;
        if (!selectedUri) {
          Alert.alert('Photo unavailable', 'The selected photo could not be opened. You can still submit without it.');
          return;
        }
        onChange(selectedUri);
      }
    } catch (error) {
      Alert.alert(
        'Photo unavailable',
        error instanceof Error ? error.message : 'Could not open photos. You can still submit without one.',
      );
    }
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label} <Text style={styles.optional}>Optional</Text>
      </Text>
      {photoUri ? (
        <View style={styles.selectedPhoto}>
          <Image
            accessibilityLabel="Selected report photo"
            accessible
            resizeMode="cover"
            source={{ uri: photoUri }}
            style={styles.preview}
          />
          <View style={styles.selectedActions}>
            <Text style={styles.selectedLabel}>Photo added</Text>
            <Pressable
              accessibilityHint="Choose a different photo from this phone"
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => void choosePhoto()}
              style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.secondaryButtonText}>Change photo</Text>
            </Pressable>
            <Pressable
              accessibilityHint="Remove this photo from the report"
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => onChange(undefined)}
              style={({ pressed }) => [styles.removeButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.removeText}>Remove photo</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityHint="Choose a photo from this phone"
          accessibilityRole="button"
          onPress={() => void choosePhoto()}
          style={({ pressed }) => [styles.addButton, pressed ? styles.addButtonPressed : null]}
        >
          <Text style={styles.addButtonText}>Add a photo</Text>
        </Pressable>
      )}
      <Text style={styles.hint}>{hint}</Text>
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
  addButton: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  addButtonPressed: {
    backgroundColor: colors.surfacePressed,
    borderColor: colors.focus,
  },
  addButtonText: {
    color: colors.primary,
    ...typography.bodyStrong,
  },
  selectedPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  preview: {
    width: 112,
    height: 112,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  selectedActions: {
    flex: 1,
    alignItems: 'flex-start',
  },
  selectedLabel: {
    color: colors.text,
    ...typography.bodyStrong,
    marginBottom: spacing.xxs,
  },
  secondaryButton: {
    minHeight: minimumTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginLeft: -spacing.sm,
  },
  secondaryButtonText: {
    color: colors.primary,
    ...typography.bodyStrong,
  },
  removeButton: {
    minHeight: minimumTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginLeft: -spacing.sm,
  },
  pressed: {
    opacity: 0.68,
  },
  removeText: {
    color: colors.danger,
    ...typography.bodyStrong,
  },
  hint: {
    color: colors.muted,
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
