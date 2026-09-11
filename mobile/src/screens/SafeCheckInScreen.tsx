import { useState } from 'react';
import { Alert } from 'react-native';

import { Disclosure } from '../components/Disclosure';
import { FormField } from '../components/FormField';
import { FormSection } from '../components/FormSection';
import { Screen } from '../components/Screen';
import { SubmitButton } from '../components/SubmitButton';
import type { ReportSubmissionService } from '../services/ReportSubmissionService';
import { colors } from '../theme';

interface SafeCheckInScreenProps {
  submissions: ReportSubmissionService;
  onBack: () => void;
  onSaved: () => void;
}

export function SafeCheckInScreen({ submissions, onBack, onSaved }: SafeCheckInScreenProps) {
  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [family, setFamily] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasUnsavedChanges = [name, zone, phone, note, family].some((value) => Boolean(value.trim()));

  async function submit(): Promise<void> {
    if (!name.trim() || !zone.trim()) {
      Alert.alert('Name and safe zone needed', 'Add your name and current safe zone to check in.');
      return;
    }
    setBusy(true);
    try {
      const result = await submissions.submitSafe({
        name,
        zone,
        phoneNumber: phone,
        note,
        familyMembers: family.split(',').map((item) => item.trim()).filter(Boolean),
      });
      Alert.alert(
        'Safe check-in saved',
        result.deliveryState === 'RELAYING'
          ? 'Saved on this phone and sharing with nearby devices. It has not reached the disaster network yet.'
          : 'Saved on this phone. ResQNet will keep trying to share it when a connection is available.',
      );
      onSaved();
    } catch (error) {
      Alert.alert('Could not save check-in', error instanceof Error ? error.message : 'Local storage failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="I'm safe"
      subtitle="A quick check-in can help family know you are okay."
      onBack={onBack}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <FormSection title="Share your safe status" description="Only your name and current safe place are needed.">
        <FormField label="Your name" optional={false} placeholder="Enter your name" value={name} onChangeText={setName} />
        <FormField
          label="Where are you safe?"
          optional={false}
          placeholder="Example: School shelter or Camp 2"
          value={zone}
          onChangeText={setZone}
        />
      </FormSection>

      <Disclosure
        label="Add family or contact details"
        expanded={showMore}
        onPress={() => setShowMore((current) => !current)}
      >
        <FormField
          label="Phone or contact"
          keyboardType="phone-pad"
          placeholder="Only if it is safe to share"
          value={phone}
          onChangeText={setPhone}
        />
        <FormField
          label="Family member names"
          helperText="Separate multiple names with commas."
          placeholder="Who may be looking for you?"
          value={family}
          onChangeText={setFamily}
        />
        <FormField label="Short note" placeholder="Example: Safe and unhurt" value={note} onChangeText={setNote} />
      </Disclosure>

      <SubmitButton label="Share that I'm safe" busy={busy} color={colors.safe} onPress={() => void submit()} />
    </Screen>
  );
}
