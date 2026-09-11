/**
 * ResQNet's mobile design tokens.
 *
 * The palette is intentionally restrained: colour communicates an action or a
 * verified state, while neutral surfaces carry the rest of the interface.
 */
export const colors = {
  background: '#F4F6F8',
  surface: '#FBFCFD',
  surfaceMuted: '#EDF1F5',
  surfacePressed: '#E5EAF0',
  text: '#172033',
  textStrong: '#101828',
  muted: '#5B6678',
  placeholder: '#697586',
  border: '#D5DCE5',
  borderStrong: '#AEB8C6',

  primary: '#23577A',
  primaryPressed: '#183F5C',
  primaryTint: '#E8F1F7',
  focus: '#2876A8',

  safe: '#157454',
  safeTint: '#E5F4ED',
  missing: '#B3262E',
  missingTint: '#FAEAEC',
  found: '#245F86',
  foundTint: '#E8F1F7',
  sighting: '#895212',
  sightingTint: '#F8EFE2',

  warning: '#805511',
  warningTint: '#FBF1D9',
  danger: '#B3261E',
  dangerTint: '#FCEBE9',
  info: '#245F86',
  infoTint: '#E8F1F7',
  isolated: '#B3261E',

  disabledSurface: '#E2E7ED',
  disabledText: '#747F90',
  onAccent: '#F9FBFC',
  overlay: '#FBF1D9',
  scrim: 'rgba(16, 24, 40, 0.48)',
} as const;

export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  screenTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400',
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
} as const;

export const minimumTouchTarget = 48;

export const layout = {
  screenGutter: spacing.lg,
  maxContentWidth: 720,
} as const;
