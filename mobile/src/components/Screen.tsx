import { useCallback, useEffect, type ReactNode } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  layout,
  minimumTouchTarget,
  radii,
  spacing,
  typography,
} from '../theme';

export interface ScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  hasUnsavedChanges?: boolean;
}

export function Screen({
  title,
  subtitle,
  children,
  onBack,
  hasUnsavedChanges = false,
}: ScreenProps) {
  const requestBack = useCallback(() => {
    if (!onBack) {
      return;
    }
    if (!hasUnsavedChanges) {
      onBack();
      return;
    }

    Alert.alert(
      'Discard this report?',
      'Information entered on this screen has not been saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onBack },
      ],
    );
  }, [hasUnsavedChanges, onBack]);

  useEffect(() => {
    if (!onBack) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack, requestBack]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardArea}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              {onBack ? (
                <Pressable
                  accessibilityHint={hasUnsavedChanges ? 'You will be asked before unsaved information is discarded' : undefined}
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                  hitSlop={4}
                  onPress={requestBack}
                  style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
                >
                  <Text style={styles.backText}>‹ Back</Text>
                </Pressable>
              ) : null}
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenGutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    minHeight: minimumTouchTarget,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: radii.sm,
    marginBottom: spacing.xxs,
    marginLeft: -spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  backButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  backText: {
    color: colors.primary,
    ...typography.bodyStrong,
  },
  title: {
    color: colors.textStrong,
    ...typography.screenTitle,
  },
  subtitle: {
    color: colors.muted,
    ...typography.body,
    marginTop: spacing.xs,
    maxWidth: 620,
  },
});
