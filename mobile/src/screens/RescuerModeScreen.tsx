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
  bluetoothApproachGuidance,
  calculateRescueGuidance,
  isGpsBearingReliable,
  normalizeAngle,
  smoothCircularDegrees,
  smoothMovingLocation,
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
  getBluetoothProximity: (target: DisasterCase) => { rssi: number; lastSeenAt: number } | undefined;
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
  getBluetoothProximity,
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
  const [movementHeading, setMovementHeading] = useState<{ value: number; observedAt: number }>();
  const [guidanceError, setGuidanceError] = useState<string>();
  const [guiding, setGuiding] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [arrivalSignalStatus, setArrivalSignalStatus] = useState<string>();
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertRequested, setAlertRequested] = useState(false);
  const [confirmingFound, setConfirmingFound] = useState(false);
  const [savingFound, setSavingFound] = useState(false);
  const [bluetoothProximity, setBluetoothProximity] = useState<{ rssi: number; lastSeenAt: number }>();
  const [bluetoothTrend, setBluetoothTrend] = useState<'STRONGER' | 'STEADY' | 'WEAKER'>('STEADY');
  const arrowRotation = useRef(new Animated.Value(0)).current;
  const arrowTarget = useRef(0);
  const stableTargetBearing = useRef<number | undefined>(undefined);
  const acceptedFor = useRef(new Set<string>());
  const lastLocationSignalAt = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const previousBluetoothRssi = useRef<number | undefined>(undefined);
  const targetService = useRef(new RescueTargetService(asyncStorageAdapter, localQueue)).current;

  async function loadTargets(showLoading = true): Promise<void> {
    if (showLoading) setLoadingTargets(true);
    setTargetError(undefined);
    try {
      const result = await targetService.getTargets(backendBaseUrl);
      setTargets(result.targets);
      setSelected((current) => current
        ? result.targets.find((item) => item.caseId === current.caseId) ?? current
        : current);
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
    const timer = setInterval(() => void loadTargets(false), 2_000);
    return () => clearInterval(timer);
  }, [authenticated]);

  useEffect(() => {
    const navigationHeading = movementHeading && Date.now() - movementHeading.observedAt <= 5_000
      ? movementHeading.value
      : heading;
    if (!selected || !position || navigationHeading === undefined) return;
    const targetLocation = selected.lastKnownLocation!;
    const measuredBearing = bearingBetweenDegrees(position, targetLocation);
    const measuredDistance = calculateRescueGuidance(position, targetLocation, navigationHeading).distanceMeters;
    const reliable = isGpsBearingReliable(
      measuredDistance,
      position.accuracyMeters,
      targetLocation.accuracyMeters,
    );
    if (stableTargetBearing.current === undefined) {
      stableTargetBearing.current = measuredBearing;
    } else if (reliable) {
      stableTargetBearing.current = smoothCircularDegrees(stableTargetBearing.current, measuredBearing, 0.3);
    }
    // Inside the uncertainty zone, retain the last trustworthy absolute
    // bearing while still rotating it against the live compass heading. This
    // prevents a noisy GPS point from flipping the arrow by 180 degrees.
    const relative = normalizeAngle(stableTargetBearing.current - navigationHeading);
    const nextRotation = unwrapAngleDegrees(arrowTarget.current, relative);
    arrowTarget.current = nextRotation;
    Animated.timing(arrowRotation, {
      toValue: nextRotation,
      duration: 480,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [arrowRotation, heading, movementHeading, position, selected]);

  useEffect(() => {
    if (!guiding || !selected) {
      setBluetoothProximity(undefined);
      setBluetoothTrend('STEADY');
      previousBluetoothRssi.current = undefined;
      return;
    }
    const refresh = () => {
      const next = getBluetoothProximity(selected);
      if (next && previousBluetoothRssi.current !== undefined) {
        const change = next.rssi - previousBluetoothRssi.current;
        setBluetoothTrend(change >= 2.5 ? 'STRONGER' : change <= -2.5 ? 'WEAKER' : 'STEADY');
      }
      if (next) previousBluetoothRssi.current = next.rssi;
      setBluetoothProximity(next);
    };
    refresh();
    const timer = setInterval(refresh, 1_500);
    return () => clearInterval(timer);
  }, [getBluetoothProximity, guiding, selected]);

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
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 500, distanceInterval: 0 },
        (update) => {
          if (!active) return;
          const nextPosition: GeoLocation = {
            lat: update.coords.latitude,
            lng: update.coords.longitude,
            accuracyMeters: update.coords.accuracy ?? undefined,
          };
          setPosition((current) => current ? smoothMovingLocation(current, nextPosition) : nextPosition);
          if (
            typeof update.coords.heading === 'number'
            && update.coords.heading >= 0
            && typeof update.coords.speed === 'number'
            && update.coords.speed >= 0.6
          ) {
            setMovementHeading((current) => ({
              value: current
                ? smoothCircularDegrees(current.value, update.coords.heading!, 0.35)
                : update.coords.heading!,
              observedAt: Date.now(),
            }));
          }
        },
      );
      headingSubscription = await Location.watchHeadingAsync((update) => {
        if (!active) return;
        const measuredHeading = update.trueHeading >= 0 ? update.trueHeading : update.magHeading;
        setHeading((current) => {
          // Ignore an uncalibrated replacement after a usable heading exists.
          if (update.accuracy === 0 && current !== undefined) return current;
          return current === undefined
            ? measuredHeading
            : smoothCircularDegrees(current, measuredHeading, update.accuracy >= 2 ? 0.3 : 0.12);
        });
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
    if (!firstAcceptance && now - lastLocationSignalAt.current < 3_000) return;
    if (firstAcceptance) acceptedFor.current.add(selected.caseId);
    lastLocationSignalAt.current = now;
    void onSendRescueSignal(selected, firstAcceptance ? 'RESCUE_ACCEPTED' : 'RESCUER_LOCATION', position)
      .catch(() => {
        if (firstAcceptance) acceptedFor.current.delete(selected.caseId);
      });
  }, [accepted, guiding, onSendRescueSignal, position, selected]);

  const target = selected?.lastKnownLocation;
  const activeHeading = movementHeading && Date.now() - movementHeading.observedAt <= 5_000
    ? movementHeading.value
    : heading;
  const guidance = target && position && activeHeading !== undefined
    ? calculateRescueGuidance(position, target, activeHeading)
    : undefined;
  const arrived = guidance?.arrived ?? false;
  const targetInBluetoothRange = Boolean(
    bluetoothProximity && Date.now() - bluetoothProximity.lastSeenAt <= 12_000,
  );
  const bluetoothGuidance = targetInBluetoothRange && bluetoothProximity
    ? bluetoothApproachGuidance(bluetoothProximity.rssi)
    : undefined;
  const gpsBearingReliable = Boolean(
    guidance
    && isGpsBearingReliable(
      guidance.distanceMeters,
      position?.accuracyMeters,
      target?.accuracyMeters,
    ),
  );
  const bluetoothPrecisionSearch = Boolean(
    bluetoothGuidance && bluetoothProximity && bluetoothProximity.rssi >= -72,
  );
  const precisionSearch = guiding && (!gpsBearingReliable || bluetoothPrecisionSearch);
  const canUseArrivalActions = arrived || targetInBluetoothRange;

  async function requestTargetAlert(): Promise<void> {
    if (!selected || sendingAlert || alertRequested) return;
    setSendingAlert(true);
    setArrivalSignalStatus('Requesting an alert on the person’s phone…');
    try {
      const result = await onSendRescueSignal(selected, 'RESCUER_NEARBY', position);
      if (!result.supported) {
        setArrivalSignalStatus('This request has no return address. Continue visual and voice search.');
        return;
      }
      setAlertRequested(true);
      setArrivalSignalStatus(result.sendResult?.immediateRelay
        ? 'Alert reached a nearby device. Listen for the person’s phone.'
        : 'Alert request saved. It will travel through Bluetooth or the disaster network.');
    } catch {
      setArrivalSignalStatus('The alert could not be queued. Check the connection and try again.');
    } finally {
      setSendingAlert(false);
    }
  }

  async function confirmPersonFound(): Promise<void> {
    if (!selected || savingFound) return;
    setSavingFound(true);
    try {
      await targetService.markFound(selected.caseId);
      await onSendRescueSignal(selected, 'PERSON_FOUND').catch(() => undefined);
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
                stableTargetBearing.current = undefined;
                arrowRotation.setValue(0);
                setArrivalSignalStatus(undefined);
                setAlertRequested(false);
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
  const direction = precisionSearch
    ? bluetoothGuidance
      ? bluetoothTrend === 'STRONGER'
        ? 'Signal getting stronger'
        : bluetoothTrend === 'WEAKER'
          ? 'Signal getting weaker'
          : 'Bluetooth precision search'
      : 'GPS direction is uncertain'
    : guidance?.direction ?? (guiding ? 'Finding direction…' : 'Ready to guide');

  return (
    <Screen title="Field guidance" subtitle={`Toward ${selected.person.name}`} onBack={() => { setGuiding(false); setSelected(undefined); }}>
      <View style={[styles.guidancePanel, arrived ? styles.arrivedPanel : precisionSearch ? styles.precisionPanel : null]}>
        <Animated.View style={[styles.pulseRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.35] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] }]} />
        {precisionSearch ? (
          <View accessibilityLabel="Bluetooth proximity indicator" style={styles.proximityTarget}>
            <View style={styles.proximityOuter}>
              <View style={styles.proximityMiddle}>
                <View style={styles.proximityCore} />
              </View>
            </View>
          </View>
        ) : null}
        <Animated.View style={[styles.navigationArrow, precisionSearch ? styles.navigationArrowApproximate : null, { transform: [{ rotate: arrowRotation.interpolate({ inputRange: [-360, 0, 360], outputRange: ['-360deg', '0deg', '360deg'], extrapolate: 'extend' }) }] }]}>
          <View style={styles.arrowTip} />
          <View style={styles.arrowStem} />
        </Animated.View>
        <Text accessibilityLiveRegion="polite" style={styles.direction}>{direction}</Text>
        <Text style={styles.distance}>{distance === undefined ? 'Waiting for GPS' : distance < 1_000 ? `About ${Math.round(distance)} m away` : `About ${(distance / 1_000).toFixed(1)} km away`}</Text>
        {precisionSearch ? <Text style={styles.precisionHint}>Arrow is approximate here. Walk a few steps, watch signal strength, then use the phone alert.</Text> : null}
      </View>

      <View style={styles.readout}>
        <View><Text style={styles.readoutLabel}>GPS accuracy</Text><Text style={styles.readoutValue}>{position?.accuracyMeters ? `±${Math.round(position.accuracyMeters)} m` : 'Waiting'}</Text></View>
        <View><Text style={styles.readoutLabel}>Direction confidence</Text><Text style={styles.readoutValue}>{bearing === undefined ? 'Waiting' : gpsBearingReliable ? 'GPS reliable' : 'Precision search'}</Text></View>
      </View>
      {bluetoothGuidance ? (
        <View accessibilityLiveRegion="polite" style={styles.bluetoothPanel}>
          <Text style={styles.bluetoothTitle}>{bluetoothGuidance.label}</Text>
          <Text style={styles.bluetoothBody}>{bluetoothGuidance.detail}</Text>
          <Text style={styles.bluetoothDiagnostic}>Signal {Math.round(bluetoothProximity!.rssi)} dBm · {bluetoothTrend.toLowerCase()} · direct phone detection</Text>
        </View>
      ) : null}
      <Text style={styles.calibration}>Hold the phone level. If the arrow drifts, move it in a figure-eight to recalibrate the compass. Continue visual search on arrival.</Text>
      {guidanceError && <Text accessibilityRole="alert" style={styles.error}>{guidanceError}</Text>}
      {canUseArrivalActions ? (
        <View style={styles.arrivalActions}>
          <Text style={styles.arrivalTitle}>{arrived ? 'You are inside the reported target area' : 'The target phone is within Bluetooth range'}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.arrivalBody}>
            {arrivalSignalStatus ?? 'You are close enough to request a loud alert from the person’s phone.'}
          </Text>
          <TouchableOpacity
            accessibilityHint="Sends a request that makes the target phone ring and vibrate until you confirm the person is found"
            accessibilityRole="button"
            disabled={sendingAlert || alertRequested}
            onPress={() => void requestTargetAlert()}
            style={[styles.alertButton, alertRequested ? styles.alertButtonDone : null]}
          >
            <Text style={styles.foundButtonText}>
              {sendingAlert ? 'Sending alert…' : alertRequested ? 'Phone alert requested' : 'Make target phone ring'}
            </Text>
          </TouchableOpacity>
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
  precisionPanel: { backgroundColor: colors.info },
  pulseRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: colors.onAccent },
  navigationArrow: { width: 88, height: 142, alignItems: 'center', justifyContent: 'center' },
  navigationArrowApproximate: { opacity: 0.82 },
  proximityTarget: { position: 'absolute', top: 70, width: 142, height: 142, alignItems: 'center', justifyContent: 'center' },
  proximityOuter: { width: 132, height: 132, borderRadius: 66, borderWidth: 2, borderColor: colors.onAccent, alignItems: 'center', justifyContent: 'center', opacity: 0.86 },
  proximityMiddle: { width: 82, height: 82, borderRadius: 41, borderWidth: 2, borderColor: colors.onAccent, alignItems: 'center', justifyContent: 'center' },
  proximityCore: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.onAccent },
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
  precisionHint: { color: colors.onAccent, ...typography.caption, opacity: 0.9, textAlign: 'center', marginTop: spacing.sm, maxWidth: 260 },
  readout: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.lg },
  readoutLabel: { color: colors.muted, ...typography.caption },
  readoutValue: { color: colors.textStrong, ...typography.bodyStrong, marginTop: spacing.xxs },
  calibration: { color: colors.muted, ...typography.caption, marginTop: spacing.md },
  bluetoothPanel: { borderRadius: radii.md, backgroundColor: colors.infoTint, padding: spacing.md, marginTop: spacing.md },
  bluetoothTitle: { color: colors.primary, ...typography.bodyStrong },
  bluetoothBody: { color: colors.text, ...typography.caption, marginTop: spacing.xxs },
  bluetoothDiagnostic: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
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
  alertButton: { minHeight: 56, borderRadius: radii.md, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, paddingHorizontal: spacing.md },
  alertButtonDone: { backgroundColor: colors.primary },
  foundButtonText: { color: colors.onAccent, ...typography.button },
  confirmArea: { marginTop: spacing.md },
  confirmText: { color: colors.text, ...typography.caption },
  confirmFoundButton: { minHeight: 52, borderRadius: radii.md, backgroundColor: colors.safe, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  notYetButton: { minHeight: minimumTouchTarget, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  notYetText: { color: colors.primary, ...typography.bodyStrong },
});
