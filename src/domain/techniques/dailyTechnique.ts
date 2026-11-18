import type { SkinObservationTag } from '../analysis/observationTaxonomy';
import type { Technique, TechniqueTool } from './technique';
import { rankEligibleTechniques, type RankedTechnique, type TechniqueSafetyProfile } from './techniqueEligibility';

/**
 * One technique session per day for the daily plan.
 *
 * Only techniques the person can actually do today are candidates: eligible
 * and either needing no tool or a tool they own. Among those, the choice
 * rotates by calendar date so a week of plans varies without any state to
 * store, and the same date always yields the same session.
 */

export type NoTechniqueReason = 'no_eligible_technique' | 'no_owned_tool' | 'library_empty' | 'professional_review_pending';

export interface DailyTechniquePick {
  session: RankedTechnique | null;
  reason: NoTechniqueReason | null;
  /** Eligible techniques that need a tool the person does not own, for the "get the tool" placeholder. */
  needsTool: readonly RankedTechnique[];
}

function dayIndex(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, (month || 1) - 1, day || 1) / 86_400_000);
}

export function pickDailyTechnique(
  techniques: readonly Technique[],
  profile: TechniqueSafetyProfile,
  requestedTags: readonly SkinObservationTag[],
  toolsOwned: readonly TechniqueTool[],
  dateKey: string,
): DailyTechniquePick {
  if (!techniques.length) return { session: null, reason: 'library_empty', needsTool: [] };
  if (profile.professionalReviewRecommended) return { session: null, reason: 'professional_review_pending', needsTool: [] };
  const ranked = rankEligibleTechniques(techniques, profile, requestedTags, toolsOwned);
  if (!ranked.length) return { session: null, reason: 'no_eligible_technique', needsTool: [] };
  const doable = ranked.filter((entry) => entry.toolOwned);
  const needsTool = ranked.filter((entry) => !entry.toolOwned);
  if (!doable.length) return { session: null, reason: 'no_owned_tool', needsTool };
  // Prefer goal matches when any exist, then rotate within that set by date.
  const best = doable.filter((entry) => entry.eligibility.matchedTags.length > 0);
  const pool = best.length ? best : doable;
  return { session: pool[dayIndex(dateKey) % pool.length], reason: null, needsTool };
}

export const noTechniqueReasonCopy: Record<NoTechniqueReason, string> = {
  no_eligible_technique: 'No technique is offered with your current safety answers. Products and daily protection continue as usual.',
  no_owned_tool: 'The techniques that fit you need a tool you have not marked as owned. Facial exercise needs none; others show a tool placeholder.',
  library_empty: 'No techniques are available yet.',
  professional_review_pending: 'Your latest check-in suggested having an area looked at by a professional, so every technique is paused until that has happened. Products and daily protection continue as usual.',
};
