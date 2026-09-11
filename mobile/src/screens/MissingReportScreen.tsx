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
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasUnsavedChanges = [name, age, photoUri, clothing, zone, details].some((value) =>
    Boolean(value?.trim()),
  );

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
        ? 'Saved on this phone and sharing with nearby devices. It has not reached the disaster network yet.'
        : 'Saved on this phone. ResQNet will keep trying to share it when a connection is available.';
      Alert.alert(
        'Missing person report saved',
        result.transportError
          ? 'Your report is safe on this phone. It could not be shared yet, so ResQNet will keep trying.'
          : message,
      );
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
      subtitle="Share what you know. One useful detail is enough."
      onBack={onBack}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <FormSection
        title="Who are you looking for?"
        description="A name or photo helps, but neither is required."
      >
        <FormField label="Name or nickname" placeholder="Enter any name you know" value={name} onChangeText={setName} />
        <FormField
          label="Best estimate of age"
          keyboardType="number-pad"
          placeholder="Example: 22"
          value={age}
          onChangeText={setAge}
        />
        <PhotoField photoUri={photoUri} onChange={setPhotoUri} />
      </FormSection>

      <FormSection title="Where were they last seen?">
        <FormField
          label="Zone or location"
          placeholder="Example: Zone A, Sector 4"
          value={zone}
          onChangeText={setZone}
        />
      </FormSection>

      <Disclosure
        label="Add clothing or identifying details"
        expanded={showMore}
        onPress={() => setShowMore((current) => !current)}
      >
        <FormField
          label="Clothing"
          placeholder="Example: Blue shirt, black trousers"
          value={clothing}
          onChangeText={setClothing}
        />
        <FormField
          label="Identifying details or notes"
          multiline
          placeholder="Marks, height, or what happened"
          value={details}
          onChangeText={setDetails}
        />
      </Disclosure>

      <SubmitButton label="Save missing person report" busy={busy} color={colors.missing} onPress={() => void submit()} />
    </Screen>
  );
}
