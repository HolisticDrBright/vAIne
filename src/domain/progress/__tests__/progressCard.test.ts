import { describe, expect, test } from 'vitest';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import { leadObservations } from '../../analysis/leadObservations';
import { MAX_FOCUS_AREAS, buildProgressCard, focusLabel, type ProgressCardInput } from '../progressCard';

const photos = { baselineUri: 'file:///app/baseline/front.jpg', currentUri: 'file:///cache/front.jpg' };

const base: ProgressCardInput = {
  todayIso: '2026-11-17T09:00:00.000Z',
  sinceIso: '2026-11-03T09:00:00.000Z',
  streak: { current: 5, longest: 7, doneToday: true, totalDays: 12 },
  observations: leadObservations(syntheticSkinAnalysis),
  framing: { kind: 'matched', centerOffset: 0.01, sizeRatio: 1, rollDelta: 0 },
  live: true,
  includeFace: false,
  photos,
};

describe('progress card', () => {
  test('shows consistency, never a score or rank', () => {
    const card = buildProgressCard(base);
    const text = JSON.stringify(card);
    expect(card.headline).toBe('5 days of consistent care');
    expect(card.periodLabel).toBe('Since Nov 3');
    expect(card.stats.map((item) => item.value)).toEqual(['5 days', '7 days', '12']);
    expect(text).not.toMatch(/\/100|score|rank|rating|percentile|better than/i);
    expect(text).not.toMatch(/diagnos(?!is)|disease|treat|cure/i);
  });

  test('keeps the face out unless the person chooses to include it', () => {
    expect(buildProgressCard(base).photos).toBeNull();
    expect(JSON.stringify(buildProgressCard(base))).not.toMatch(/file:/);
    expect(buildProgressCard({ ...base, includeFace: true }).photos).toEqual(photos);
    expect(buildProgressCard({ ...base, includeFace: true, photos: null }).photos).toBeNull();
  });

  test('labels sample content as fictional on the card and in the caption', () => {
    const sample = buildProgressCard({ ...base, live: false });
    expect(sample.eyebrow).toBe('SAMPLE PROGRESS CARD');
    expect(sample.footer).toMatch(/Fictional sample/);
    expect(sample.shareText).toMatch(/sample content, not a real analysis/);
    const live = buildProgressCard(base);
    expect(live.footer).toMatch(/not a diagnosis/);
    expect(live.shareText).toMatch(/not a diagnosis/);
  });

  test('turns the lead observations into at most two short focus areas', () => {
    const card = buildProgressCard(base);
    expect(card.focus).toEqual(['Pore appearance', 'Hydration']);
    expect(card.focus.length).toBeLessThanOrEqual(MAX_FOCUS_AREAS);
    expect(focusLabel({ id: 'zone:under_eyes', text: 'x', confidence: null, source: 'zone' })).toBe('Under eyes');
    expect(focusLabel({ id: 'tendency:balanced', text: 'x', confidence: null, source: 'tendency' })).toBe('Balanced care');
  });

  test('mentions framing only when it matched', () => {
    expect(buildProgressCard(base).framingLabel).toBe('Photos framed to match');
    expect(buildProgressCard({ ...base, framing: { kind: 'not_matched', mismatches: ['distance'], centerOffset: 0, sizeRatio: 1.3, rollDelta: null } }).framingLabel).toBeNull();
    expect(buildProgressCard({ ...base, framing: null }).framingLabel).toBeNull();
  });

  test('has honest headlines for a first day and a fresh start', () => {
    expect(buildProgressCard({ ...base, sinceIso: null, streak: { current: 1, longest: 1, doneToday: true, totalDays: 1 } })).toMatchObject({ headline: 'Day one, done', periodLabel: 'First check-in today' });
    expect(buildProgressCard({ ...base, sinceIso: null, streak: { current: 0, longest: 0, doneToday: false, totalDays: 0 } })).toMatchObject({ headline: 'A fresh start' });
    expect(buildProgressCard({ ...base, streak: { current: 0, longest: 3, doneToday: false, totalDays: 3 } }).headline).toBe('14 days of showing up');
  });
});
