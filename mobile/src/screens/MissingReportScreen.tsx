import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';

import { Disclosure } from '../components/Disclosure';
import { FormField } from '../components/FormField';
import { FormSection } from '../components/FormSection';
import { PhotoField } from '../components/PhotoField';
import { Screen } from '../components/Screen';
import { SubmitButton } from '../components/SubmitButton';
import type { ReportSubmissionService } from '../services/ReportSubmissionService';
import type { GeoLocation } from '../../../shared/types/index';
import { colors, radii, spacing, typography } from '../theme';

interface MissingReportScreenProps {
  submissions: ReportSubmissionService;
  onBack: () => void;
  onSaved: () => void;
}

function parseAge(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function MissingReportScreen({ submissions, onBack, onSaved }: MissingReportScreenProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [clothing, setClothing] = useState('');
  const [zone, setZone] = useState('');
  const [lastKnownLocation, setLastKnownLocation] = useState<GeoLocation>();
  const [locating, setLocating] = useState(false);
  const [details, setDetails] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasUnsavedChanges = Boolean(lastKnownLocation) || [name, age, photoUri, clothing, zone, details].some((value) =>
    Boolean(value?.trim()),
  );

  async function captureLastSeenLocation(): Promise<void> {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location not available', 'You can still enter a zone or landmark manually.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLastKnownLocation({
        lat: Math.round(position.coords.latitude * 100_000) / 100_000,
        lng: Math.round(position.coords.longitude * 100_000) / 100_000,
        accuracyMeters: position.coords.accuracy ?? undefined,
        zone: zone.trim() || undefined,
      });
    } catch {
      Alert.alert('Could not get location', 'Enter a zone or nearby landmark instead. Your report can still be saved.');
    } finally {
      setLocating(false);
    }
  }

  async function submit(): Promise<void> {
    if (![name, age, photoUri, clothing, zone, details].some((value) => Boolean(value?.trim()))) {
      Alert.alert('Add one detail', 'A partial report is welcome, but include at least one useful detail.');
      return;
    }
    setBusy(true);
    try {
      const result = await submissions.submitMissing({
        name,
        approximateAge: parseAge(age),
        photoUri,
        clothing,
        zone,
        lastKnownLocation,
        details,
      });
      const message = result.deliveryState === 'RELAYING'
        ? 'Saved on this phone and sharing with nearby devices. It has not reached the disaster network yet.'
        : 'Saved on this phone. ResQNet will keep trying to share it when a connection is available.';
      Alert.alert(
        'Missing person report saved',
        result.transportError
          ? 'Your report is safe on this phone. It could not be shared yet, so ResQNet will keep trying.'
          : message,
      );
      onSaved();
    } catch (error) {
      Alert.alert('Could not save report', error instanceof Error ? error.message : 'Local storage failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Someone is missing"
      subtitle="Share what you know. One useful detail is enough."
      onBack={onBack}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <FormSection
        title="Who are you looking for?"
        description="A name or photo helps, but neither is required."
      >
        <FormField label="Name or nickname" placeholder="Enter any name you know" value={name} onChangeText={setName} />
        <FormField
          label="Best estimate of age"
          keyboardType="number-pad"
          placeholder="Example: 22"
          value={age}
          onChangeText={setAge}
        />
        <PhotoField photoUri={photoUri} onChange={setPhotoUri} />
      </FormSection>

      <FormSection title="Where were they last seen?">
        <FormField
          label="Zone or location"
          placeholder="Example: Zone A, Sector 4"
          value={zone}
          onChangeText={setZone}
        />
        <TouchableOpacity
          accessibilityRole="button"
          disabled={locating}
          onPress={() => void captureLastSeenLocation()}
          style={styles.locationButton}
        >
          <Text style={styles.locationButtonText}>{locating ? 'Getting location…' : 'Use this phone’s current location'}</Text>
        </TouchableOpacity>
        <Text style={styles.locationHelp}>Only use this if the person was last seen where you are now.</Text>
        {lastKnownLocation && (
          <View style={styles.locationSaved}>
            <Text style={styles.locationSavedText}>
              Location saved: {lastKnownLocation.lat.toFixed(5)}, {lastKnownLocation.lng.toFixed(5)}
            </Text>
          </View>
        )}
      </FormSection>

      <Disclosure
        label="Add clothing or identifying details"
        expanded={showMore}
        onPress={() => setShowMore((current) => !current)}
      >
        <FormField
          label="Clothing"
          placeholder="Example: Blue shirt, black trousers"
          value={clothing}
          onChangeText={setClothing}
        />
        <FormField
          label="Identifying details or notes"
          multiline
          placeholder="Marks, height, or what happened"
          value={details}
          onChangeText={setDetails}
        />
      </Disclosure>

      <SubmitButton label="Save missing person report" busy={busy} color={colors.missing} onPress={() => void submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  locationButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  locationButtonText: {
    color: colors.primary,
    ...typography.bodyStrong,
  },
  locationHelp: {
    color: colors.muted,
    ...typography.caption,
  },
  locationSaved: {
    backgroundColor: colors.safeTint,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  locationSavedText: {
    color: colors.safe,
    ...typography.caption,
  },
});
