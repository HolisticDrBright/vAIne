/**
 * TestFlight-only catalog widening.
 *
 * The source workbook remains the authority and these rows do not become
 * `catalog_approved`. The beta profile may temporarily make sufficiently
 * identified, single-product topicals available as labelled research
 * previews so matching, budget, and routine behavior can be exercised.
 *
 * Known hard blockers, missing/discontinued products, devices, supplements,
 * bundles, and body care remain unavailable. Face sunscreens still under
 * review are previewed like other topicals, with a reminder that a US
 * sunscreen is an OTC drug whose Drug Facts panel is on the pack; sunscreens
 * whose review recorded a blocker (no Drug Facts panel, delisted) stay out.
 */

const missingProductPattern = /NOT FOUND|DOES NOT EXIST|discontinued/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function applyBetaCatalogTestingOverride(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;

  const facegevity = entry.productId === 'healthgevity-facegevity';
  const ordinaryResearchPreview = entry.catalogState === 'research_only';
  const blocker = typeof entry.blocker === 'string' ? entry.blocker : '';
  const sufficientlyIdentifiedTopical =
    entry.active === true &&
    entry.productKind === 'single' &&
    typeof entry.routineSlot === 'string' &&
    entry.availabilityStatus !== 'discontinued' &&
    !missingProductPattern.test(blocker);

  if (!sufficientlyIdentifiedTopical || (!facegevity && !ordinaryResearchPreview)) return entry;
  if (!facegevity && entry.evidenceReviewStatus === 'approved') return entry;

  const sourceNotes = isRecord(entry.sourceNotes) ? entry.sourceNotes : {};
  const existingNote = typeof sourceNotes.notes === 'string' && sourceNotes.notes.trim()
    ? ` ${sourceNotes.notes.trim()}`
    : '';
  const reviewNote = blocker
    ? ` Pending review note: ${blocker.replace(/^BLOCKER:\s*/i, '').trim()}`
    : '';
  const sunscreenNote = entry.routineSlot === 'protect'
    ? ' Sunscreen preview: a US sunscreen is an over-the-counter drug; check the Drug Facts panel on the pack for the SPF, broad-spectrum statement, and directions before relying on it.'
    : '';

  return {
    ...entry,
    catalogState: 'research_only',
    evidenceReviewStatus: 'approved',
    availabilityStatus: entry.availabilityStatus === 'unknown' ? 'available' : entry.availabilityStatus,
    blocker: null,
    sourceNotes: {
      ...sourceNotes,
      notes: `Beta-only research preview; not catalog-approved.${sunscreenNote}${reviewNote}${existingNote}`,
    },
  };
}

export const betaCatalogTestingEnabled = process.env.EXPO_PUBLIC_CATALOG_MODE === 'research_preview';
