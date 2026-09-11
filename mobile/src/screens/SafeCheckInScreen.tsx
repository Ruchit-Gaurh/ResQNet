import { useState } from 'react';
import { Alert } from 'react-native';

import { FormField } from '../components/FormField';
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
  const [busy, setBusy] = useState(false);

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
          ? 'Saved locally and relaying through the development mesh. Peer receipt is not gateway delivery.'
          : 'Saved locally — waiting for connectivity.',
      );
      onSaved();
    } catch (error) {
      Alert.alert('Could not save check-in', error instanceof Error ? error.message : 'Local storage failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="I'm safe" subtitle="A quick check-in. Name and safe zone are enough." onBack={onBack}>
      <FormField label="Your name" optional={false} placeholder="Name" value={name} onChangeText={setName} />
      <FormField label="Current safe zone" optional={false} placeholder="School shelter, Camp 2…" value={zone} onChangeText={setZone} />
      <FormField label="Phone / contact" keyboardType="phone-pad" placeholder="If safe to share" value={phone} onChangeText={setPhone} />
      <FormField label="Short note" placeholder="Safe and unhurt" value={note} onChangeText={setNote} />
      <FormField label="Family member names" placeholder="Comma separated" value={family} onChangeText={setFamily} />
      <SubmitButton label="MARK ME SAFE" busy={busy} color={colors.safe} onPress={() => void submit()} />
    </Screen>
  );
}
