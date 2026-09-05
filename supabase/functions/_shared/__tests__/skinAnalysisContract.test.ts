import { describe, expect, test } from 'vitest';
import { syntheticSkinAnalysis } from '../../../../src/data/syntheticAnalysis';
import { SKIN_OBSERVATION_TAGS as APP_TAGS, SKIN_ZONES as APP_ZONES } from '../../../../src/domain/analysis/observationTaxonomy';
import { SKIN_ANALYSIS_PROMPT_VERSION as APP_PROMPT_VERSION, SKIN_ANALYSIS_SCHEMA_VERSION as APP_SCHEMA_VERSION, skinAnalysisSchema as appSchema } from '../../../../src/domain/analysis/skinAnalysisSchema';
import { CONSUMER_SKIN_SYSTEM_PROMPT as APP_PROMPT, buildSkinPromptInput as appBuildInput } from '../../../../src/domain/analysis/skinPrompt';
import {
  CONSUMER_SKIN_SYSTEM_PROMPT,
  PROVIDER_OUTPUT_JSON_SCHEMA,
  SKIN_ANALYSIS_PROMPT_VERSION,
  SKIN_ANALYSIS_SCHEMA_VERSION,
  SKIN_OBSERVATION_TAGS,
  SKIN_ZONES,
  buildSkinPromptInput,
  normalizeProviderOutput,
  skinAnalysisSchema,
} from '../skinAnalysisContract.ts';

describe('server-side skin analysis contract stays in sync with the app', () => {
  test('versions, tags, zones, and prompt text are identical', () => {
    expect(SKIN_ANALYSIS_PROMPT_VERSION).toBe(APP_PROMPT_VERSION);
    expect(SKIN_ANALYSIS_SCHEMA_VERSION).toBe(APP_SCHEMA_VERSION);
    expect([...SKIN_OBSERVATION_TAGS]).toEqual([...APP_TAGS]);
    expect([...SKIN_ZONES]).toEqual([...APP_ZONES]);
    expect(CONSUMER_SKIN_SYSTEM_PROMPT).toBe(APP_PROMPT);
    const input = { goals: ['support_hydration_look'], sensitivityPreference: 'sensitive' as const, captureAngles: ['front'] };
    expect(buildSkinPromptInput(input)).toBe(appBuildInput(input));
  });

  test('both schemas accept the synthetic fixture and reject the same bad input', () => {
    expect(() => skinAnalysisSchema.parse(syntheticSkinAnalysis)).not.toThrow();
    const bad = { ...syntheticSkinAnalysis, observationTags: ['appearance.made_up'] };
    expect(skinAnalysisSchema.safeParse(bad).success).toBe(appSchema.safeParse(bad).success);
    expect(skinAnalysisSchema.safeParse(bad).success).toBe(false);
  });

  test('the provider JSON schema uses no unsupported constraints', () => {
    const serialized = JSON.stringify(PROVIDER_OUTPUT_JSON_SCHEMA);
    expect(serialized).not.toMatch(/"minimum"|"maximum"|"minLength"|"maxLength"|"minItems"|"pattern"/);
    const objects = serialized.match(/"type":"object"/g) ?? [];
    const closed = serialized.match(/"additionalProperties":false/g) ?? [];
    expect(closed.length).toBe(objects.length);
  });
});

describe('normalizeProviderOutput', () => {
  const providerShape = {
    imageQuality: { usable: true, issues: [], retakeInstruction: null },
    summary: 'A balanced-looking baseline.',
    visibleTendencies: ['balanced_appearance'],
    facialZones: {
      forehead: { appearanceScore: 81.4, observation: 'Looks smooth in this photo.', confidence: 0.8 },
      under_eyes: null, cheeks: null, nose_t_zone: null, mouth_lips: null, jawline: null, chin: null,
    },
    appearanceScores: { overall: 120, hydrationLook: 84, toneEvennessLook: 78, textureLook: 76, radianceLook: 82, poreVisibilityLook: -5 },
    observationTags: ['appearance.hydration_look_low', 'appearance.not_a_real_tag', 'appearance.hydration_look_low'],
    tagConfidence: [{ tag: 'appearance.hydration_look_low', confidence: 1.7 }, { tag: 'bogus', confidence: 0.5 }],
    routineGoals: ['support_hydration_look'],
    professionalReview: { recommended: false, reason: null, urgency: null },
    limitations: ['Lighting can change visible appearance.'],
    overallConfidence: 0.82,
  };

  test('maps the constrained provider shape into a schema-valid analysis with server-stamped versions', () => {
    const normalized = normalizeProviderOutput(providerShape, { capturedAtIso: '2026-09-05T10:00:00.000Z', modelVersion: 'claude-sonnet-5' });
    const parsed = skinAnalysisSchema.parse(normalized);
    expect(parsed.observationTags).toEqual(['appearance.hydration_look_low']);
    expect(parsed.tagConfidence).toEqual({ 'appearance.hydration_look_low': 1 });
    expect(parsed.appearanceScores.overall).toBe(100);
    expect(parsed.appearanceScores.poreVisibilityLook).toBe(0);
    expect(parsed.facialZones.forehead?.appearanceScore).toBe(81);
    expect(parsed.facialZones.cheeks).toBeUndefined();
    expect(parsed.promptVersion).toBe(SKIN_ANALYSIS_PROMPT_VERSION);
    expect(parsed.modelVersion).toBe('claude-sonnet-5');
    expect(() => appSchema.parse(normalized)).not.toThrow();
  });

  test('falls back to a generic limitation and rejects nonsense', () => {
    const normalized = normalizeProviderOutput({ ...providerShape, limitations: [] }, { capturedAtIso: 'x', modelVersion: 'm' }) as { limitations: string[] };
    expect(normalized.limitations).toHaveLength(1);
    expect(skinAnalysisSchema.safeParse(normalizeProviderOutput('garbage', { capturedAtIso: 'x', modelVersion: 'm' })).success).toBe(false);
  });
});
