import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { CaseStatus, CaseTimelineEvent, DisasterCase } from '../../../shared/types/index';
import { Screen } from '../components/Screen';
import type {
  DeliveryState,
  LocalQueueRecord,
  LocalQueueService,
} from '../services/LocalQueueService';
import { colors } from '../theme';

interface FamilyDashboardScreenProps {
  localQueue: LocalQueueService;
  onBack: () => void;
  onRefreshServer?: () => Promise<unknown>;
}

const VERIFIED_STATUSES = new Set<CaseStatus>(['VERIFIED', 'FAMILY_NOTIFIED', 'REUNITED', 'CLOSED']);

const DELIVERY_LABEL: Record<DeliveryState, string> = {
  SAVED_LOCALLY: 'Saved locally — waiting for connectivity',
  RELAYING: 'Relaying through the selected mesh transport',
  REACHED_PEER: 'Reached a nearby peer — waiting for gateway',
  DELIVERED_TO_NETWORK: 'Delivered to disaster network — backend acknowledged',
};

function caseIdFromRecord(record: LocalQueueRecord): string | undefined {
  const payload = record.envelope.payload;
  if (typeof payload !== 'object' || payload === null || !('caseId' in payload)) {
    return undefined;
  }
  return typeof payload.caseId === 'string' ? payload.caseId : undefined;
}

function activityName(record: LocalQueueRecord): string {
  const payload = record.envelope.payload;
  if (typeof payload !== 'object' || payload === null) {
    return 'Local report';
  }
  if ('personName' in payload && typeof payload.personName === 'string') {
    return payload.personName;
  }
  if ('personDescription' in payload && typeof payload.personDescription === 'string') {
    return payload.personDescription;
  }
  return 'Local report';
}

const CASE_JOURNEY = [
  'Report created',
  'Searching / information received',
  'Possible match — unverified',
  'Human verification',
  'Person located / verified',
] as const;

function journeyPosition(status: CaseStatus): number {
  if (['VERIFIED', 'FAMILY_NOTIFIED', 'REUNITED', 'CLOSED'].includes(status)) return 4;
  if (status === 'UNDER_VERIFICATION') return 3;
  if (status === 'POSSIBLE_MATCH') return 2;
  if (['SEARCHING', 'INFORMATION_RECEIVED'].includes(status)) return 1;
  return 0;
}

function statusPresentation(status: CaseStatus): { label: string; background: string; foreground: string } {
  if (status === 'POSSIBLE_MATCH') {
    return { label: 'POSSIBLE MATCH — UNVERIFIED', background: '#FFF3BF', foreground: '#7A4D00' };
  }
  if (status === 'UNDER_VERIFICATION') {
    return { label: 'HUMAN VERIFICATION IN PROGRESS', background: '#FFF3BF', foreground: '#7A4D00' };
  }
  if (status === 'REUNITED') {
    return { label: 'PERSON LOCATED / VERIFIED', background: '#D3F9D8', foreground: '#065F46' };
  }
  if (status === 'FAMILY_NOTIFIED') {
    return { label: 'PERSON LOCATED / FAMILY NOTIFIED', background: '#D3F9D8', foreground: '#065F46' };
  }
  if (VERIFIED_STATUSES.has(status)) {
    return { label: 'VERIFIED UPDATE', background: '#D3F9D8', foreground: '#065F46' };
  }
  return { label: status.replaceAll('_', ' '), background: '#E7EEF8', foreground: colors.text };
}

export function FamilyDashboardScreen({ localQueue, onBack, onRefreshServer }: FamilyDashboardScreenProps) {
  const [cases, setCases] = useState<DisasterCase[]>([]);
  const [timelines, setTimelines] = useState<Record<string, CaseTimelineEvent[]>>({});
  const [records, setRecords] = useState<LocalQueueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const nextCases = await localQueue.getCases();
      const nextRecords = await localQueue.getRecords();
      const entries = await Promise.all(
        nextCases.map(async (item) => [item.caseId, await localQueue.getTimeline(item.caseId)] as const),
      );
      setCases(nextCases);
      setRecords(nextRecords);
      setTimelines(Object.fromEntries(entries));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load local cases.');
    } finally {
      setLoading(false);
    }
  }, [localQueue]);

  useEffect(() => {
    void refresh();
    return localQueue.subscribe(() => void refresh());
  }, [localQueue, refresh]);

  const refreshServer = useCallback(async () => {
    if (!onRefreshServer) {
      await refresh();
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      await onRefreshServer();
      await refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Backend is unavailable; local cases are unchanged.');
      setLoading(false);
    }
  }, [onRefreshServer, refresh]);

  return (
    <Screen title="My cases" subtitle="Possible matches remain unconfirmed until human verification." onBack={onBack}>
      <TouchableOpacity onPress={() => void refreshServer()} style={styles.refresh}>
        <Text style={styles.refreshText}>{onRefreshServer ? 'Refresh server status' : 'Refresh local status'}</Text>
      </TouchableOpacity>
      {loading ? <ActivityIndicator color={colors.info} size="large" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && cases.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No local cases yet</Text>
          <Text style={styles.emptyText}>Missing and found reports saved on this device will appear here.</Text>
        </View>
      ) : null}
      {cases.map((item) => {
        const presentation = statusPresentation(item.status);
        const timeline = timelines[item.caseId] ?? [];
        const localRecord = records.find((record) => caseIdFromRecord(record) === item.caseId);
        const currentJourneyPosition = journeyPosition(item.status);
        return (
          <View key={item.caseId} style={styles.card}>
            <Text style={styles.name}>{item.person.name || 'Unknown person'}</Text>
            <Text style={styles.caseId}>{item.caseId}</Text>
            <View style={[styles.badge, { backgroundColor: presentation.background }]}>
              <Text style={[styles.badgeText, { color: presentation.foreground }]}>{presentation.label}</Text>
            </View>
            <Text style={styles.provenance}>Information received from: {item.source.replaceAll('_', ' ')}</Text>
            <Text style={styles.verification}>Verification: {item.verificationState.replaceAll('_', ' ')}</Text>
            {localRecord ? (
              <Text style={styles.delivery}>Delivery: {DELIVERY_LABEL[localRecord.deliveryState]}</Text>
            ) : null}
            <Text style={styles.journeyTitle}>Case progress</Text>
            {CASE_JOURNEY.map((stage, index) => {
              const isCurrent = index === currentJourneyPosition;
              const isComplete = index < currentJourneyPosition;
              return (
                <View key={stage} style={styles.journeyRow}>
                  <Text style={[styles.journeyMarker, isCurrent ? styles.journeyCurrent : null]}>
                    {isComplete ? '✓' : isCurrent ? '●' : '○'}
                  </Text>
                  <Text style={[styles.journeyText, isCurrent ? styles.journeyCurrent : null]}>
                    {stage}{index > currentJourneyPosition ? ' — pending' : ''}
                  </Text>
                </View>
              );
            })}
            <View style={styles.timeline}>
              {timeline.map((event) => (
                <View key={event.eventId} style={styles.event}>
                  <View style={styles.dot} />
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDescription}>{event.description}</Text>
                    <Text style={styles.eventMeta}>{new Date(event.timestamp).toLocaleString()} · {event.verificationStatus.replaceAll('_', ' ')}</Text>
                  </View>
                </View>
              ))}
            </View>
            {!VERIFIED_STATUSES.has(item.status) ? (
              <Text style={styles.privateNote}>Exact hospital or sensitive location details stay hidden until an authorized update is received.</Text>
            ) : null}
          </View>
        );
      })}
      {records.some((record) => ['SAFE_STATUS', 'SIGHTING'].includes(record.envelope.messageType)) ? (
        <Text style={styles.sectionTitle}>Other activity saved on this device</Text>
      ) : null}
      {records
        .filter((record) => ['SAFE_STATUS', 'SIGHTING'].includes(record.envelope.messageType))
        .map((record) => (
          <View key={record.messageId} style={styles.activityCard}>
            <Text style={styles.activityType}>
              {record.envelope.messageType === 'SAFE_STATUS' ? 'SAFE CHECK-IN' : 'UNVERIFIED SIGHTING'}
            </Text>
            <Text style={styles.activityName}>{activityName(record)}</Text>
            <Text style={styles.delivery}>{DELIVERY_LABEL[record.deliveryState]}</Text>
            {record.envelope.messageType === 'SIGHTING' ? (
              <Text style={styles.unverified}>This is a sighting, not a confirmed identification.</Text>
            ) : null}
          </View>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  refresh: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 10,
  },
  refreshText: {
    color: colors.info,
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 17,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  caseId: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 13,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  provenance: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 13,
  },
  verification: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  delivery: {
    color: colors.info,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 6,
  },
  timeline: {
    marginTop: 16,
  },
  journeyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
    marginTop: 15,
  },
  journeyRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginTop: 4,
  },
  journeyMarker: {
    color: colors.muted,
    fontSize: 14,
    marginRight: 8,
    width: 16,
  },
  journeyText: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  journeyCurrent: {
    color: colors.info,
    fontWeight: '900',
  },
  event: {
    flexDirection: 'row',
    paddingBottom: 14,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.info,
    marginTop: 5,
    marginRight: 10,
  },
  eventBody: {
    flex: 1,
  },
  eventTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  eventDescription: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: 2,
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  privateNote: {
    color: '#6B4B00',
    backgroundColor: colors.overlay,
    padding: 10,
    borderRadius: 9,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 8,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    padding: 15,
  },
  activityType: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  activityName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
  },
  unverified: {
    color: '#7A4D00',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
});
