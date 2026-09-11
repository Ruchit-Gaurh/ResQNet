import { useState } from 'react';
import { Alert } from 'react-native';

import { Disclosure } from '../components/Disclosure';
import { FormField } from '../components/FormField';
import { FormSection } from '../components/FormSection';
import { PhotoField } from '../components/PhotoField';
import { Screen } from '../components/Screen';
import { SubmitButton } from '../components/SubmitButton';
import type { ReportSubmissionService } from '../services/ReportSubmissionService';
import { colors } from '../theme';

interface SightingReportScreenProps {
  submissions: ReportSubmissionService;
  onBack: () => void;
  onSaved: () => void;
}

export function SightingReportScreen({ submissions, onBack, onSaved }: SightingReportScreenProps) {
  const [caseId, setCaseId] = useState('');
  const [description, setDescription] = useState('');
  const [zone, setZone] = useState('');
  const [clothing, setClothing] = useState('');
  const [direction, setDirection] = useState('');
  const [minutesAgo, setMinutesAgo] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [showEarlierTime, setShowEarlierTime] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasUnsavedChanges = showEarlierTime || [caseId, description, zone, clothing, direction, minutesAgo, notes, photoUri].some(
    (value) => Boolean(value?.trim()),
  );

  async function submit(): Promise<void> {
    if (!zone.trim() || !description.trim()) {
      Alert.alert('Description and zone needed', 'A sighting needs a basic description and where it occurred.');
      return;
    }
    let timestamp: string | undefined;
    if (showEarlierTime) {
      const parsedMinutes = Number.parseInt(minutesAgo.trim(), 10);
      if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
        Alert.alert('Check when you saw them', 'Enter roughly how many minutes ago the sighting happened.');
        return;
      }
      timestamp = new Date(Date.now() - parsedMinutes * 60_000).toISOString();
    }
    setBusy(true);
    try {
      const result = await submissions.submitSighting({
        targetCaseId: caseId,
        personDescription: description,
        zone,
        clothingDescription: clothing,
        directionOfMovement: direction,
        timestamp,
        photoUri,
        notes,
      });
      Alert.alert(
        'Sighting saved, not yet verified',
        result.deliveryState === 'RELAYING'
          ? 'Saved on this phone and sharing with nearby devices. It has not reached the disaster network yet. Responders must verify this information.'
          : 'Saved on this phone. ResQNet will keep trying to share it. Responders must verify this information.',
      );
      onSaved();
    } catch (error) {
      Alert.alert('Could not save sighting', error instanceof Error ? error.message : 'Local storage failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Report a sighting"
      subtitle="This helps responders investigate. It does not confirm anyone’s identity."
      onBack={onBack}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <FormSection title="What did you see?">
        <FormField
          label="Person description"
          optional={false}
          multiline
          placeholder="Describe their approximate appearance"
          value={description}
          onChangeText={setDescription}
        />
      </FormSection>

      <FormSection title="Where and when?" description="The sighting time is set to now unless you change it.">
        <FormField
          label="Zone or location"
          optional={false}
          placeholder="Example: Zone A, near Gate 4"
          value={zone}
          onChangeText={setZone}
        />
        <Disclosure
          label="The sighting happened earlier"
          expanded={showEarlierTime}
          onPress={() => setShowEarlierTime((current) => !current)}
        >
          <FormField
            label="About how many minutes ago?"
            optional={false}
            keyboardType="number-pad"
            placeholder="Example: 30"
            value={minutesAgo}
            onChangeText={setMinutesAgo}
          />
        </Disclosure>
      </FormSection>

      <Disclosure
        label="Add photo, clothing, or other details"
        expanded={showMore}
        onPress={() => setShowMore((current) => !current)}
      >
        <PhotoField photoUri={photoUri} onChange={setPhotoUri} />
        <FormField label="Clothing" placeholder="Describe what they were wearing" value={clothing} onChangeText={setClothing} />
        <FormField label="Direction of movement" placeholder="Example: Toward Sector 5" value={direction} onChangeText={setDirection} />
        <FormField label="Related case reference" placeholder="Only if you know it" value={caseId} onChangeText={setCaseId} />
        <FormField label="Notes" multiline placeholder="Anything else responders should know" value={notes} onChangeText={setNotes} />
      </Disclosure>

      <SubmitButton label="Save unverified sighting" busy={busy} color={colors.sighting} onPress={() => void submit()} />
    </Screen>
  );
}
