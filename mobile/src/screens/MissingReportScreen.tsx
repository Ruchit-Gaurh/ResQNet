import { useState } from 'react';
import { Alert } from 'react-native';

import { FormField } from '../components/FormField';
import { PhotoField } from '../components/PhotoField';
import { Screen } from '../components/Screen';
import { SubmitButton } from '../components/SubmitButton';
import type { ReportSubmissionService } from '../services/ReportSubmissionService';
import { colors } from '../theme';

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
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

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
        details,
      });
      const message = result.deliveryState === 'RELAYING'
        ? 'Saved locally and relaying through the development mesh. Peer receipt is not gateway delivery.'
        : 'Saved locally — waiting for connectivity.';
      Alert.alert('Report saved', result.transportError ? `${message}\n\nRelay issue: ${result.transportError}` : message);
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
      subtitle="Share whatever you know. Only one useful detail is required."
      onBack={onBack}
    >
      <FormField label="Name" placeholder="Full name, nickname, or unknown" value={name} onChangeText={setName} />
      <FormField label="Approximate age" keyboardType="number-pad" placeholder="Example: 22" value={age} onChangeText={setAge} />
      <PhotoField photoUri={photoUri} onChange={setPhotoUri} />
      <FormField label="Clothing" placeholder="Blue shirt, black trousers" value={clothing} onChangeText={setClothing} />
      <FormField label="Last known zone / location" placeholder="Zone A, Sector 4" value={zone} onChangeText={setZone} />
      <FormField label="Identifying details or notes" multiline placeholder="Marks, height, circumstances…" value={details} onChangeText={setDetails} />
      <SubmitButton label="SAVE MISSING REPORT" busy={busy} color={colors.missing} onPress={() => void submit()} />
    </Screen>
  );
}
