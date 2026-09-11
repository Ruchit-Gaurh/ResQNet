import { useState } from 'react';
import { Alert } from 'react-native';

import { FormField } from '../components/FormField';
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
  const [timeSeen, setTimeSeen] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    if (!zone.trim() || !description.trim()) {
      Alert.alert('Description and zone needed', 'A sighting needs a basic description and where it occurred.');
      return;
    }
    const parsedTime = timeSeen.trim() ? Date.parse(timeSeen.trim()) : undefined;
    if (parsedTime !== undefined && !Number.isFinite(parsedTime)) {
      Alert.alert('Check the time', 'Use a recognizable date/time or leave it blank to use the current time.');
      return;
    }
    setBusy(true);
    try {
      const result = await submissions.submitSighting({
        targetCaseId: caseId,
        personDescription: description,
        zone,
        clothingDescription: clothing,
        directionOfMovement: direction,
        timestamp: parsedTime === undefined ? undefined : new Date(parsedTime).toISOString(),
        photoUri,
        notes,
      });
      Alert.alert(
        'Sighting saved — unverified',
        result.deliveryState === 'RELAYING'
          ? 'Relaying through the development mesh. This is not a confirmed identification.'
          : 'Saved locally. This is not a confirmed identification.',
      );
      onSaved();
    } catch (error) {
      Alert.alert('Could not save sighting', error instanceof Error ? error.message : 'Local storage failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Report a sighting" subtitle="A sighting is unverified information, not a confirmed identity." onBack={onBack}>
      <FormField label="Related case ID" placeholder="If known" value={caseId} onChangeText={setCaseId} />
      <FormField label="Person description" optional={false} multiline placeholder="Approximate appearance" value={description} onChangeText={setDescription} />
      <FormField label="Zone / location" optional={false} placeholder="Zone A, near Gate 4" value={zone} onChangeText={setZone} />
      <FormField label="Clothing" placeholder="Clothing description" value={clothing} onChangeText={setClothing} />
      <FormField label="Direction of movement" placeholder="Toward Sector 5" value={direction} onChangeText={setDirection} />
      <FormField label="Time seen" placeholder="Blank uses current time" value={timeSeen} onChangeText={setTimeSeen} />
      <PhotoField photoUri={photoUri} onChange={setPhotoUri} />
      <FormField label="Notes" multiline placeholder="Time or other context" value={notes} onChangeText={setNotes} />
      <SubmitButton label="SAVE UNVERIFIED SIGHTING" busy={busy} color={colors.sighting} onPress={() => void submit()} />
    </Screen>
  );
}
