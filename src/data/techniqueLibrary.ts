import { DEVICE_AGE_GUIDANCE, techniqueSchema, type Technique } from '../domain/techniques/technique';

/**
 * Technique library.
 *
 * All five entries were reviewed and approved as written by the
 * practitioner (Dr. Bright) on 2026-11-17. The steps are low-intensity
 * movements described in cautious appearance language; the evidence notes
 * say in plain words what is and is not known. Nothing here is medical
 * guidance, a protocol, or a promise of benefit. New entries start as
 * `placeholder_awaiting_practitioner_review` and are labelled as such in the
 * app until a practitioner records a review.
 *
 * Age: the app sets no age gate. Device techniques defer to each device
 * maker's own age guidance and never claim to be safe for all ages.
 */

const REVIEWED_BY = 'Dr. Bright';
const REVIEWED_AT = '2026-11-17T00:00:00.000Z';
const approved = { reviewStatus: 'practitioner_approved' as const, reviewedBy: REVIEWED_BY, reviewedAtIso: REVIEWED_AT };

const rows: Technique[] = [
  {
    id: 'gua-sha-gentle-sweep',
    name: 'Gentle gua sha sweep',
    category: 'gua_sha',
    zones: ['cheeks', 'jawline', 'forehead'],
    observationTags: ['appearance.hydration_look_low', 'appearance.dullness_visible'],
    durationSeconds: 180,
    steps: [
      { title: 'Prepare', cue: 'Apply a few drops of facial oil so the tool glides. Hold the tool almost flat against the skin.', seconds: 30 },
      { title: 'Cheeks', cue: 'Light pressure. Sweep from beside the nose out toward the ear, five slow passes each side.', seconds: 60 },
      { title: 'Jawline', cue: 'Light pressure. Glide from the chin along the jaw toward the ear, five slow passes each side.', seconds: 60 },
      { title: 'Forehead', cue: 'Light pressure. Sweep from the brow up toward the hairline, five slow passes.', seconds: 30 },
    ],
    requiredTool: 'gua_sha_tool',
    exclusionFlags: ['active_breakout_area', 'active_infection_area', 'sunburn', 'rosacea_or_broken_capillaries', 'recent_injectables', 'fragile_skin_or_blood_thinners', 'recent_procedure', 'sensitive_skin_caution'],
    evidenceNote: 'Gentle massage may help skin look less puffy for a short while. It does not change the shape of the face, and any effect fades when you stop.',
    skipNote: 'Skip with active breakouts or broken skin, a cold sore or skin infection, sunburn, rosacea or visible broken capillaries, within 4 weeks of injectables or a procedure, with fragile skin or blood thinners, or if it ever hurts.',
    ...approved,
  },
  {
    id: 'facial-exercise-brow-and-cheek',
    name: 'Brow and cheek exercise',
    category: 'facial_exercise',
    zones: ['forehead', 'cheeks', 'under_eyes'],
    observationTags: ['appearance.dullness_visible', 'appearance.fine_lines_visible'],
    durationSeconds: 150,
    steps: [
      { title: 'Settle', cue: 'Sit comfortably with relaxed shoulders. Breathe out slowly before you begin.', seconds: 20 },
      { title: 'Brow raise', cue: 'Raise the brows gently, hold for five seconds, release fully. Repeat five times without straining.', seconds: 50 },
      { title: 'Cheek lift', cue: 'Smile softly with closed lips, hold for five seconds, release. Repeat five times.', seconds: 50 },
      { title: 'Rest', cue: 'Let the face go completely slack and breathe for a few moments.', seconds: 30 },
    ],
    requiredTool: null,
    exclusionFlags: ['recent_injectables', 'recent_procedure'],
    evidenceNote: 'Facial exercise is low risk and has a small amount of supportive research for appearance in adults when done daily over months. Results vary and need steady effort.',
    skipNote: 'Skip within 4 weeks of injectables or a procedure, and stop if the jaw or neck becomes uncomfortable.',
    ...approved,
  },
  {
    id: 'microcurrent-cheek-and-jaw',
    name: 'Microcurrent cheek and jaw pass',
    category: 'microcurrent',
    zones: ['cheeks', 'jawline'],
    observationTags: ['appearance.dullness_visible', 'appearance.hydration_look_low'],
    durationSeconds: 240,
    steps: [
      { title: 'Prepare', cue: 'Apply the conductive gel the device maker specifies. Use the lowest setting first.', seconds: 40 },
      { title: 'Cheeks', cue: 'Glide slowly from the mouth corner toward the ear, keeping both probes on the skin. Five passes each side.', seconds: 100 },
      { title: 'Jawline', cue: 'Glide from the chin along the jaw toward the ear. Five passes each side. Avoid the throat.', seconds: 100 },
    ],
    requiredTool: 'microcurrent_device',
    exclusionFlags: ['implanted_device', 'seizure_or_heart_condition', 'sunburn', 'pregnancy_caution', 'active_breakout_area', 'recent_injectables', 'recent_procedure', 'sensitive_skin_caution'],
    evidenceNote: 'Microcurrent may give a temporarily toned look; evidence that any effect outlasts the session is limited. Always follow the device maker’s directions, including any areas the manual says to avoid.',
    skipNote: `Never with a pacemaker or any implanted electrical device, a seizure history, or a heart condition. Skip during pregnancy, on sunburned skin, over breakouts, within 4 weeks of injectables or a procedure, and keep away from the eyes. ${DEVICE_AGE_GUIDANCE}`,
    ...approved,
  },
  {
    id: 'red-light-face-session',
    name: 'Red light face session',
    category: 'red_light',
    zones: ['forehead', 'cheeks', 'chin', 'jawline'],
    observationTags: ['appearance.fine_lines_visible', 'appearance.texture_irregular'],
    durationSeconds: 600,
    steps: [
      { title: 'Prepare', cue: 'Clean, dry skin with no product on. Follow the device maker’s eye protection directions before switching it on.', seconds: 60 },
      { title: 'Session', cue: 'Position the mask or panel as the maker directs and stay still. Keep eyes closed if the device requires it.', seconds: 540 },
    ],
    requiredTool: 'red_light_device',
    exclusionFlags: ['photosensitising_medication', 'recent_procedure'],
    evidenceNote: 'Red light has growing evidence for texture and fine-line appearance with steady use over weeks; results vary by device and fade without continued use.',
    skipNote: `Skip while taking a medication, or living with a condition, that makes skin more sensitive to light, and for 4 weeks after a procedure. Follow the device maker’s eye protection directions every time. ${DEVICE_AGE_GUIDANCE}`,
    ...approved,
  },
  {
    id: 'cupping-light-glide',
    name: 'Light facial cupping glide',
    category: 'cupping',
    zones: ['cheeks', 'jawline', 'forehead'],
    observationTags: ['appearance.dullness_visible'],
    durationSeconds: 150,
    steps: [
      { title: 'Prepare', cue: 'Apply facial oil generously. Use the smallest cup with the lightest suction.', seconds: 30 },
      { title: 'Cheeks', cue: 'Keep the cup moving at all times. Glide from the nose toward the ear, three passes each side.', seconds: 60 },
      { title: 'Jaw and brow', cue: 'Keep the cup moving. Glide along the jaw, then across the brow. Never hold the cup still.', seconds: 60 },
    ],
    requiredTool: 'facial_cups',
    exclusionFlags: ['fragile_skin_or_blood_thinners', 'rosacea_or_broken_capillaries', 'active_breakout_area', 'active_infection_area', 'sunburn', 'recent_injectables', 'recent_procedure', 'sensitive_skin_caution'],
    evidenceNote: 'Light cupping may give a short-lived flush and a less puffy look; evidence is weak, and a cup held still can bruise.',
    skipNote: 'Skip with thin or fragile skin, blood thinners, rosacea or visible broken capillaries, breakouts, a cold sore or skin infection, sunburn, and within 4 weeks of injectables or a procedure. Stop at once if the skin marks.',
    ...approved,
  },
];

export const techniqueLibrary: readonly Technique[] = rows.map((row) => techniqueSchema.parse(row));
