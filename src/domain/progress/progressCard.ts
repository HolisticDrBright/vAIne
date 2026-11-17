import type { LeadObservation } from '../analysis/leadObservations';
import type { FramingMatchResult } from './framingMatch';
import type { StreakSummary } from '../profile/planStreak';

/**
 * The shareable progress card.
 *
 * It shows consistency, not a rating: days of care, the period covered, the
 * appearance areas being supported, and whether the latest photos were
 * framed to match. It never carries a score, a rank, or a comparison with
 * anyone else, and it only carries the person's photographs when they have
 * chosen to include them. Sample content is labelled as fictional on the
 * card itself, so a shared image cannot pass as a real analysis.
 */

export interface ProgressCardInput {
  todayIso: string;
  /** When tracking began: the baseline's save date, or the remembered check-in. */
  sinceIso: string | null;
  streak: StreakSummary;
  /** Lead observations from the latest result; the card keeps at most two as focus areas. */
  observations: readonly LeadObservation[];
  framing: FramingMatchResult | null;
  /** False when the result is the labelled synthetic sample. */
  live: boolean;
  includeFace: boolean;
  photos: { baselineUri: string; currentUri: string } | null;
}

export interface ProgressCardModel {
  eyebrow: string;
  headline: string;
  periodLabel: string;
  stats: readonly { label: string; value: string }[];
  focus: readonly string[];
  framingLabel: string | null;
  photos: { baselineUri: string; currentUri: string } | null;
  footer: string;
  /** Caption offered alongside the image; same rules as the card. */
  shareText: string;
}

export const MAX_FOCUS_AREAS = 2;

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/** Turns a lead sentence into a short focus label: "Skin looks like it could use more hydration." → "Hydration". */
export function focusLabel(observation: LeadObservation): string {
  const byId: Record<string, string> = {
    'appearance.hydration_look_low': 'Hydration',
    'appearance.visible_redness': 'Calm',
    'appearance.tone_uneven': 'Even tone',
    'appearance.texture_irregular': 'Smooth texture',
    'appearance.pore_visibility_high': 'Pore appearance',
    'appearance.fine_lines_visible': 'Fine lines',
    'appearance.oiliness_visible': 'Balance',
    'appearance.dullness_visible': 'Radiance',
    'appearance.dark_circles_visible': 'Under-eye',
    'appearance.blemishes_visible': 'Clear look',
    'appearance.lip_dryness_visible': 'Lip comfort',
    'appearance.sun_exposure_signs_visible': 'Sun protection',
  };
  if (observation.id in byId) return byId[observation.id];
  if (observation.id.startsWith('zone:')) return observation.id.slice(5).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return 'Balanced care';
}

export function buildProgressCard(input: ProgressCardInput): ProgressCardModel {
  const days = input.sinceIso ? daysBetween(input.sinceIso, input.todayIso) : 0;
  const headline = input.streak.current >= 2
    ? `${input.streak.current} days of consistent care`
    : input.streak.doneToday
      ? 'Day one, done'
      : days > 0
        ? `${days} day${days === 1 ? '' : 's'} of showing up`
        : 'A fresh start';
  const periodLabel = input.sinceIso && days > 0 ? `Since ${formatDay(input.sinceIso)}` : 'First check-in today';

  const stats = [
    { label: 'Streak', value: `${input.streak.current} day${input.streak.current === 1 ? '' : 's'}` },
    { label: 'Best', value: `${input.streak.longest} day${input.streak.longest === 1 ? '' : 's'}` },
    { label: 'Plan days', value: `${input.streak.totalDays}` },
  ];

  const focus = [...new Set(input.observations.map(focusLabel))].slice(0, MAX_FOCUS_AREAS);
  const framingLabel = input.framing?.kind === 'matched' ? 'Photos framed to match' : null;
  const photos = input.includeFace && input.photos ? input.photos : null;
  const footer = input.live
    ? 'Visible appearance only · not a diagnosis · vAIne'
    : 'Fictional sample · not photo analysis · vAIne';
  const shareText = input.live
    ? `${headline} with vAIne. Visible appearance only, not a diagnosis.`
    : `${headline} with vAIne (sample content, not a real analysis).`;

  return {
    eyebrow: input.live ? 'MY SKIN CARE PROGRESS' : 'SAMPLE PROGRESS CARD',
    headline,
    periodLabel,
    stats,
    focus,
    framingLabel,
    photos,
    footer,
    shareText,
  };
}
