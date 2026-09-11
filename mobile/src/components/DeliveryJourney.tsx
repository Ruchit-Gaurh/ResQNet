import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { MobileMeshActivity } from '../services/createMobileServices';
import { colors, radii, spacing, typography } from '../theme';

interface DeliveryJourneyProps {
  activity: MobileMeshActivity;
  demoOffline: boolean;
}

const STEPS = [
  { label: 'This phone', caption: 'Saved first' },
  { label: 'Nearby devices', caption: 'Carried onward' },
  { label: 'Disaster network', caption: 'Confirmed receipt' },
] as const;

function activityMessage(activity: MobileMeshActivity, demoOffline: boolean): string {
  const peers = activity.connectedPeerIds.length;
  if (demoOffline && peers > 0) {
    return `Internet sync is paused here. ${peers} nearby device${peers === 1 ? '' : 's'} can still carry reports onward.`;
  }
  if (demoOffline) {
    return 'Internet sync is paused here. New reports stay safe on this phone until a nearby device or internet path is available.';
  }
  if (activity.queuedCount > 0 && peers > 0) {
    return `${activity.queuedCount} report${activity.queuedCount === 1 ? '' : 's'} waiting while ${peers} nearby device${peers === 1 ? '' : 's'} help relay information.`;
  }
  if (activity.queuedCount > 0) {
    return `${activity.queuedCount} report${activity.queuedCount === 1 ? '' : 's'} saved safely and waiting for a connection.`;
  }
  if (activity.gatewayState === 'ACKNOWLEDGED') {
    return 'Saved reports are up to date with the disaster coordination network.';
  }
  if (peers > 0) {
    return `${peers} nearby ResQNet device${peers === 1 ? ' is' : 's are'} ready to help carry reports.`;
  }
  return 'ResQNet is ready. Every new report will be saved on this phone before sharing starts.';
}

export function DeliveryJourney({ activity, demoOffline }: DeliveryJourneyProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const activeStep = activity.gatewayState === 'ACKNOWLEDGED' && !demoOffline
    ? 2
    : activity.connectedPeerIds.length > 0 || activity.peerReceiptCount > 0 || activity.relayedCount > 0
      ? 1
      : 0;
  const message = useMemo(() => activityMessage(activity, demoOffline), [activity, demoOffline]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
      { iterations: 3 },
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion]);

  const activeAnimation = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }) }],
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.liveDot} />
        <Text accessibilityRole="header" style={styles.heading}>What is happening now</Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>

      <View style={styles.steps}>
        {STEPS.map((step, index) => {
          const reached = index <= activeStep;
          const circle = (
            <View style={[styles.stepCircle, reached ? styles.stepCircleReached : null]}>
              <Text style={[styles.stepNumber, reached ? styles.stepNumberReached : null]}>{index + 1}</Text>
            </View>
          );
          return (
            <View key={step.label} style={styles.stepSegment}>
              <View style={styles.stepTopRow}>
                {index === activeStep ? <Animated.View style={activeAnimation}>{circle}</Animated.View> : circle}
                {index < STEPS.length - 1 ? (
                  <View style={[styles.connector, index < activeStep ? styles.connectorReached : null]} />
                ) : null}
              </View>
              <Text style={[styles.stepLabel, reached ? styles.stepLabelReached : null]}>{step.label}</Text>
              <Text style={styles.stepCaption}>{step.caption}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.metrics}>
        <Text style={styles.metric}><Text style={styles.metricValue}>{activity.connectedPeerIds.length}</Text> connected</Text>
        <Text style={styles.metric}><Text style={styles.metricValue}>{activity.queuedCount}</Text> waiting</Text>
        <Text style={styles.metric}><Text style={styles.metricValue}>{activity.receivedCount}</Text> received</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.safe,
    marginRight: spacing.xs,
  },
  heading: {
    color: colors.textStrong,
    ...typography.bodyStrong,
  },
  message: {
    color: colors.muted,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  steps: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  stepSegment: {
    flex: 1,
    minWidth: 0,
  },
  stepTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  stepCircleReached: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepNumber: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  stepNumberReached: {
    color: colors.onAccent,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  connectorReached: {
    backgroundColor: colors.primary,
  },
  stepLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: spacing.xs,
    paddingRight: spacing.xs,
  },
  stepLabelReached: {
    color: colors.textStrong,
  },
  stepCaption: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
    paddingRight: spacing.xs,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  metric: {
    color: colors.muted,
    ...typography.caption,
  },
  metricValue: {
    color: colors.textStrong,
    fontWeight: '800',
  },
});
