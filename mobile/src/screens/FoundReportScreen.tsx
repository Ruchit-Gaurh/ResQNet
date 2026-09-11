import { useState } from 'react';
import { Alert } from 'react-native';

import { FormField } from '../components/FormField';
import { PhotoField } from '../components/PhotoField';
import { Screen } from '../components/Screen';
import { SubmitButton } from '../components/SubmitButton';
import type { ReportSubmissionService } from '../services/ReportSubmissionService';
import { colors } from '../theme';

interface FoundReportScreenProps {
  submissions: ReportSubmissionService;
  onBack: () => void;
  onSaved: () => void;
}

function parseAge(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function FoundReportScreen({ submissions, onBack, onSaved }: FoundReportScreenProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState('');
  const [zone, setZone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    if (![name, age, photoUri, description, condition, zone, notes].some((value) => Boolean(value?.trim()))) {
      Alert.alert('Add one detail', 'Identity may be unknown. Add any useful description, location, or photo.');
      return;
    }
    setBusy(true);
    try {
      const result = await submissions.submitFound({
        name,
        approximateAge: parseAge(age),
        photoUri,
        physicalDescription: description,
        physicalCondition: condition,
        zone,
        notes,
      });
      Alert.alert(
        'Found-person report saved',
        result.deliveryState === 'RELAYING'
          ? 'Saved locally and relaying through the development mesh. Identity is unverified.'
          : 'Saved locally — waiting for connectivity. Identity is unverified.',
      );
      onSaved();
    } catch (error) {
      Alert.alert('Could not save report', error instanceof Error ? error.message : 'Local storage failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="I found someone" subtitle="The person's name can be unknown." onBack={onBack}>
      <FormField label="Known name" placeholder="Leave blank if unknown" value={name} onChangeText={setName} />
      <FormField label="Approximate age" keyboardType="number-pad" placeholder="Example: 20–25" value={age} onChangeText={setAge} />
      <PhotoField photoUri={photoUri} onChange={setPhotoUri} />
      <FormField label="Physical description" multiline placeholder="Clothing, marks, height…" value={description} onChangeText={setDescription} />
      <FormField label="Physical condition" placeholder="Stable, needs assistance…" value={condition} onChangeText={setCondition} />
      <FormField label="Hospital / camp / current zone" placeholder="Relief Camp 7" value={zone} onChangeText={setZone} />
      <FormField label="Notes" multiline placeholder="Other useful information" value={notes} onChangeText={setNotes} />
      <SubmitButton label="SAVE FOUND REPORT" busy={busy} color={colors.found} onPress={() => void submit()} />
    </Screen>
  );
}
