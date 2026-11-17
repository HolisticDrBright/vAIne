import { techniqueSchema, type Technique } from '../domain/techniques/technique';

/**
 * Placeholder technique library.
 *
 * Every entry is synthetic sample content awaiting practitioner review and
 * is labelled as such in the app. The steps are generic, low-intensity
 * movements in cautious appearance language. They are not medical guidance,
 * not a protocol, and not evidence of benefit; the evidence notes say what
 * is and is not known in plain words. Before any entry can become
 * `practitioner_approved`, the reviewing practitioner replaces the steps,
 * cues, skip note, and evidence note and records the review date.
 */

const PLACEHOLDER = 'placeholder_awaiting_practitioner_review' as const;

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
    exclusionFlags: ['active_breakout_area', 'recent_injectables', 'fragile_skin_or_blood_thinners', 'recent_procedure', 'sensitive_skin_caution'],
    evidenceNote: 'Placeholder note. Gentle massage may help skin look less puffy for a short while. It does not change the shape of the face, and this entry has not been reviewed by a practitioner.',
    skipNote: 'Skip with active breakouts or broken skin, in the weeks after injectables, with fragile skin or blood thinners, after a recent procedure, or if it ever hurts.',
    reviewStatus: PLACEHOLDER,
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
    evidenceNote: 'Placeholder note. Facial exercise is low risk and has a small amount of supportive research for appearance in adults when done daily over months. This entry has not been reviewed by a practitioner.',
    skipNote: 'Skip in the weeks after injectables or a procedure, and stop if the jaw or neck becomes uncomfortable.',
    reviewStatus: PLACEHOLDER,
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
    exclusionFlags: ['implanted_device', 'pregnancy_caution', 'active_breakout_area', 'recent_injectables', 'recent_procedure', 'sensitive_skin_caution'],
    evidenceNote: 'Placeholder note. Microcurrent may give a temporarily toned look; evidence that any effect outlasts the session is limited. Always follow the device maker’s directions. This entry has not been reviewed by a practitioner.',
    skipNote: 'Never with a pacemaker or any implanted electrical device. Skip during pregnancy, with epilepsy, over breakouts, after injectables or a procedure, and keep away from the eyes.',
    reviewStatus: PLACEHOLDER,
  },
  {
    id: 'red-light-face-session',
    name: 'Red light face session',
    category: 'red_light',
    zones: ['forehead', 'cheeks', 'chin', 'jawline'],
    observationTags: ['appearance.fine_lines_visible', 'appearance.texture_irregular'],
    durationSeconds: 600,
    steps: [
      { title: 'Prepare', cue: 'Clean, dry skin with no product on. Put on the eye protection supplied with the device.', seconds: 60 },
      { title: 'Session', cue: 'Position the mask or panel as the maker directs and stay still. Keep eyes closed if the device requires it.', seconds: 540 },
    ],
    requiredTool: 'red_light_device',
    exclusionFlags: ['photosensitising_medication', 'recent_procedure'],
    evidenceNote: 'Placeholder note. Red light has growing evidence for texture and fine-line appearance with steady use over weeks; results vary by device. This entry has not been reviewed by a practitioner.',
    skipNote: 'Skip while taking a light-sensitising medication, with an eye condition unless cleared by a professional, and after a recent procedure. Always use eye protection.',
    reviewStatus: PLACEHOLDER,
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
    exclusionFlags: ['fragile_skin_or_blood_thinners', 'active_breakout_area', 'recent_injectables', 'recent_procedure', 'sensitive_skin_caution'],
    evidenceNote: 'Placeholder note. Light cupping may give a short-lived flush and a less puffy look; evidence is weak and a cup held still can bruise. This entry has not been reviewed by a practitioner.',
    skipNote: 'Skip with thin or fragile skin, blood thinners, visible broken capillaries, breakouts, after injectables or a procedure. Stop at once if the skin marks.',
    reviewStatus: PLACEHOLDER,
  },
];

export const techniqueLibrary: readonly Technique[] = rows.map((row) => techniqueSchema.parse(row));
