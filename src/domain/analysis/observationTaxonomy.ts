/**
 * Consumer-safe visible skin observations.
 *
 * This allow-list is intentionally limited to what can be described from a
 * photograph. It excludes nutrient, organ, disease, systemic, psychological,
 * and cross-modality conclusions.
 */
export const SKIN_OBSERVATION_TAGS = [
  'appearance.hydration_look_low',
  'appearance.visible_redness',
  'appearance.tone_uneven',
  'appearance.texture_irregular',
  'appearance.pore_visibility_high',
  'appearance.fine_lines_visible',
  'appearance.oiliness_visible',
  'appearance.dullness_visible',
  'appearance.dark_circles_visible',
  'appearance.blemishes_visible',
  'appearance.lip_dryness_visible',
  'appearance.sun_exposure_signs_visible',
  'referral.consider_professional_review',
] as const;

export type SkinObservationTag = typeof SKIN_OBSERVATION_TAGS[number];

const tagSet = new Set<string>(SKIN_OBSERVATION_TAGS);

export function isSkinObservationTag(tag: string): tag is SkinObservationTag {
  return tagSet.has(tag);
}

export function filterSkinObservationTags(tags: readonly string[]): SkinObservationTag[] {
  return tags.filter(isSkinObservationTag);
}

export function filterTagConfidence(
  values: Readonly<Record<string, number>>,
): Partial<Record<SkinObservationTag, number>> {
  const accepted: Partial<Record<SkinObservationTag, number>> = {};

  for (const [tag, rawConfidence] of Object.entries(values)) {
    if (!isSkinObservationTag(tag)) continue;
    const confidence = Number(rawConfidence);
    accepted[tag] = Number.isFinite(confidence)
      ? Math.max(0, Math.min(1, confidence))
      : 0;
  }

  return accepted;
}

export const SKIN_ZONES = [
  'forehead',
  'under_eyes',
  'cheeks',
  'nose_t_zone',
  'mouth_lips',
  'jawline',
  'chin',
] as const;

export type SkinZone = typeof SKIN_ZONES[number];

export const SKIN_CAPTURE_ANGLES = ['front', 'left_profile', 'right_profile'] as const;
export type SkinCaptureAngle = typeof SKIN_CAPTURE_ANGLES[number];
