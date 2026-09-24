/** Sourcing Map theme (spec §9.1): dark by default, light on the toggle. */
export type SmTheme = 'dark' | 'light';

type SmTokenName =
  | 'canvas' | 'surface' | 'card' | 'line' | 'line-2'
  | 'ink' | 'ink-2' | 'teal' | 'teal-text' | 'orange' | 'orange-text' | 'red' | 'red-text' | 'success-text' | 'warn-text'
  | 'heat-good' | 'heat-mid' | 'heat-bad' | 'gap-border';

/**
 * Dark: spec §9.1 verbatim; red text #F87171 per contract §2.
 * Light: the console's tokens where they pass AA; ink-2, red-text and
 * orange-text are darkened because the console's slate (4.16), #DC2626 (4.22)
 * and #B45309 (4.38) fail on the light canvas #ECF0F4 (measured).
 */
export const SM_THEME_TOKENS: Record<SmTheme, Record<SmTokenName, string>> = {
  dark: {
    canvas: '#10132A', surface: '#1A1F36', card: '#212846', line: '#2B3252', 'line-2': '#34405F',
    ink: '#E8EBF0', 'ink-2': '#B9C2CC',
    teal: '#29B0C3', 'teal-text': '#7FD3DF', orange: '#F58220', 'orange-text': '#F7A25A', red: '#DC2626', 'red-text': '#F87171',
    'success-text': '#34D399', 'warn-text': '#FBBF24',
    'heat-good': '#29B0C3', 'heat-mid': '#F58220', 'heat-bad': '#F87171', 'gap-border': '#6B7896',
  },
  light: {
    canvas: '#ECF0F4', surface: '#FFFFFF', card: '#FFFFFF', line: '#CBD5E1', 'line-2': '#94A3B8',
    ink: '#1A1F36', 'ink-2': '#475569',
    teal: '#29B0C3', 'teal-text': '#007585', orange: '#F58220', 'orange-text': '#C2410C', red: '#DC2626', 'red-text': '#B91C1C',
    'success-text': '#047857', 'warn-text': '#92400E',
    'heat-good': '#007585', 'heat-mid': '#C2410C', 'heat-bad': '#B91C1C', 'gap-border': '#64748B',
  },
};

/** The header stays dark in both themes: the reversed logo needs a dark ground (spec §2 ruling 5). */
export const SM_HEADER = { bg: '#1A1F36', ink: '#E8EBF0', ink2: '#B9C2CC' } as const;

/** Primary buttons: navy text on teal (7.05:1). */
export const SM_BUTTON_PRIMARY_FG = '#10132A';

/** <Pill> tones (src/components/pill.tsx TONE_CLASS keys), themed through --sm-pill-<tone>-bg/fg. */
export const SM_PILL_TONES = ['success', 'warn', 'problem', 'info', 'neutral', 'stock'] as const;
export type SmPillTone = (typeof SM_PILL_TONES)[number];

export const SM_PILL_TOKENS: Record<SmTheme, Record<SmPillTone, { bg: string; fg: string }>> = {
  dark: {
    success: { bg: '#123D35', fg: '#6EE7B7' },
    warn: { bg: '#3D3113', fg: '#FCD34D' },
    problem: { bg: '#3F1D29', fg: '#FCA5A5' },
    info: { bg: '#123A47', fg: '#7FD3DF' },
    neutral: { bg: '#2B3252', fg: '#C9D1DA' },
    stock: { bg: '#047857', fg: '#FFFFFF' },
  },
  light: {
    success: { bg: '#E3F4EC', fg: '#046C4E' },
    warn: { bg: '#FDF1D8', fg: '#8A4B08' },
    problem: { bg: '#FDE8E8', fg: '#B91C1C' },
    info: { bg: '#E0F2F5', fg: '#006170' },
    neutral: { bg: '#EEF1F5', fg: '#475569' },
    stock: { bg: '#047857', fg: '#FFFFFF' },
  },
};
