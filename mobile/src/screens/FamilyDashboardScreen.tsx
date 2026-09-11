import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  CaseStatus,
  CaseTimelineEvent,
  DisasterCase,
  ReportSource,
} from '../../../shared/types/index';
import { DeliveryStatus } from '../components/DeliveryStatus';
import { Screen } from '../components/Screen';
import type {
  LocalQueueRecord,
  LocalQueueService,
} from '../services/LocalQueueService';
import { colors, minimumTouchTarget, radii, spacing, typography } from '../theme';

interface FamilyDashboardScreenProps {
  localQueue: LocalQueueService;
  onBack: () => void;
  onRefreshServer?: () => Promise<unknown>;
  onReportMissing?: () => void;
}

interface StatusPresentation {
  label: string;
  message: string;
  background: string;
  foreground: string;
  progressIndex?: number;
}

const STATUS_PRESENTATION: Record<CaseStatus, StatusPresentation> = {
  REGISTERED: {
    label: 'Report saved',
    message: 'Your report is stored safely and ready to be shared.',
    background: colors.primaryTint,
    foreground: colors.primary,
    progressIndex: 0,
  },
  SEARCHING: {
    label: 'Searching',
    message: 'Available reports are being checked for useful information.',
    background: colors.primaryTint,
    foreground: colors.primary,
    progressIndex: 1,
  },
  INFORMATION_RECEIVED: {
    label: 'Information received',
    message: 'This report is available for comparison with other reports.',
    background: colors.primaryTint,
    foreground: colors.primary,
    progressIndex: 1,
  },
  POSSIBLE_MATCH: {
    label: 'Possible match found',
    message: 'Responders are reviewing the information. This is not a confirmed identification.',
    background: colors.warningTint,
    foreground: colors.warning,
    progressIndex: 2,
  },
  UNDER_VERIFICATION: {
    label: 'Verification in progress',
    message: 'An authorized responder is checking the evidence. The identity is not confirmed yet.',
    background: colors.warningTint,
    foreground: colors.warning,
    progressIndex: 3,
  },
  VERIFIED: {
    label: 'Identity verified',
    message: 'An authorized responder has confirmed the identity.',
    background: colors.safeTint,
    foreground: colors.safe,
    progressIndex: 4,
  },
  FAMILY_NOTIFIED: {
    label: 'Person located',
    message: 'The identity is verified and family notification has been recorded.',
    background: colors.safeTint,
    foreground: colors.safe,
    progressIndex: 4,
  },
  REUNITED: {
    label: 'Reunited',
    message: 'The reunion has been confirmed by an authorized responder.',
    background: colors.safeTint,
    foreground: colors.safe,
    progressIndex: 4,
  },
  CLOSED: {
    label: 'Case closed',
    message: 'This case is no longer active. Closure does not by itself mean the person was located.',
    background: colors.surfaceMuted,
    foreground: colors.muted,
  },
  REJECTED: {
    label: 'Report not accepted',
    message: 'An authorized reviewer rejected this case. The person has not been marked as located.',
    background: colors.dangerTint,
    foreground: colors.danger,
  },
  DUPLICATE: {
    label: 'Combined with another case',
    message: 'This report appears to refer to an existing case. Its original information is preserved.',
    background: colors.primaryTint,
    foreground: colors.primary,
  },
};

const SOURCE_LABEL: Record<ReportSource, string> = {
  FAMILY: 'Family member',
  PUBLIC: 'Member of the public',
  VOLUNTEER: 'Volunteer',
  HOSPITAL: 'Hospital',
  RELIEF_CAMP: 'Relief camp',
  RESPONDER: 'Authorized responder',
};

const CASE_JOURNEY = [
  'Report received',
  'Searching available information',
  'Reviewing possible matches',
  'Human verification',
  'Verified result',
] as const;

function caseIdFromRecord(record: LocalQueueRecord): string | undefined {
  const payload = record.envelope.payload;
  if (typeof payload !== 'object' || payload === null || !('caseId' in payload)) return undefined;
  return typeof payload.caseId === 'string' ? payload.caseId : undefined;
}

function payloadObject(record: LocalQueueRecord): Record<string, unknown> {
  const payload = record.envelope.payload;
  return typeof payload === 'object' && payload !== null
    ? payload as Record<string, unknown>
    : {};
}

function payloadText(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function payloadLocation(payload: Record<string, unknown>): string | undefined {
  const location = payload.location;
  if (typeof location !== 'object' || location === null) return undefined;
  const values = location as Record<string, unknown>;
  return payloadText(values, 'zone') ?? payloadText(values, 'address');
}

function activityName(record: LocalQueueRecord): string {
  const payload = payloadObject(record);
  return payloadText(payload, 'personName')
    ?? payloadText(payload, 'personDescription')
    ?? 'Saved report';
}

function formatDate(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : undefined;
}

function caseLocation(item: DisasterCase): string | undefined {
  return item.lastKnownLocation?.zone ?? item.lastKnownLocation?.address;
}

function caseTypeLabel(item: DisasterCase): string {
  if (item.type === 'MISSING') return 'Missing person';
  if (item.type === 'UNIDENTIFIED_PATIENT') return 'Unidentified person';
  return 'Found person';
}

function caseDetailLabel(item: DisasterCase): string {
  const parts: string[] = [];
  if (item.person.approximateAge !== undefined) parts.push(`About age ${item.person.approximateAge}`);
  const location = caseLocation(item);
  if (location) parts.push(location);
  return parts.join('  •  ');
}

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

interface CaseCardProps {
  item: DisasterCase;
  timeline: CaseTimelineEvent[];
  localRecord?: LocalQueueRecord;
  expanded: boolean;
  onToggle: () => void;
}

function CaseCard({ item, timeline, localRecord, expanded, onToggle }: CaseCardProps) {
  const presentation = STATUS_PRESENTATION[item.status];
  const summary = caseDetailLabel(item);
  const locationLabel = item.type === 'MISSING' ? 'Last known area' : 'Reported area';
  const isConfirmed = ['VERIFIED', 'FAMILY_NOTIFIED', 'REUNITED'].includes(item.status);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{caseTypeLabel(item)}</Text>
      <Text style={styles.name}>{item.person.name || 'Unknown person'}</Text>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      <View
        accessible
        accessibilityLabel={`${presentation.label}. ${presentation.message}`}
        style={[styles.statusPanel, { backgroundColor: presentation.background }]}
      >
        <Text style={[styles.statusLabel, { color: presentation.foreground }]}>{presentation.label}</Text>
        <Text style={styles.statusMessage}>{presentation.message}</Text>
      </View>

      {localRecord ? (
        <View style={styles.deliveryPanel}>
          <DeliveryStatus state={localRecord.deliveryState} />
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} details and updates for ${item.person.name || 'unknown person'}`}
        onPress={onToggle}
        style={styles.expandButton}
      >
        <Text style={styles.expandButtonText}>{expanded ? 'Hide details' : 'View details and updates'}</Text>
        <Text accessible={false} style={styles.expandIcon}>{expanded ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.expandedContent}>
          <Text accessibilityRole="header" style={styles.subheading}>Report details</Text>
          <DetailRow label="Reference" value={item.caseId} />
          <DetailRow label="Approximate age" value={item.person.approximateAge} />
          <DetailRow label={locationLabel} value={caseLocation(item)} />
          <DetailRow label="Clothing" value={item.person.clothing} />
          <DetailRow label="Identifying details" value={item.person.identifyingMarks} />
          <DetailRow label="Condition or support needs" value={item.person.medicalNeeds} />
          <DetailRow label="Reported by" value={SOURCE_LABEL[item.source]} />
          <DetailRow label="Last updated" value={formatDate(item.updatedAt)} />

          {presentation.progressIndex !== undefined ? (
            <View style={styles.progressSection}>
              <Text accessibilityRole="header" style={styles.subheading}>Case progress</Text>
              {CASE_JOURNEY.map((stage, index) => {
                const complete = index < presentation.progressIndex!;
                const current = index === presentation.progressIndex;
                const state = complete ? 'Complete' : current ? 'Current step' : 'Not reached';
                return (
                  <View
                    accessible
                    accessibilityLabel={`${stage}. ${state}.`}
                    key={stage}
                    style={styles.progressRow}
                  >
                    <Text
                      accessible={false}
                      style={[
                        styles.progressMarker,
                        complete || current ? styles.progressMarkerActive : null,
                      ]}
                    >
                      {complete ? '✓' : current ? '●' : '○'}
                    </Text>
                    <View style={styles.progressCopy}>
                      <Text style={[styles.progressTitle, current ? styles.progressTitleCurrent : null]}>
                        {stage}
                      </Text>
                      <Text style={styles.progressState}>{state}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.timelineSection}>
            <Text accessibilityRole="header" style={styles.subheading}>Updates</Text>
            {timeline.length === 0 ? (
              <Text style={styles.noUpdates}>No additional updates yet.</Text>
            ) : timeline.map((event) => (
              <View key={event.eventId} style={styles.event}>
                <View accessible={false} style={styles.eventDot} />
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}
                  <Text style={styles.eventMeta}>{formatDate(event.timestamp) ?? 'Time unavailable'}</Text>
                </View>
              </View>
            ))}
          </View>

          {!isConfirmed ? (
            <View style={styles.privacyNote}>
              <Text style={styles.privacyTitle}>Sensitive details stay protected</Text>
              <Text style={styles.privacyText}>
                Exact medical or private location details appear only after an authorized update allows it.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

interface ActivityCardProps {
  record: LocalQueueRecord;
  expanded: boolean;
  onToggle: () => void;
}

function ActivityCard({ record, expanded, onToggle }: ActivityCardProps) {
  const payload = payloadObject(record);
  const sighting = record.envelope.messageType === 'SIGHTING';
  const timestamp = payloadText(payload, 'timestamp');
  const location = payloadLocation(payload);

  return (
    <View style={styles.activityCard}>
      <Text style={[styles.eyebrow, sighting ? styles.sightingEyebrow : styles.safeEyebrow]}>
        {sighting ? 'Unverified sighting' : 'Safe check-in'}
      </Text>
      <Text style={styles.activityName}>{activityName(record)}</Text>
      {location ? <Text style={styles.summary}>{location}</Text> : null}
      {sighting ? (
        <Text style={styles.sightingNotice}>
          Responders must verify this information before it can confirm anyone's identity.
        </Text>
      ) : null}
      <View style={styles.deliveryPanel}>
        <DeliveryStatus state={record.deliveryState} />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} saved activity details`}
        onPress={onToggle}
        style={styles.expandButton}
      >
        <Text style={styles.expandButtonText}>{expanded ? 'Hide details' : 'View saved details'}</Text>
        <Text accessible={false} style={styles.expandIcon}>{expanded ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.expandedContent}>
          <DetailRow label="Reference" value={record.messageId} />
          <DetailRow label="Area" value={location} />
          <DetailRow label="Time" value={formatDate(timestamp ?? record.savedAt)} />
          {sighting ? (
            <>
              <DetailRow label="Clothing" value={payloadText(payload, 'clothingDescription')} />
              <DetailRow label="Direction" value={payloadText(payload, 'directionOfMovement')} />
            </>
          ) : (
            <DetailRow label="Note" value={payloadText(payload, 'statusMessage')} />
          )}
        </View>
      ) : null}
    </View>
  );
}

export function FamilyDashboardScreen({
  localQueue,
  onBack,
  onRefreshServer,
  onReportMissing,
}: FamilyDashboardScreenProps) {
  const [cases, setCases] = useState<DisasterCase[]>([]);
  const [timelines, setTimelines] = useState<Record<string, CaseTimelineEvent[]>>({});
  const [records, setRecords] = useState<LocalQueueRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number>();
  const [error, setError] = useState<string>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const requestSequence = useRef(0);

  const load = useCallback(async (showInitialLoading: boolean) => {
    const requestId = ++requestSequence.current;
    if (showInitialLoading) setInitialLoading(true);
    try {
      const nextCases = await localQueue.getCases();
      const nextRecords = await localQueue.getRecords();
      const entries = await Promise.all(
        nextCases.map(async (item) => [item.caseId, await localQueue.getTimeline(item.caseId)] as const),
      );
      if (requestId !== requestSequence.current) return;
      setCases(nextCases);
      setRecords(nextRecords);
      setTimelines(Object.fromEntries(entries));
    } catch (loadError) {
      if (requestId !== requestSequence.current) return;
      console.warn('Could not load locally saved case information.', loadError);
      setError('We could not open your saved updates. Try checking again.');
    } finally {
      if (requestId === requestSequence.current) setInitialLoading(false);
    }
  }, [localQueue]);

  useEffect(() => {
    void load(true);
    return localQueue.subscribe(() => void load(false));
  }, [localQueue, load]);

  const refreshServer = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(undefined);
    try {
      if (onRefreshServer) await onRefreshServer();
      await load(false);
      setLastCheckedAt(Date.now());
    } catch (syncError) {
      console.info('Could not refresh family status from the disaster network.', syncError);
      setError('The disaster network is unavailable. Your saved reports are still safe on this phone.');
    } finally {
      setRefreshing(false);
    }
  }, [load, onRefreshServer, refreshing]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const missingCases = cases.filter((item) => item.type === 'MISSING');
  const foundCases = cases.filter((item) => item.type !== 'MISSING');
  const safeRecords = records.filter((record) => record.envelope.messageType === 'SAFE_STATUS');
  const sightingRecords = records.filter((record) => record.envelope.messageType === 'SIGHTING');
  const hasContent = cases.length > 0 || safeRecords.length > 0 || sightingRecords.length > 0;

  const renderCaseSection = (
    title: string,
    description: string,
    sectionCases: DisasterCase[],
  ) => sectionCases.length > 0 ? (
    <View style={styles.section}>
      <View style={styles.sectionHeadingRow}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        <Text accessibilityLabel={`${sectionCases.length} reports`} style={styles.sectionCount}>
          {sectionCases.length}
        </Text>
      </View>
      <Text style={styles.sectionDescription}>{description}</Text>
      {sectionCases.map((item) => (
        <CaseCard
          expanded={expandedIds.has(item.caseId)}
          item={item}
          key={item.caseId}
          localRecord={records.find((record) => caseIdFromRecord(record) === item.caseId)}
          onToggle={() => toggleExpanded(item.caseId)}
          timeline={timelines[item.caseId] ?? []}
        />
      ))}
    </View>
  ) : null;

  const renderActivitySection = (
    title: string,
    description: string,
    sectionRecords: LocalQueueRecord[],
  ) => sectionRecords.length > 0 ? (
    <View style={styles.section}>
      <View style={styles.sectionHeadingRow}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        <Text accessibilityLabel={`${sectionRecords.length} reports`} style={styles.sectionCount}>
          {sectionRecords.length}
        </Text>
      </View>
      <Text style={styles.sectionDescription}>{description}</Text>
      {sectionRecords.map((record) => (
        <ActivityCard
          expanded={expandedIds.has(record.messageId)}
          key={record.messageId}
          onToggle={() => toggleExpanded(record.messageId)}
          record={record}
        />
      ))}
    </View>
  ) : null;

  return (
    <Screen
      title="Family status"
      subtitle="See what is happening now and which updates have been verified."
      onBack={onBack}
    >
      <View style={styles.refreshRow}>
        <View style={styles.refreshCopy}>
          <Text style={styles.refreshTitle}>Latest information</Text>
          <Text accessibilityLiveRegion="polite" style={styles.refreshStatus}>
            {refreshing
              ? 'Checking for updates…'
              : lastCheckedAt
                ? `Checked ${new Date(lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Saved information is available offline.'}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Check for case updates"
          accessibilityRole="button"
          accessibilityState={{ busy: refreshing, disabled: refreshing }}
          disabled={refreshing}
          onPress={() => void refreshServer()}
          style={[styles.refreshButton, refreshing ? styles.refreshButtonDisabled : null]}
        >
          {refreshing ? (
            <ActivityIndicator accessibilityLabel="Checking for updates" color={colors.primary} size="small" />
          ) : (
            <Text style={styles.refreshButtonText}>Check now</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <View accessibilityLiveRegion="assertive" style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Could not check for updates</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {initialLoading ? (
        <View accessible accessibilityLabel="Opening saved case information" style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Opening saved information…</Text>
        </View>
      ) : null}

      {!initialLoading && !hasContent ? (
        <View style={styles.empty}>
          <Text accessibilityRole="header" style={styles.emptyTitle}>No saved reports yet</Text>
          <Text style={styles.emptyText}>
            Go back to report someone missing, share a sighting, or mark yourself safe. Reports remain on this phone when the network is unavailable.
          </Text>
          {onReportMissing ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onReportMissing}
              style={styles.emptyAction}
            >
              <Text style={styles.emptyActionText}>Report someone missing</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {!initialLoading ? (
        <>
          {renderCaseSection(
            'People you are looking for',
            'Possible matches stay unconfirmed until an authorized responder verifies them.',
            missingCases,
          )}
          {renderCaseSection(
            'People you reported found',
            'These are reports created on this phone. They do not confirm anyone’s identity.',
            foundCases,
          )}
          {renderActivitySection(
            'Safe check-ins',
            'People marked safe from this phone.',
            safeRecords,
          )}
          {renderActivitySection(
            'Sightings',
            'Sightings are leads for responders, not confirmed identifications.',
            sightingRecords,
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  refreshRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flexDirection: 'row',
    padding: spacing.md,
  },
  refreshCopy: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  refreshTitle: {
    ...typography.label,
    color: colors.textStrong,
  },
  refreshStatus: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.xxs,
  },
  refreshButton: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    minWidth: 96,
    paddingHorizontal: spacing.sm,
  },
  refreshButtonDisabled: {
    opacity: 0.65,
  },
  refreshButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  errorPanel: {
    backgroundColor: colors.dangerTint,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  errorTitle: {
    ...typography.label,
    color: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xxs,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  empty: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong,
  },
  emptyText: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  emptyAction: {
    minHeight: minimumTouchTarget + 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.missing,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyActionText: {
    color: colors.onAccent,
    ...typography.button,
    textAlign: 'center',
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong,
    flex: 1,
  },
  sectionCount: {
    ...typography.caption,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    color: colors.muted,
    fontWeight: '700',
    minWidth: 28,
    overflow: 'hidden',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    textAlign: 'center',
  },
  sectionDescription: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: spacing.sm,
    marginTop: spacing.xxs,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: '700',
  },
  safeEyebrow: {
    color: colors.safe,
  },
  sightingEyebrow: {
    color: colors.sighting,
  },
  name: {
    ...typography.sectionTitle,
    color: colors.textStrong,
    fontSize: 21,
    lineHeight: 27,
    marginTop: spacing.xxs,
  },
  activityName: {
    ...typography.bodyStrong,
    color: colors.textStrong,
    marginTop: spacing.xxs,
  },
  summary: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.xxs,
  },
  statusPanel: {
    borderRadius: radii.md,
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  statusLabel: {
    ...typography.label,
  },
  statusMessage: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xxs,
  },
  deliveryPanel: {
    marginTop: spacing.md,
  },
  expandButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    minHeight: minimumTouchTarget,
  },
  expandButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  expandIcon: {
    color: colors.primary,
    fontSize: 20,
    marginLeft: spacing.xs,
  },
  expandedContent: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  subheading: {
    ...typography.label,
    color: colors.textStrong,
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xxs,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.muted,
    paddingRight: spacing.sm,
    width: 120,
  },
  detailValue: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    fontWeight: '600',
  },
  progressSection: {
    marginTop: spacing.lg,
  },
  progressRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minHeight: 42,
  },
  progressMarker: {
    color: colors.borderStrong,
    fontSize: 15,
    marginRight: spacing.xs,
    marginTop: 1,
    textAlign: 'center',
    width: 18,
  },
  progressMarkerActive: {
    color: colors.primary,
  },
  progressCopy: {
    flex: 1,
  },
  progressTitle: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: '600',
  },
  progressTitleCurrent: {
    color: colors.textStrong,
    fontWeight: '700',
  },
  progressState: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  timelineSection: {
    marginTop: spacing.lg,
  },
  noUpdates: {
    ...typography.caption,
    color: colors.muted,
  },
  event: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
  },
  eventDot: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 8,
    marginRight: spacing.sm,
    marginTop: 6,
    width: 8,
  },
  eventBody: {
    flex: 1,
  },
  eventTitle: {
    ...typography.label,
    color: colors.textStrong,
  },
  eventDescription: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.xxs,
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xxs,
  },
  privacyNote: {
    backgroundColor: colors.warningTint,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  privacyTitle: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
  },
  privacyText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xxs,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  sightingNotice: {
    ...typography.caption,
    backgroundColor: colors.warningTint,
    borderRadius: radii.sm,
    color: colors.warning,
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
});
