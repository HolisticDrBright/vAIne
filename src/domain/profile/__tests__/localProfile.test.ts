import { describe, expect, test } from 'vitest';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import { buildAnalysisRecord, buildAnalysisRequest } from '../../analysis/analysisService';
import {
  emptyLocalProfile,
  isProfileEmpty,
  LOCAL_PROFILE_VERSION,
  parseLocalProfile,
  withConsentDefaults,
  withLastCheckIn,
  withRoutineIntake,
} from '../localProfile';

const NOW = '2026-09-04T12:00:00.000Z';

function sampleRecord() {
  return buildAnalysisRecord({
    request: buildAnalysisRequest([
      { angle: 'front', uri: 'file:///cache/front.jpg', width: 1200, height: 1600, capturedAtIso: NOW },
    ], NOW),
    result: syntheticSkinAnalysis,
    descriptor: { id: 'synthetic-prototype', mode: 'synthetic_demo' },
    completedAtIso: NOW,
    qualityDecision: 'accepted',
  });
}

describe('local profile', () => {
  test('starts empty and reports emptiness', () => {
    expect(isProfileEmpty(emptyLocalProfile)).toBe(true);
    expect(parseLocalProfile(emptyLocalProfile)).toEqual(emptyLocalProfile);
  });

  test('remembers routine answers, a photo-free check-in, and consent defaults', () => {
    const intake = {
      sensitivityPreference: 'sensitive' as const,
      pregnancyOrNursing: 'no' as const,
      recentProcedure: 'no' as const,
      knownAllergyOrReaction: 'yes' as const,
      currentStrongActives: 'no' as const,
      avoidFragrance: true,
      budgetPreference: 'up_to_50' as const,
      routineProductCount: 6 as const,
      avoidIngredients: ['lanolin'],
      currentActiveFamilies: [],
    };
    let profile = withRoutineIntake(emptyLocalProfile, intake, NOW);
    profile = withLastCheckIn(profile, sampleRecord(), NOW);
    profile = withConsentDefaults(profile, { progressTracking: true }, NOW);

    const roundTrip = parseLocalProfile(JSON.parse(JSON.stringify(profile)));
    expect(roundTrip?.routineIntake).toEqual(intake);
    expect(roundTrip?.lastCheckIn?.result.appearanceScores.overall).toBe(syntheticSkinAnalysis.appearanceScores.overall);
    expect(roundTrip?.consentDefaults).toEqual({ progressTracking: true });
    expect(isProfileEmpty(roundTrip!)).toBe(false);
  });

  test('strips capture URIs when remembering a check-in', () => {
    const profile = withLastCheckIn(emptyLocalProfile, sampleRecord(), NOW);
    expect(JSON.stringify(profile)).not.toMatch(/file:\/\/|uri/i);
    expect(profile.lastCheckIn?.captures[0]).toEqual({ angle: 'front', width: 1200, height: 1600, capturedAtIso: NOW });
  });

  test('rejects unknown versions, unknown fields, and image-like content', () => {
    expect(parseLocalProfile({ ...emptyLocalProfile, version: 'local_profile_v0' })).toBeNull();
    expect(parseLocalProfile({ ...emptyLocalProfile, photo: 'x' })).toBeNull();
    expect(parseLocalProfile({
      ...withLastCheckIn(emptyLocalProfile, sampleRecord(), NOW),
      lastCheckIn: { ...withLastCheckIn(emptyLocalProfile, sampleRecord(), NOW).lastCheckIn, providerId: 'file:///leak' },
    })).toBeNull();
    expect(parseLocalProfile(null)).toBeNull();
    expect(parseLocalProfile('{}')).toBeNull();
  });

  test('defaults the new list fields for profiles saved before they existed', () => {
    const legacy = {
      version: LOCAL_PROFILE_VERSION,
      updatedAtIso: NOW,
      routineIntake: {
        sensitivityPreference: 'standard',
        pregnancyOrNursing: 'no',
        recentProcedure: 'no',
        knownAllergyOrReaction: 'no',
        currentStrongActives: 'no',
        avoidFragrance: false,
        budgetPreference: 'no_limit',
      },
      lastCheckIn: null,
      consentDefaults: null,
    };
    expect(parseLocalProfile(legacy)?.routineIntake).toMatchObject({
      avoidIngredients: [],
      currentActiveFamilies: [],
      routineProductCount: 4,
    });
  });
});
