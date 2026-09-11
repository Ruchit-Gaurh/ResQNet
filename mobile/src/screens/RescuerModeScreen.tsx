import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import type { DisasterCase, GeoLocation } from '../../../shared/types/index';
import { Screen } from '../components/Screen';
import { asyncStorageAdapter } from '../services/AsyncStorageAdapters';
import type { LocalQueueService } from '../services/LocalQueueService';
import {
  bearingBetweenDegrees,
  calculateRescueGuidance,
  normalizeAngle,
  smoothCircularDegrees,
  smoothGeoLocation,
  unwrapAngleDegrees,
} from '../services/RescueNavigation';
import { RescueTargetService } from '../services/RescueTargetService';
import type { RescueSignalAction } from '../services/RescueSignal';
import { colors, minimumTouchTarget, radii, spacing, typography } from '../theme';

const DEMO_USERNAME = 'rescue';
const DEMO_PASSWORD = 'rescue';

function targetSubtitle(item: DisasterCase): string {
  const location = item.lastKnownLocation;
  return location?.address ?? location?.zone ?? `${location?.lat.toFixed(5)}, ${location?.lng.toFixed(5)}`;
}

function targetTimeLabel(item: DisasterCase): string | undefined {
  if (!item.lastKnownTime) return undefined;
  const observedAt = new Date(item.lastKnownTime).getTime();
  if (!Number.isFinite(observedAt)) return undefined;
  const ageMinutes = Math.max(0, Math.floor((Date.now() - observedAt) / 60_000));
  if (ageMinutes < 1) return 'Location reported just now';
  if (ageMinutes < 60) return `Location reported ${ageMinutes} min ago`;
  return `Location reported ${Math.floor(ageMinutes / 60)} hr ago`;
}

interface RescuerModeScreenProps {
  backendBaseUrl: string;
  localQueue: LocalQueueService;
  onSendRescueSignal: (
    target: DisasterCase,
    action: RescueSignalAction,
    rescuerLocation?: GeoLocation,
  ) => Promise<{ supported: boolean; sendResult?: { immediateRelay: boolean } }>;
  onBack: () => void;
}

export function RescuerModeScreen({
  backendBaseUrl,
  localQueue,
  onSendRescueSignal,
  onBack,
}: RescuerModeScreenProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [remoteAccess, setRemoteAccess] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string>();
  const [targets, setTargets] = useState<DisasterCase[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [targetError, setTargetError] = useState<string>();
  const [selected, setSelected] = useState<DisasterCase>();
  const [position, setPosition] = useState<GeoLocation>();
  const [heading, setHeading] = useState<number>();
  const [guidanceError, setGuidanceError] = useState<string>();
  const [guiding, setGuiding] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [arrivalSignalStatus, setArrivalSignalStatus] = useState<string>();
  const [confirmingFound, setConfirmingFound] = useState(false);
  const [savingFound, setSavingFound] = useState(false);
  const arrowRotation = useRef(new Animated.Value(0)).current;
  const arrowTarget = useRef(0);
  const signaledArrivalFor = useRef(new Set<string>());
  const acceptedFor = useRef(new Set<string>());
  const lastLocationSignalAt = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const targetService = useRef(new RescueTargetService(asyncStorageAdapter, localQueue)).current;

  async function loadTargets(showLoading = true): Promise<void> {
    if (showLoading) setLoadingTargets(true);
    setTargetError(undefined);
    try {
      const result = await targetService.getTargets(backendBaseUrl);
      setTargets(result.targets);
      setFromCache(result.fromCache);
    } catch {
      setTargets([]);
      setTargetError('Targets could not be downloaded and no offline target list is saved.');
    } finally {
      if (showLoading) setLoadingTargets(false);
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    void loadTargets();
    const timer = setInterval(() => void loadTargets(false), 10_000);
    return () => clearInterval(timer);
  }, [authenticated]);

  useEffect(() => {
    if (!selected || !position || heading === undefined) return;
    const relative = normalizeAngle(bearingBetweenDegrees(position, selected.lastKnownLocation!) - heading);
    const nextRotation = unwrapAngleDegrees(arrowTarget.current, relative);
    arrowTarget.current = nextRotation;
    Animated.timing(arrowRotation, {
      toValue: nextRotation,
      duration: 480,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [arrowRotation, heading, position, selected]);

  useEffect(() => {
    if (!guiding) {
      pulse.stopAnimation();
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [guiding, pulse]);

  useEffect(() => {
    if (!guiding) return;
    let active = true;
    let positionSubscription: Location.LocationSubscription | undefined;
    let headingSubscription: Location.LocationSubscription | undefined;
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location permission is required for rescuer guidance.');
      positionSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1_000, distanceInterval: 1 },
        (update) => {
          if (!active) return;
          const nextPosition: GeoLocation = {
            lat: update.coords.latitude,
            lng: update.coords.longitude,
            accuracyMeters: update.coords.accuracy ?? undefined,
          };
          setPosition((current) => current ? smoothGeoLocation(current, nextPosition) : nextPosition);
        },
      );
      headingSubscription = await Location.watchHeadingAsync((update) => {
        if (!active) return;
        const measuredHeading = update.trueHeading >= 0 ? update.trueHeading : update.magHeading;
        setHeading((current) => current === undefined
          ? measuredHeading
          : smoothCircularDegrees(current, measuredHeading));
      });
    })().catch((error: unknown) => {
      setGuidanceError(error instanceof Error ? error.message : 'Navigation sensors are unavailable.');
      setGuiding(false);
    });
    return () => {
      active = false;
      positionSubscription?.remove();
      headingSubscription?.remove();
    };
  }, [guiding]);

  useEffect(() => {
    if (!guiding || !accepted || !selected || !position) return;
    const firstAcceptance = !acceptedFor.current.has(selected.caseId);
    const now = Date.now();
    if (!firstAcceptance && now - lastLocationSignalAt.current < 8_000) return;
    if (firstAcceptance) acceptedFor.current.add(selected.caseId);
    lastLocationSignalAt.current = now;
    void onSendRescueSignal(selected, firstAcceptance ? 'RESCUE_ACCEPTED' : 'RESCUER_LOCATION', position)
      .catch(() => {
        if (firstAcceptance) acceptedFor.current.delete(selected.caseId);
      });
  }, [accepted, guiding, onSendRescueSignal, position, selected]);

  const target = selected?.lastKnownLocation;
  const guidance = target && position && heading !== undefined
    ? calculateRescueGuidance(position, target, heading)
    : undefined;
  const arrived = guidance?.arrived ?? false;

  useEffect(() => {
    if (!guiding || !arrived || !selected || signaledArrivalFor.current.has(selected.caseId)) return;
    signaledArrivalFor.current.add(selected.caseId);
    setArrivalSignalStatus('Sending a nearby alert to the person’s phone…');
    void onSendRescueSignal(selected, 'RESCUER_NEARBY', position)
      .then((result) => {
        if (!result.supported) {
          setArrivalSignalStatus('This report has no requester device address. Continue visual search.');
        } else if (result.sendResult?.immediateRelay) {
          setArrivalSignalStatus('Nearby alert sent. Listen for the person’s phone.');
        } else {
          setArrivalSignalStatus('Alert queued. It will sound when the requester’s phone is reached.');
        }
      })
      .catch(() => {
        signaledArrivalFor.current.delete(selected.caseId);
        setArrivalSignalStatus('Nearby alert could not be sent. Continue visual search and retry guidance.');
      });
  }, [arrived, guiding, onSendRescueSignal, position, selected]);

  async function confirmPersonFound(): Promise<void> {
    if (!selected || savingFound) return;
    setSavingFound(true);
    try {
      await targetService.markFound(selected.caseId);
      await onSendRescueSignal(selected, 'PERSON_FOUND', position).catch(() => undefined);
      setTargets((current) => current.filter((item) => item.caseId !== selected.caseId));
      setGuiding(false);
      setSelected(undefined);
      setConfirmingFound(false);
      setArrivalSignalStatus(undefined);
    } finally {
      setSavingFound(false);
    }
  }

  if (!authenticated) {
    return (
      <Screen title="Rescuer access" subtitle="Development demonstration access for authorized field teams." onBack={onBack}>
        <View style={styles.notice}><Text style={styles.noticeTitle}>Demo credentials only</Text><Text style={styles.noticeBody}>This local check does not grant administrator privileges or bypass backend access controls.</Text></View>
        <Text style={styles.label}>Username</Text>
        <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setUsername} style={styles.input} value={username} />
        <Text style={styles.label}>Password</Text>
        <TextInput autoCapitalize="none" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
        {loginError && <Text accessibilityRole="alert" style={styles.error}>{loginError}</Text>}
        <TouchableOpacity
          accessibilityRole="button"
          disabled={loginBusy}
          onPress={() => {
            void (async () => {
              if (username !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
                setLoginError('Incorrect demo credentials.');
                return;
              }
              setLoginBusy(true);
              const connected = await targetService.authenticateRescuer(backendBaseUrl, username, password);
              setRemoteAccess(connected);
              setLoginError(connected ? undefined : 'Backend unavailable. Showing only help requests carried by this phone or nearby devices.');
              setAuthenticated(true);
              setLoginBusy(false);
            })();
          }}
          style={styles.primaryButton}
        ><Text style={styles.primaryButtonText}>{loginBusy ? 'Connecting…' : 'Enter rescuer mode'}</Text></TouchableOpacity>
      </Screen>
    );
  }

  if (!selected) {
    return (
      <Screen title="Rescue targets" subtitle="Choose a reported location to begin field guidance." onBack={onBack}>
        <View style={styles.warning}><Text style={styles.warningTitle}>Last reported location</Text><Text style={styles.warningBody}>These coordinates are not a live tracker and do not confirm the person is still there.</Text></View>
        {fromCache && <Text style={styles.cacheLabel}>{remoteAccess ? 'Saved target list' : 'Nearby/offline target list only'}</Text>}
        {loadingTargets ? <ActivityIndicator color={colors.primary} /> : null}
        {targetError ? <Text accessibilityRole="alert" style={styles.error}>{targetError}</Text> : null}
        {!loadingTargets && targets.length === 0 && !targetError ? <Text style={styles.empty}>No missing-person cases with usable coordinates are available.</Text> : null}
        <View style={styles.targetList}>
          {targets.map((item) => (
            <TouchableOpacity
              key={item.caseId}
              onPress={() => {
                arrowTarget.current = 0;
                arrowRotation.setValue(0);
                setArrivalSignalStatus(undefined);
                setConfirmingFound(false);
                setAccepted(false);
                setGuiding(false);
                setSelected(item);
              }}
              style={styles.targetCard}
            >
              <View style={styles.targetCopy}>
                {item.caseId.startsWith('EMERGENCY-') ? <Text style={styles.emergencyLabel}>URGENT HELP REQUEST</Text> : null}
                <Text numberOfLines={1} style={styles.targetName}>{item.person.name}</Text>
                <Text numberOfLines={2} style={styles.targetLocation}>{targetSubtitle(item)}</Text>
                {targetTimeLabel(item) ? <Text style={styles.targetTime}>{targetTimeLabel(item)}</Text> : null}
              </View>
              <Text style={styles.targetAction}>Guide ›</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity disabled={loadingTargets} onPress={() => void loadTargets()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Refresh targets</Text></TouchableOpacity>
      </Screen>
    );
  }

  const distance = guidance?.distanceMeters;
  const bearing = guidance?.bearing;
  const direction = guidance?.direction ?? (guiding ? 'Finding direction…' : 'Ready to guide');

  return (
    <Screen title="Field guidance" subtitle={`Toward ${selected.person.name}`} onBack={() => { setGuiding(false); setSelected(undefined); }}>
      <View style={[styles.guidancePanel, arrived ? styles.arrivedPanel : null]}>
        <Animated.View style={[styles.pulseRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.35] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] }]} />
        <Animated.View style={[styles.navigationArrow, { transform: [{ rotate: arrowRotation.interpolate({ inputRange: [-360, 0, 360], outputRange: ['-360deg', '0deg', '360deg'], extrapolate: 'extend' }) }] }]}>
          <View style={styles.arrowTip} />
          <View style={styles.arrowStem} />
        </Animated.View>
        <Text accessibilityLiveRegion="polite" style={styles.direction}>{direction}</Text>
        <Text style={styles.distance}>{distance === undefined ? 'Waiting for GPS' : distance < 1_000 ? `${Math.round(distance)} m away` : `${(distance / 1_000).toFixed(1)} km away`}</Text>
      </View>

      <View style={styles.readout}>
        <View><Text style={styles.readoutLabel}>GPS accuracy</Text><Text style={styles.readoutValue}>{position?.accuracyMeters ? `±${Math.round(position.accuracyMeters)} m` : 'Waiting'}</Text></View>
        <View><Text style={styles.readoutLabel}>Target bearing</Text><Text style={styles.readoutValue}>{bearing === undefined ? 'Waiting' : `${Math.round(bearing)}°`}</Text></View>
      </View>
      <Text style={styles.calibration}>Hold the phone level. If the arrow drifts, move it in a figure-eight to recalibrate the compass. Continue visual search on arrival.</Text>
      {guidanceError && <Text accessibilityRole="alert" style={styles.error}>{guidanceError}</Text>}
      {arrived ? (
        <View style={styles.arrivalActions}>
          <Text style={styles.arrivalTitle}>You are inside the reported target area</Text>
          <Text accessibilityLiveRegion="polite" style={styles.arrivalBody}>
            {arrivalSignalStatus ?? 'ResQNet is preparing a nearby alert. Continue visual and voice search.'}
          </Text>
          {!confirmingFound ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => setConfirmingFound(true)} style={styles.foundButton}>
              <Text style={styles.foundButtonText}>I found this person</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.confirmArea}>
              <Text style={styles.confirmText}>Confirm only after you have made visual contact. This removes the target from this device’s guide list.</Text>
              <TouchableOpacity disabled={savingFound} onPress={() => void confirmPersonFound()} style={styles.confirmFoundButton}>
                <Text style={styles.foundButtonText}>{savingFound ? 'Saving…' : 'Confirm person found'}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={savingFound} onPress={() => setConfirmingFound(false)} style={styles.notYetButton}>
                <Text style={styles.notYetText}>Not yet, keep searching</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}
      <TouchableOpacity onPress={() => {
        setGuidanceError(undefined);
        if (!accepted) {
          setAccepted(true);
          setGuiding(true);
        } else {
          setGuiding((value) => !value);
        }
      }} style={[styles.primaryButton, guiding ? styles.stopButton : null]}>
        <Text style={styles.primaryButtonText}>{guiding ? 'Pause guidance' : accepted ? 'Resume guidance' : 'Accept request & start guidance'}</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { backgroundColor: colors.infoTint, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg },
  noticeTitle: { color: colors.primary, ...typography.bodyStrong },
  noticeBody: { color: colors.text, ...typography.caption, marginTop: spacing.xxs },
  warning: { backgroundColor: colors.warningTint, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md },
  warningTitle: { color: colors.warning, ...typography.bodyStrong },
  warningBody: { color: colors.text, ...typography.caption, marginTop: spacing.xxs },
  label: { color: colors.textStrong, ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, ...typography.body },
  error: { color: colors.danger, ...typography.caption, marginTop: spacing.md },
  primaryButton: { minHeight: 56, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.md },
  stopButton: { backgroundColor: colors.danger },
  primaryButtonText: { color: colors.onAccent, ...typography.button },
  secondaryButton: { minHeight: minimumTouchTarget, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  secondaryButtonText: { color: colors.primary, ...typography.bodyStrong },
  cacheLabel: { color: colors.warning, ...typography.caption, fontWeight: '700', marginBottom: spacing.sm },
  empty: { color: colors.muted, ...typography.body, textAlign: 'center', paddingVertical: spacing.xxxl },
  targetList: { gap: spacing.sm },
  targetCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: spacing.md },
  targetCopy: { flex: 1, minWidth: 0 },
  emergencyLabel: { color: colors.danger, fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 0.5 },
  targetName: { color: colors.textStrong, ...typography.bodyStrong },
  targetLocation: { color: colors.muted, ...typography.caption, marginTop: spacing.xxs },
  targetTime: { color: colors.warning, fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: spacing.xxs },
  targetAction: { color: colors.primary, ...typography.label, marginLeft: spacing.sm },
  guidancePanel: { minHeight: 330, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radii.xl, backgroundColor: colors.primary, padding: spacing.xl },
  arrivedPanel: { backgroundColor: colors.safe },
  pulseRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: colors.onAccent },
  navigationArrow: { width: 88, height: 142, alignItems: 'center', justifyContent: 'center' },
  arrowTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 38,
    borderRightWidth: 38,
    borderBottomWidth: 76,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.onAccent,
  },
  arrowStem: { width: 22, height: 48, marginTop: -4, borderRadius: 11, backgroundColor: colors.onAccent },
  direction: { color: colors.onAccent, fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  distance: { color: colors.onAccent, fontSize: 17, lineHeight: 23, marginTop: spacing.xs },
  readout: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.lg },
  readoutLabel: { color: colors.muted, ...typography.caption },
  readoutValue: { color: colors.textStrong, ...typography.bodyStrong, marginTop: spacing.xxs },
  calibration: { color: colors.muted, ...typography.caption, marginTop: spacing.md },
  arrivalActions: {
    borderWidth: 1,
    borderColor: colors.safe,
    borderRadius: radii.lg,
    backgroundColor: colors.safeTint,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  arrivalTitle: { color: colors.textStrong, ...typography.bodyStrong },
  arrivalBody: { color: colors.text, ...typography.caption, marginTop: spacing.xs },
  foundButton: { minHeight: 52, borderRadius: radii.md, backgroundColor: colors.safe, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  foundButtonText: { color: colors.onAccent, ...typography.button },
  confirmArea: { marginTop: spacing.md },
  confirmText: { color: colors.text, ...typography.caption },
  confirmFoundButton: { minHeight: 52, borderRadius: radii.md, backgroundColor: colors.safe, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  notYetButton: { minHeight: minimumTouchTarget, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  notYetText: { color: colors.primary, ...typography.bodyStrong },
});
