/**
 * Provider request/response shaping for the vision analysis. Pure so the
 * exact payload sent to the model and the parsing of what comes back are
 * both unit-tested; index.ts performs the network call.
 */

import {
  CONSUMER_SKIN_SYSTEM_PROMPT,
  PROVIDER_OUTPUT_JSON_SCHEMA,
  buildSkinPromptInput,
} from '../_shared/skinAnalysisContract.ts';
import type { ValidatedRequest } from './request.ts';

/**
 * The plan approved a Sonnet-class budget (~$0.05 per analysis inside a $5
 * daily ceiling). ANTHROPIC_MODEL overrides it without a redeploy.
 */
export const DEFAULT_MODEL = 'claude-sonnet-5';
export const PROVIDER_ID = 'anthropic-vision-v1';
export const MAX_OUTPUT_TOKENS = 4096;
export const PROVIDER_TIMEOUT_MS = 90_000;

export interface ProviderImage {
  type: 'image';
  source: { type: 'base64'; media_type: 'image/jpeg'; data: string };
}

export interface ProviderMessageParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: {
    role: 'user';
    content: (ProviderImage | { type: 'text'; text: string })[];
  }[];
  output_config: { format: { type: 'json_schema'; schema: typeof PROVIDER_OUTPUT_JSON_SCHEMA } };
}

export function buildProviderParams(request: ValidatedRequest, model: string): ProviderMessageParams {
  const content: ProviderMessageParams['messages'][number]['content'] = [];
  for (const capture of request.captures) {
    content.push({ type: 'text', text: `Photograph angle: ${capture.angle}.` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: capture.base64 } });
  }
  content.push({
    type: 'text',
    text: buildSkinPromptInput({
      goals: request.goals,
      sensitivityPreference: request.sensitivityPreference,
      captureAngles: request.captures.map((capture) => capture.angle),
    }),
  });
  return {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: CONSUMER_SKIN_SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
    output_config: { format: { type: 'json_schema', schema: PROVIDER_OUTPUT_JSON_SCHEMA } },
  };
}

export type ProviderParse =
  | { ok: true; output: unknown }
  | { ok: false; code: 'refused' | 'truncated' | 'no_text' | 'not_json' };

/**
 * Extracts the JSON object from a Messages API response. Refusals and
 * truncated outputs are surfaced as typed failures rather than parsed.
 */
export function parseProviderResponse(response: {
  stop_reason?: string | null;
  content?: readonly { type: string; text?: string }[];
}): ProviderParse {
  if (response.stop_reason === 'refusal') return { ok: false, code: 'refused' };
  if (response.stop_reason === 'max_tokens') return { ok: false, code: 'truncated' };
  const text = (response.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('')
    .trim();
  if (!text) return { ok: false, code: 'no_text' };
  try {
    return { ok: true, output: JSON.parse(text) };
  } catch {
    return { ok: false, code: 'not_json' };
  }
}
