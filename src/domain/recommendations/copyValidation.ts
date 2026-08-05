import { z } from 'zod';

export const RECOMMENDATION_COPY_PROMPT_VERSION = 'consumer_rec_copy_v1_2026-08-05';

export interface NamedProduct {
  brandName: string;
  productName: string;
}

export const recommendationCopySchema = z.object({
  copy: z.string().min(20).max(900),
}).strict();

export const RECOMMENDATION_COPY_SYSTEM_PROMPT = `You write short cosmetic-routine explanations for vAIne.

CONSTRAINTS
- Mention only products in allowed_products, using their exact brand and product names.
- If allowed_products is empty, provide generic routine guidance without any brand or product name.
- Describe the visible appearance goal cautiously. Do not diagnose, treat, cure, predict, or identify disease.
- Do not prescribe. Do not provide supplement, procedure, or medical advice.
- Include application order, gradual introduction, patch testing, and a clear stopping rule when relevant.
- Do not compare commissions, affiliate availability, discounts, or commercial terms.

Return strict JSON matching { "copy": string }. No markdown.`;

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const forbiddenClaimPatterns = [
  /\bdiagnoses?\b/i,
  /\bcures?\b/i,
  /\btreats?\s+(?:a|an|the)?\s*(?:disease|condition|disorder)\b/i,
  /\bguaranteed\b/i,
  /\bclinically proven for you\b/i,
  /\bwill reverse\b/i,
];

export interface CopyValidationResult {
  ok: boolean;
  violations: string[];
}

export function validateRecommendationCopy(input: {
  copy: string;
  allowedProducts: readonly NamedProduct[];
  knownProducts: readonly NamedProduct[];
}): CopyValidationResult {
  const violations: string[] = [];
  const normalizedCopy = normalize(input.copy);
  const allowedProducts = new Set(input.allowedProducts.map((product) => normalize(product.productName)));
  const allowedFullNames = new Set(input.allowedProducts.map((product) => normalize(`${product.brandName} ${product.productName}`)));
  const allowedBrands = new Set(input.allowedProducts.map((product) => normalize(product.brandName)));

  for (const product of input.knownProducts) {
    const brand = normalize(product.brandName);
    const name = normalize(product.productName);
    const fullName = normalize(`${product.brandName} ${product.productName}`);

    if (allowedFullNames.has(fullName) || allowedProducts.has(name)) continue;
    if (normalizedCopy.includes(fullName) || normalizedCopy.includes(name)) {
      violations.push(`Mentions disallowed product: ${product.brandName} ${product.productName}`);
      continue;
    }
    if (brand.length >= 4 && !allowedBrands.has(brand) && normalizedCopy.includes(brand)) {
      violations.push(`Mentions disallowed brand: ${product.brandName}`);
    }
  }

  for (const pattern of forbiddenClaimPatterns) {
    if (pattern.test(input.copy)) violations.push(`Contains prohibited claim: ${pattern.source}`);
  }

  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}

export function buildRecommendationCopyInput(input: {
  appearanceGoal: string;
  allowedProducts: readonly (NamedProduct & { routineSlot: string; usage: string })[];
  exclusionSummary: readonly string[];
}): string {
  const products = input.allowedProducts.length
    ? input.allowedProducts.map((product) => `- ${product.brandName} ${product.productName} (${product.routineSlot}) — ${product.usage}`).join('\n')
    : '(none; provide generic category guidance only)';

  return [
    `appearance_goal: ${input.appearanceGoal}`,
    'allowed_products:',
    products,
    `exclusion_summary: ${input.exclusionSummary.length ? input.exclusionSummary.join(', ') : 'none'}`,
    'Return strict JSON only.',
  ].join('\n');
}
