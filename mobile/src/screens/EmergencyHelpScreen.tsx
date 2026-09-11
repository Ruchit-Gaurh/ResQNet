import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';

import { FormField } from '../components/FormField';
import { FormSection } from '../components/FormSection';
import { Screen } from '../components/Screen';
import { SubmitButton } from '../components/SubmitButton';
import type { ReportSubmissionService, SubmissionResult } from '../services/ReportSubmissionService';
import { bearingBetweenDegrees, distanceBetweenMeters } from '../services/RescueNavigation';
import type { HelpRescueStatus } from '../services/RescueSignal';
import type { GeoLocation } from '../../../shared/types/index';
import { colors, radii, spacing, typography } from '../theme';

interface EmergencyHelpScreenProps {
  demoOffline: boolean;
  submissions: ReportSubmissionService;
  onBack: () => void;
  onSaved: () => void;
  loadHelpStatus: (requestId: string) => Promise<HelpRescueStatus | undefined>;
}

interface HelpLocation {
  position: Location.LocationObject;
  source: 'CURRENT' | 'RECENT_LAST_KNOWN';
}

async function readHelpLocation(): Promise<HelpLocation> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('Turn on Location in Android settings, then try again.');
  }

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('Current location lookup timed out.')), 12_000);
      }),
    ]);
    return { position, source: 'CURRENT' };
  } catch (currentError) {
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 10 * 60_000,
      requiredAccuracy: 500,
    });
    if (lastKnown) return { position: lastKnown, source: 'RECENT_LAST_KNOWN' };
    throw currentError;
  }
}

function deliveryMessage(result: SubmissionResult): string {
  if (result.deliveryState === 'RELAYING') {
    return 'Saved on this phone and sharing through nearby devices. Waiting for the disaster network.';
  }
  return 'Saved on this phone. ResQNet will share it when a nearby device or internet path becomes available.';
}

export function EmergencyHelpScreen({
  demoOffline,
  submissions,
  onBack,
  onSaved,
  loadHelpStatus,
}: EmergencyHelpScreenProps) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmissionResult>();
  const [requestLocation, setRequestLocation] = useState<GeoLocation>();
  const [rescueStatus, setRescueStatus] = useState<HelpRescueStatus>();

  useEffect(() => {
    const requestId = result?.referenceId;
    if (!requestId) return;
    let active = true;
    const refresh = () => {
      void loadHelpStatus(requestId).then((status) => {
        if (active && status) setRescueStatus(status);
      });
    };
    refresh();
    const timer = setInterval(refresh, 5_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadHelpStatus, result?.referenceId]);

  async function requestHelp(): Promise<void> {
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Location permission is required',
          'ResQNet cannot guide a rescuer to you without your location. Permission was not granted and no help request was sent.',
        );
        return;
      }
      const { position, source } = await readHelpLocation();
      const submission = await submissions.submitEmergencyHelp({
        requesterName: name,
        note,
        location: {
          lat: Math.round(position.coords.latitude * 1_000_000) / 1_000_000,
          lng: Math.round(position.coords.longitude * 1_000_000) / 1_000_000,
          accuracyMeters: position.coords.accuracy ?? undefined,
        },
        locationObservedAt: position.timestamp,
        locationSource: source,
      });
      setRequestLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyMeters: position.coords.accuracy ?? undefined,
      });
      setResult(submission);
      onSaved();
    } catch (error) {
      Alert.alert(
        'Help request not sent',
        error instanceof Error
          ? error.message
          : 'ResQNet could not determine your location. Nothing was submitted.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const rescuerLocation = rescueStatus?.rescuerLocation;
    const distance = requestLocation && rescuerLocation
      ? distanceBetweenMeters(requestLocation, rescuerLocation)
      : undefined;
    const bearing = requestLocation && rescuerLocation
      ? bearingBetweenDegrees(requestLocation, rescuerLocation)
      : 0;
    const markerRadius = Math.min(104, Math.max(12, (distance ?? 0) / 3));
    const angle = bearing * Math.PI / 180;
    const markerStyle = {
      left: 122 + Math.sin(angle) * markerRadius,
      top: 122 - Math.cos(angle) * markerRadius,
    };
    return (
      <Screen title="Help request saved" subtitle="Keep this phone with you if it is safe to do so." onBack={onBack}>
        <View style={styles.savedPanel}>
          <Text style={styles.savedIcon}>✓</Text>
          <Text accessibilityLiveRegion="polite" style={styles.savedTitle}>Your location is ready to be carried onward</Text>
          <Text style={styles.savedBody}>{deliveryMessage(result)}</Text>
        </View>
        <View style={styles.statusList}>
          <Text style={styles.statusDone}>1  Saved securely on this phone</Text>
          <Text style={result.deliveryState === 'RELAYING' ? styles.statusDone : styles.statusPending}>
            2  {result.deliveryState === 'RELAYING' ? 'Sharing with a nearby device' : 'Waiting for a nearby device'}
          </Text>
          <Text style={styles.statusPending}>3  Waiting for confirmed server receipt</Text>
        </View>
        {rescueStatus?.status === 'PERSON_FOUND' ? (
          <View style={styles.rescuerUpdate}>
            <Text style={styles.rescuerUpdateTitle}>Rescuer confirmed contact</Text>
            <Text style={styles.rescuerUpdateBody}>The nearby alert has stopped. Follow the rescuer’s instructions.</Text>
          </View>
        ) : rescueStatus?.rescuerNodeId ? (
          <View style={styles.rescuerUpdate}>
            <Text style={styles.rescuerUpdateTitle}>
              {rescueStatus.status === 'RESCUER_NEARBY' ? 'Rescuer is in the target area' : 'A rescuer accepted your request'}
            </Text>
            {rescuerLocation ? (
              <>
                <View accessibilityLabel="Live map showing the rescuer relative to your location" style={styles.liveMap}>
                  <View style={styles.mapRingOuter} />
                  <View style={styles.mapRingInner} />
                  <View style={styles.personMarker}><Text style={styles.markerText}>YOU</Text></View>
                  <View style={[styles.rescuerMarker, markerStyle]}><Text style={styles.rescuerMarkerText}>R</Text></View>
                  <Text style={styles.mapNorth}>N</Text>
                </View>
                <Text style={styles.rescuerDistance}>{distance === undefined ? 'Locating rescuer…' : `${Math.round(distance)} m away`}</Text>
                <Text style={styles.rescuerUpdateBody}>Live location updates while the rescuer is guiding. The map is approximate—stay where it is safe.</Text>
              </>
            ) : <Text style={styles.rescuerUpdateBody}>Waiting for the rescuer’s next location update.</Text>}
          </View>
        ) : null}
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.homeButton}>
          <Text style={styles.homeButtonText}>Return home</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  return (
    <Screen title="Need urgent help?" subtitle="Share your current location so a rescuer can navigate toward you." onBack={onBack}>
      <View style={styles.urgentPanel}>
        <Text style={styles.urgentTitle}>Use this only when you need rescue assistance</Text>
        <Text style={styles.urgentBody}>
          Your request is saved on this phone first. Without internet, nearby ResQNet phones can carry it toward responders and the disaster network.
        </Text>
      </View>

      <FormSection title="Optional details" description="Location is the only required information.">
        <FormField label="Your name" placeholder="Optional" value={name} onChangeText={setName} />
        <FormField
          label="What help do you need?"
          multiline
          placeholder="Example: Trapped on the second floor"
          value={note}
          onChangeText={setNote}
        />
      </FormSection>

      <View style={styles.consentPanel}>
        <Text style={styles.consentTitle}>Location sharing consent</Text>
        <Text style={styles.consentBody}>
          By pressing the button below, you agree to share this phone’s current location—or its most recent location from the last ten minutes if GPS cannot update—and its accuracy and observation time with nearby ResQNet devices and authorized responders for rescue coordination.
        </Text>
        <Text style={styles.consentBody}>
          {demoOffline
            ? 'Demo offline mode is on: internet upload is paused, but nearby Bluetooth sharing remains active.'
            : 'If internet is unavailable, the request remains queued and can travel through the nearby device network.'}
        </Text>
      </View>

      <SubmitButton
        label="Share my location & request help"
        busy={busy}
        color={colors.danger}
        onPress={() => void requestHelp()}
      />
      <Text style={styles.safetyNote}>If calling emergency services is possible, do that as well. ResQNet is an additional coordination channel.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  urgentPanel: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    backgroundColor: colors.dangerTint,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  urgentTitle: { color: colors.danger, ...typography.bodyStrong },
  urgentBody: { color: colors.text, ...typography.body, marginTop: spacing.xs },
  consentPanel: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  consentTitle: { color: colors.textStrong, ...typography.bodyStrong },
  consentBody: { color: colors.text, ...typography.caption, marginTop: spacing.xs },
  safetyNote: { color: colors.muted, ...typography.caption, textAlign: 'center', marginTop: spacing.md },
  savedPanel: {
    alignItems: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.safeTint,
    padding: spacing.xl,
  },
  savedIcon: { color: colors.safe, fontSize: 52, lineHeight: 58, fontWeight: '900' },
  savedTitle: { color: colors.textStrong, fontSize: 21, lineHeight: 27, fontWeight: '800', textAlign: 'center', marginTop: spacing.sm },
  savedBody: { color: colors.text, ...typography.body, textAlign: 'center', marginTop: spacing.sm },
  statusList: { gap: spacing.md, marginTop: spacing.xl },
  statusDone: { color: colors.safe, ...typography.bodyStrong },
  statusPending: { color: colors.muted, ...typography.bodyStrong },
  homeButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xl,
  },
  homeButtonText: { color: colors.onAccent, ...typography.button },
  rescuerUpdate: { borderWidth: 1, borderColor: colors.primary, borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.xl, backgroundColor: colors.infoTint },
  rescuerUpdateTitle: { color: colors.textStrong, ...typography.bodyStrong, textAlign: 'center' },
  rescuerUpdateBody: { color: colors.text, ...typography.caption, textAlign: 'center', marginTop: spacing.sm },
  liveMap: { width: 268, height: 268, alignSelf: 'center', borderRadius: 134, marginTop: spacing.md, backgroundColor: colors.surface, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderStrong },
  mapRingOuter: { position: 'absolute', width: 210, height: 210, borderRadius: 105, left: 29, top: 29, borderWidth: 1, borderColor: colors.border },
  mapRingInner: { position: 'absolute', width: 112, height: 112, borderRadius: 56, left: 78, top: 78, borderWidth: 1, borderColor: colors.border },
  personMarker: { position: 'absolute', left: 108, top: 108, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
  markerText: { color: colors.onAccent, fontSize: 10, fontWeight: '900' },
  rescuerMarker: { position: 'absolute', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  rescuerMarkerText: { color: colors.onAccent, fontSize: 12, fontWeight: '900' },
  mapNorth: { position: 'absolute', alignSelf: 'center', top: 8, color: colors.muted, fontSize: 11, fontWeight: '800' },
  rescuerDistance: { color: colors.primary, fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center', marginTop: spacing.sm },
});
