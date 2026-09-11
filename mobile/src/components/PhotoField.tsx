import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme';

interface PhotoFieldProps {
  photoUri?: string;
  onChange: (uri: string | undefined) => void;
}

export function PhotoField({ photoUri, onChange }: PhotoFieldProps) {
  async function choosePhoto(): Promise<void> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled) {
        onChange(result.assets[0]?.uri);
      }
    } catch (error) {
      Alert.alert('Photo unavailable', error instanceof Error ? error.message : 'Could not open photos.');
    }
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>Photo <Text style={styles.optional}>— optional</Text></Text>
      {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" onPress={choosePhoto} style={styles.button}>
          <Text style={styles.buttonText}>{photoUri ? 'Change photo' : 'Add photo'}</Text>
        </TouchableOpacity>
        {photoUri ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => onChange(undefined)} style={styles.remove}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.hint}>Stored locally first. A photo is never required to submit.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 16,
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
  preview: {
    width: 112,
    height: 112,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: colors.info,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  remove: {
    minHeight: 46,
    justifyContent: 'center',
  },
  removeText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 8,
  },
});
