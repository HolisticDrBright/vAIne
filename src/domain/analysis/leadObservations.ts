import type { SkinObservationTag } from './observationTaxonomy';
import type { SkinAnalysis } from './skinAnalysisSchema';

/**
 * The two or three plain-language observations that open the overview.
 *
 * The score is deliberately not the headline: a number invites comparison
 * and score-chasing, and it moves with lighting. Observations are what the
 * person can actually act on. Each line is a fixed, reviewed sentence keyed
 * by observation tag, so the wording is always cosmetic "looks" language and
 * never a conclusion about health. When a result carries fewer than two tags,
 * the lowest-scoring facial zones supply their own validated observation
 * text, and a balanced result says so.
 */

export interface LeadObservation {
  id: string;
  text: string;
  /** 0..1 confidence from the result, or null when the source has none. */
  confidence: number | null;
  source: 'tag' | 'zone' | 'tendency';
}

export const MIN_LEAD_OBSERVATIONS = 2;
export const MAX_LEAD_OBSERVATIONS = 3;

/**
 * Consumer-safe sentence for each observation tag. Every line describes what
 * is visible in the photograph and nothing more. The referral tag is handled
 * by the professional-review card, not here.
 */
export const LEAD_OBSERVATION_COPY: Record<Exclude<SkinObservationTag, 'referral.consider_professional_review'>, string> = {
  'appearance.hydration_look_low': 'Skin looks like it could use more hydration.',
  'appearance.visible_redness': 'Some redness is visible in this photograph.',
  'appearance.tone_uneven': 'Tone looks a little uneven across the face.',
  'appearance.texture_irregular': 'Surface texture looks slightly irregular.',
  'appearance.pore_visibility_high': 'Pores look more visible, mainly around the T-zone.',
  'appearance.fine_lines_visible': 'Fine lines are visible in this photograph.',
  'appearance.oiliness_visible': 'Some surface shine is visible.',
  'appearance.dullness_visible': 'Skin looks a little dull in this light.',
  'appearance.dark_circles_visible': 'The under-eye area looks a little shadowed.',
  'appearance.blemishes_visible': 'A few blemishes are visible.',
  'appearance.lip_dryness_visible': 'The lips look a little dry.',
  'appearance.sun_exposure_signs_visible': 'Signs of sun exposure are visible.',
};

const ZONE_LABELS: Record<keyof SkinAnalysis['facialZones'], string> = {
  forehead: 'Forehead',
  under_eyes: 'Under eyes',
  cheeks: 'Cheeks',
  nose_t_zone: 'Nose and T-zone',
  mouth_lips: 'Mouth and lips',
  jawline: 'Jawline',
  chin: 'Chin',
};

function isLeadTag(tag: SkinObservationTag): tag is keyof typeof LEAD_OBSERVATION_COPY {
  return tag in LEAD_OBSERVATION_COPY;
}

export function leadObservations(result: SkinAnalysis): LeadObservation[] {
  const fromTags: LeadObservation[] = result.observationTags
    .filter(isLeadTag)
    .map((tag) => ({
      id: tag,
      text: LEAD_OBSERVATION_COPY[tag],
      confidence: result.tagConfidence[tag] ?? null,
      source: 'tag' as const,
    }))
    // Most confident first; ties keep the result's own order.
    .sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))
    .slice(0, MAX_LEAD_OBSERVATIONS);

  if (fromTags.length >= MIN_LEAD_OBSERVATIONS) return fromTags;

  // Fill from the zones with the most room to support, using the result's
  // own validated observation text so nothing new is asserted here.
  const zones = (Object.entries(result.facialZones) as [keyof SkinAnalysis['facialZones'], NonNullable<SkinAnalysis['facialZones'][keyof SkinAnalysis['facialZones']]>][])
    .filter(([, zone]) => zone !== undefined)
    .sort(([, left], [, right]) => left.appearanceScore - right.appearanceScore);
  const fromZones: LeadObservation[] = zones.map(([key, zone]) => ({
    id: `zone:${key}`,
    text: `${ZONE_LABELS[key]}: ${zone.observation}`,
    confidence: zone.confidence,
    source: 'zone' as const,
  }));

  const combined = [...fromTags];
  for (const zone of fromZones) {
    if (combined.length >= MIN_LEAD_OBSERVATIONS) break;
    combined.push(zone);
  }

  if (combined.length < MIN_LEAD_OBSERVATIONS && result.visibleTendencies.includes('balanced_appearance')) {
    combined.push({
      id: 'tendency:balanced',
      text: 'Overall, skin looks balanced in this photograph.',
      confidence: null,
      source: 'tendency',
    });
  }

  return combined.slice(0, MAX_LEAD_OBSERVATIONS);
}

/** "82%" style confidence for a lead line, or null when there is none to show. */
export function formatObservationConfidence(confidence: number | null): string | null {
  if (confidence === null || !Number.isFinite(confidence)) return null;
  return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}% confidence`;
}
