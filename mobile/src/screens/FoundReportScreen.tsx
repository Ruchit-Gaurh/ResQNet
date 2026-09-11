import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Disclosure } from '../components/Disclosure';
import { FormField } from '../components/FormField';
import { FormSection } from '../components/FormSection';
import { PhotoField } from '../components/PhotoField';
import { Screen } from '../components/Screen';
import { SubmitButton } from '../components/SubmitButton';
import type { ReportSubmissionService } from '../services/ReportSubmissionService';
import { colors, minimumTouchTarget, radii, spacing, typography } from '../theme';

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
  const [nameKnown, setNameKnown] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState('');
  const [zone, setZone] = useState('');
  const [notes, setNotes] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const effectiveName = nameKnown ? name : '';
  const hasUnsavedChanges = nameKnown || [name, age, photoUri, description, condition, zone, notes].some(
    (value) => Boolean(value?.trim()),
  );

  async function submit(): Promise<void> {
    if (![effectiveName, age, photoUri, description, condition, zone, notes].some((value) => Boolean(value?.trim()))) {
      Alert.alert('Add one detail', 'Identity may be unknown. Add any useful description, location, or photo.');
      return;
    }
    setBusy(true);
    try {
      const result = await submissions.submitFound({
        name: effectiveName,
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
          ? 'Saved on this phone and sharing with nearby devices. It has not reached the disaster network yet. The person’s identity is not yet verified.'
          : 'Saved on this phone. ResQNet will keep trying to share it. The person’s identity is not yet verified.',
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
      title="I found someone"
      subtitle="You can report someone even when their identity is unknown."
      onBack={onBack}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <FormSection title="About the person" description="A clear photo or description can help responders compare reports.">
        <Text style={styles.choiceLabel}>Do you know their name?</Text>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ checked: !nameKnown }}
            onPress={() => setNameKnown(false)}
            style={[styles.choice, !nameKnown ? styles.choiceSelected : null]}
          >
            <Text style={[styles.choiceText, !nameKnown ? styles.choiceTextSelected : null]}>No or not sure</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ checked: nameKnown }}
            onPress={() => setNameKnown(true)}
            style={[styles.choice, nameKnown ? styles.choiceSelected : null]}
          >
            <Text style={[styles.choiceText, nameKnown ? styles.choiceTextSelected : null]}>Yes</Text>
          </TouchableOpacity>
        </View>
        {nameKnown ? (
          <FormField label="Known name" placeholder="Enter the name they gave you" value={name} onChangeText={setName} />
        ) : null}
        <PhotoField
          label="Photo"
          hint="Optional, but especially helpful when the person’s name is unknown."
          photoUri={photoUri}
          onChange={setPhotoUri}
        />
        <FormField
          label="Best estimate of age"
          keyboardType="number-pad"
          placeholder="Example: 22"
          value={age}
          onChangeText={setAge}
        />
      </FormSection>

      <FormSection title="Where are they now?">
        <FormField
          label="Hospital, camp, or current zone"
          placeholder="Example: Relief Camp 7"
          value={zone}
          onChangeText={setZone}
        />
        <FormField
          label="Physical condition"
          placeholder="Example: Stable or needs assistance"
          value={condition}
          onChangeText={setCondition}
        />
      </FormSection>

      <Disclosure
        label="Add a description or notes"
        expanded={showMore}
        onPress={() => setShowMore((current) => !current)}
      >
        <FormField
          label="Physical description"
          multiline
          placeholder="Clothing, marks, height, or other details"
          value={description}
          onChangeText={setDescription}
        />
        <FormField label="Notes" multiline placeholder="Anything else responders should know" value={notes} onChangeText={setNotes} />
      </Disclosure>

      <SubmitButton label="Save found-person report" busy={busy} color={colors.found} onPress={() => void submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  choiceLabel: {
    color: colors.text,
    ...typography.label,
    marginBottom: spacing.xs,
  },
  choices: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  choice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: minimumTouchTarget + 2,
    paddingHorizontal: spacing.sm,
  },
  choiceSelected: {
    backgroundColor: colors.info,
    borderColor: colors.info,
  },
  choiceText: {
    color: colors.text,
    ...typography.label,
    textAlign: 'center',
  },
  choiceTextSelected: {
    color: colors.onAccent,
  },
});
