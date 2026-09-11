import { StyleSheet, Text, View } from 'react-native';

import type { DeliveryState } from '../services/LocalQueueService';
import { colors, radii, spacing, typography } from '../theme';

export const DELIVERY_LABELS: Record<DeliveryState, string> = {
  SAVED_LOCALLY: 'Saved on this phone',
  RELAYING: 'Sharing with nearby devices',
  REACHED_PEER: 'Reached a nearby device',
  DELIVERED_TO_NETWORK: 'Reached the disaster network',
};

export interface DeliveryPresentation {
  label: string;
  description: string;
  foreground: string;
  background: string;
}

export const DELIVERY_PRESENTATION: Record<DeliveryState, DeliveryPresentation> = {
  SAVED_LOCALLY: {
    label: DELIVERY_LABELS.SAVED_LOCALLY,
    description: 'Stored safely here. It will be shared when a connection is available.',
    foreground: colors.warning,
    background: colors.warningTint,
  },
  RELAYING: {
    label: DELIVERY_LABELS.RELAYING,
    description: 'This report is being passed to nearby ResQNet devices.',
    foreground: colors.info,
    background: colors.infoTint,
  },
  REACHED_PEER: {
    label: DELIVERY_LABELS.REACHED_PEER,
    description: 'A nearby device has received it. The disaster network has not confirmed receipt yet.',
    foreground: colors.info,
    background: colors.infoTint,
  },
  DELIVERED_TO_NETWORK: {
    label: DELIVERY_LABELS.DELIVERED_TO_NETWORK,
    description: 'The disaster network has confirmed receipt.',
    foreground: colors.safe,
    background: colors.safeTint,
  },
};

export interface DeliveryStatusProps {
  state: DeliveryState;
  showDescription?: boolean;
  compact?: boolean;
}

export function DeliveryStatus({
  state,
  showDescription = true,
  compact = false,
}: DeliveryStatusProps) {
  const presentation = DELIVERY_PRESENTATION[state];
  const spokenText = showDescription
    ? `${presentation.label}. ${presentation.description}`
    : presentation.label;

  return (
    <View
      accessibilityLabel={spokenText}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessible
      style={[
        styles.container,
        { backgroundColor: presentation.background },
        compact ? styles.compact : null,
      ]}
    >
      <View
        accessible={false}
        style={[styles.marker, { backgroundColor: presentation.foreground }]}
      />
      <View style={styles.copy}>
        <Text style={[styles.label, { color: presentation.foreground }]}>
          {presentation.label}
        </Text>
        {showDescription && !compact ? (
          <Text style={styles.description}>{presentation.description}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compact: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  marker: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    marginTop: 7,
    marginRight: spacing.sm,
  },
  copy: {
    flex: 1,
  },
  label: {
    ...typography.bodyStrong,
  },
  description: {
    color: colors.text,
    ...typography.caption,
    marginTop: spacing.xxs,
  },
});
