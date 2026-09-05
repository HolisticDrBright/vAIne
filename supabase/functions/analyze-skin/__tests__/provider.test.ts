import { describe, expect, test } from 'vitest';
import { CONSUMER_SKIN_SYSTEM_PROMPT } from '../../_shared/skinAnalysisContract.ts';
import { buildProviderParams, parseProviderResponse } from '../provider.ts';
import { validateRequest } from '../request.ts';

const JPEG = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10));

describe('analyze-skin provider shaping', () => {
  test('sends every photo as a base64 JPEG image block with the consumer prompt and a JSON schema', () => {
    const validation = validateRequest({
      analysisId: 'analysis-m0abc123-x9y8z7w6',
      captures: [
        { angle: 'front', width: 1200, height: 1600, capturedAtIso: '2026-09-05T09:59:00.000Z', jpegBase64: JPEG },
        { angle: 'left_profile', width: 1200, height: 1600, capturedAtIso: '2026-09-05T09:59:10.000Z', jpegBase64: JPEG },
      ],
      goals: ['support_hydration_look'],
      sensitivityPreference: 'sensitive',
    }, '2026-09-05T10:00:00.000Z');
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    const params = buildProviderParams(validation.request, 'claude-sonnet-5');
    expect(params.model).toBe('claude-sonnet-5');
    expect(params.system).toBe(CONSUMER_SKIN_SYSTEM_PROMPT);
    const images = params.messages[0].content.filter((block) => block.type === 'image');
    expect(images).toHaveLength(2);
    expect(images[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: JPEG } });
    const text = params.messages[0].content.filter((block) => block.type === 'text').map((block) => (block as { text: string }).text).join('\n');
    expect(text).toContain('goals: support_hydration_look');
    expect(text).toContain('sensitivity_preference: sensitive');
    expect(text).toContain('capture_angles: front, left_profile');
    expect(params.output_config.format.type).toBe('json_schema');
    // Nothing identifying travels with the photos.
    expect(JSON.stringify(params)).not.toMatch(/analysis-m0abc123|user_id|email/);
  });

  test('parses JSON text, and surfaces refusals and truncation as typed failures', () => {
    expect(parseProviderResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"summary":"ok"}' }] })).toEqual({ ok: true, output: { summary: 'ok' } });
    expect(parseProviderResponse({ stop_reason: 'refusal', content: [] })).toEqual({ ok: false, code: 'refused' });
    expect(parseProviderResponse({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"sum' }] })).toEqual({ ok: false, code: 'truncated' });
    expect(parseProviderResponse({ stop_reason: 'end_turn', content: [] })).toEqual({ ok: false, code: 'no_text' });
    expect(parseProviderResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] })).toEqual({ ok: false, code: 'not_json' });
  });
});
