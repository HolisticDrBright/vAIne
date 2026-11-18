import { describe, expect, test } from 'vitest';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import { buildAnalysisRecord, buildAnalysisRequest } from '../../analysis/analysisService';
import {
  emptyLocalProfile,
  isProfileEmpty,
  LOCAL_PROFILE_VERSION,
  parseLocalProfile,
  productDecisionsOf,
  withConsentDefaults,
  withLastCheckIn,
  withProductDecision,
  withProductSwap,
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
      productInterests: [],
      productInterestMode: 'manual' as const,
      toolsOwned: [],
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
      productInterests: [],
      productInterestMode: 'manual',
      toolsOwned: [],
    });
    expect(parseLocalProfile(legacy)?.routineIntake?.implantedDevice).toBeUndefined();
  });

  test('remembers technique answers and owned tools, rejecting unknown tools', () => {
    const base = parseLocalProfile({
      version: LOCAL_PROFILE_VERSION,
      updatedAtIso: NOW,
      routineIntake: {
        sensitivityPreference: 'standard', pregnancyOrNursing: 'no', recentProcedure: 'no', knownAllergyOrReaction: 'no',
        currentStrongActives: 'no', avoidFragrance: false, budgetPreference: 'no_limit',
        implantedDevice: 'no', lightSensitisingMedication: 'yes', activeBreakouts: 'prefer_not_to_say', recentInjectables: 'no', fragileSkinOrBloodThinners: 'no',
        seizureOrHeartCondition: 'no', rosaceaOrBrokenCapillaries: 'yes', facialSkinRightNow: 'sunburn',
        toolsOwned: ['gua_sha_tool', 'red_light_device'],
      },
      lastCheckIn: null,
      consentDefaults: null,
    });
    expect(base?.routineIntake).toMatchObject({ lightSensitisingMedication: 'yes', activeBreakouts: 'prefer_not_to_say', rosaceaOrBrokenCapillaries: 'yes', facialSkinRightNow: 'sunburn', toolsOwned: ['gua_sha_tool', 'red_light_device'] });
    const bad = JSON.parse(JSON.stringify(base));
    bad.routineIntake.toolsOwned = ['scalpel'];
    expect(parseLocalProfile(bad)).toBeNull();
    const badSkin = JSON.parse(JSON.stringify(base));
    badSkin.routineIntake.facialSkinRightNow = 'rash';
    expect(parseLocalProfile(badSkin)).toBeNull();
  });

  test('remembers shopping interests and rejects unknown product types', () => {
    const intake = {
      sensitivityPreference: 'standard' as const,
      pregnancyOrNursing: 'no' as const,
      recentProcedure: 'no' as const,
      knownAllergyOrReaction: 'no' as const,
      currentStrongActives: 'no' as const,
      avoidFragrance: false,
      budgetPreference: 'up_to_50' as const,
      routineProductCount: 4 as const,
    };
    const remembered = withRoutineIntake(emptyLocalProfile, { ...intake, productInterests: ['cleanser', 'moisturizer'] }, NOW);
    expect(remembered.routineIntake?.productInterests).toEqual(['cleanser', 'moisturizer']);
    expect(parseLocalProfile(JSON.parse(JSON.stringify(remembered)))).toEqual(remembered);

    const legacy = withRoutineIntake(emptyLocalProfile, intake, NOW);
    expect(legacy.routineIntake?.productInterests).toEqual([]);

    const tampered = JSON.parse(JSON.stringify(remembered));
    tampered.routineIntake.productInterests = ['nail polish'];
    expect(parseLocalProfile(tampered)).toBeNull();

    const auto = withRoutineIntake(emptyLocalProfile, { ...intake, productInterestMode: 'auto' }, NOW);
    expect(auto.routineIntake?.productInterestMode).toBe('auto');
    const badMode = JSON.parse(JSON.stringify(auto));
    badMode.routineIntake.productInterestMode = 'random';
    expect(parseLocalProfile(badMode)).toBeNull();
  });

  test('remembers product decisions, keeps a product in one list, and clears to empty', () => {
    let profile = withProductDecision(emptyLocalProfile, 'serum-a', 'in_protocol', NOW);
    profile = withProductDecision(profile, 'cream-b', 'not_for_me', NOW);
    expect(productDecisionsOf(profile)).toEqual({ inProtocol: ['serum-a'], notForMe: ['cream-b'] });
    expect(isProfileEmpty(profile)).toBe(false);
    expect(parseLocalProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);

    // A product moves between lists rather than appearing in both.
    profile = withProductDecision(profile, 'serum-a', 'not_for_me', NOW);
    expect(productDecisionsOf(profile)).toEqual({ inProtocol: [], notForMe: ['cream-b', 'serum-a'] });

    // A swap puts the replacement in the protocol and sets the replaced product aside.
    profile = withProductSwap(profile, 'cream-b', 'cream-c', NOW);
    expect(productDecisionsOf(profile)).toEqual({ inProtocol: ['cream-c'], notForMe: ['serum-a', 'cream-b'] });

    for (const id of ['serum-a', 'cream-b', 'cream-c']) profile = withProductDecision(profile, id, 'clear', NOW);
    expect(profile.productDecisions).toBeNull();
    expect(productDecisionsOf(profile)).toEqual({ inProtocol: [], notForMe: [] });

    // Profiles saved before decisions existed load with none.
    expect(parseLocalProfile({ ...emptyLocalProfile, productDecisions: undefined })?.productDecisions).toBeNull();
  });
});
