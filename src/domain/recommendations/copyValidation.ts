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
- When an at-home technique (gua sha, facial exercise, microcurrent, red light, cupping) is mentioned, describe only temporary appearance effects in cautious words such as "may help skin look less puffy". Never say it reshapes, sculpts, lifts permanently, treats, or cures anything, or that results are guaranteed.

Return strict JSON matching { "copy": string }. No markdown.`;

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const forbiddenClaimPatterns = [
  /\bdiagnoses?\b/i,
  /\bcures?\b/i,
  /\btreats?\s+(?:a|an|the)?\s*(?:disease|condition|disorder)\b/i,
  /\bguaranteed\b/i,
  /\bclinically proven for you\b/i,
  /\bwill reverse\b/i,
  // Technique claims: reshaping, permanence, treatment, and guarantees are out.
  /\bre-?shap(?:e|es|ed|ing)\b/i,
  /\bre-?sculpt|\bsculpt(?:s|ed|ing)?\s+(?:your|the)\s+(?:jaw|jawline|face|cheekbones?|bone)/i,
  /\b(?:jaw|cheek|facial|nasal)\s*bone(?:s)?\b.*\b(?:change|move|reshape|define)/i,
  /\b(?:permanent(?:ly)?|lasting|forever)\s+(?:lift|lifts|lifted|lifting|tighten|tightens|tightened|result|results|change|changes)\b/i,
  /\blift(?:s|ed|ing)?\s+(?:your|the)\s+(?:face|jawline|cheeks?|brows?|skin)\s+permanently\b/i,
  /\btreats?\b(?!\s+(?:yourself|your skin|it)\s+gently)/i,
  /\bguarantee(?:s|d)?\b|\bresults?\s+(?:are\s+)?guaranteed\b|\bproven to\b/i,
  /\bwrinkle[- ]free\b|\berases?\s+wrinkles?\b|\bremoves?\s+(?:wrinkles?|fine lines)\b/i,
];

/**
 * Validates technique copy (steps, cues, evidence and skip notes). Cautious
 * "looks" language passes; reshaping, permanence, treatment, and guarantees
 * do not. Shares the claim patterns with product copy so the vocabulary
 * stays in one place.
 */
export function validateTechniqueCopy(copy: string): CopyValidationResult {
  const violations = forbiddenClaimPatterns
    .filter((pattern) => pattern.test(copy))
    .map((pattern) => `Contains prohibited claim: ${pattern.source}`);
  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}

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
