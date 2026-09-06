import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { ProductPurchaseLink } from '@/components/ProductPurchaseLink';
import { ProductProtocolDetails } from '@/components/ProductProtocolDetails';
import { AdvancedProductEvidenceDetails } from '@/components/AdvancedProductEvidenceDetails';
import { catalogSourceLabels, getRoutineCatalog } from '@/data/routineCatalog';
import { betaCatalogTestingEnabled } from '@/data/betaCatalogTesting';
import { advancedEvidenceGroupLabel, advancedEvidenceTierRank, getAdvancedProductEvidence } from '@/data/advancedProductEvidence';
import type { SkinObservationTag } from '@/domain/analysis/observationTaxonomy';
import type { CatalogEntry } from '@/domain/catalog/catalogEntry';
import { assessProductEvidence, ingredientEvidenceGradeLabels } from '@/domain/recommendations/evidenceRanking';
import { evaluateProductEligibility, rankEligibleProducts, type IneligibilityReason, type ProductCandidate } from '@/domain/recommendations/eligibility';
import {
  budgetMaximumCents,
  buildSafetyProfile,
  namedProductsHiddenFor,
  requestedTagsFor,
} from '@/domain/recommendations/routineBuilder';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { describeTag, formatPrice } from '@/domain/recommendations/presentation';
import { colors, fonts, radius, shadows } from '@/theme';

const slotLabels = {
  cleanse: 'Cleanse',
  support: 'Support',
  hydrate: 'Hydrate',
  protect: 'Protect',
  weekly: 'Weekly',
} as const;

const kindLabels: Record<CatalogEntry['productKind'], string> = {
  single: 'Product',
  bundle: 'Bundle / system',
  travel_size: 'Travel size',
  body: 'Body / neck care',
  device: 'Device / tool',
  supplement: 'Supplement',
};

const reasonCopy: Record<IneligibilityReason, string> = {
  not_verified: 'Not yet verified',
  catalog_not_approved: 'Catalog review incomplete',
  prescription_only: 'Prescription only',
  pregnancy_exclusion: 'Excluded for pregnancy or trying to conceive',
  nursing_exclusion: 'Excluded while nursing',
  recent_procedure_exclusion: 'Excluded after a recent procedure',
  sensitivity_exclusion: 'Excluded by your sensitivity or fragrance preference',
  allergy_match: 'Contains an ingredient you avoid',
  duplicate_active_family: 'Same active family you already use',
};

type MatchStatus =
  | { kind: 'no_profile' }
  | { kind: 'hidden' }
  | { kind: 'match'; tags: readonly SkinObservationTag[] }
  | { kind: 'over_budget'; tags: readonly SkinObservationTag[] }
  | { kind: 'no_goal_match' }
  | { kind: 'excluded'; reasons: readonly IneligibilityReason[] };

function statusLabel(status: MatchStatus): { label: string; tone: 'green' | 'gold' | 'muted' } {
  switch (status.kind) {
    case 'no_profile': return { label: 'LISTED', tone: 'muted' };
    case 'hidden': return { label: 'HIDDEN FOR REVIEW', tone: 'gold' };
    case 'match': return { label: 'MATCHES YOU', tone: 'green' };
    case 'over_budget': return { label: 'OVER BUDGET', tone: 'gold' };
    case 'no_goal_match': return { label: 'NOT A GOAL MATCH', tone: 'muted' };
    case 'excluded': return { label: 'EXCLUDED', tone: 'gold' };
  }
}

function statusBody(status: MatchStatus): string {
  switch (status.kind) {
    case 'no_profile': return 'Complete a check-in and the safety questions to see how this product matches you.';
    case 'hidden': return 'Named products are hidden until your allergy or reaction can be reviewed product by product.';
    case 'match': return `Matched on: ${status.tags.map(describeTag).join(', ')}.`;
    case 'over_budget': return `Would match on ${status.tags.map(describeTag).join(', ')}, but is above your per-product budget.`;
    case 'no_goal_match': return 'Does not address an appearance goal from this check-in.';
    case 'excluded': return status.reasons.map((reason) => reasonCopy[reason]).join(' · ');
  }
}

export default function ProductsScreen() {
  const { analysis } = useAnalysisSession();
  const { routineProfile } = useRoutineProfile();
  const catalog = useMemo(() => getRoutineCatalog(), []);
  const fictional = catalog.source === 'synthetic_samples';

  const evaluate = (product: ProductCandidate): MatchStatus => {
    if (!routineProfile || analysis.status !== 'ready' || !analysis.result) return { kind: 'no_profile' };
    if (namedProductsHiddenFor(routineProfile)) return { kind: 'hidden' };
    const result = evaluateProductEligibility(product, buildSafetyProfile(routineProfile), requestedTagsFor(analysis.result));
    if (!result.eligible) return { kind: 'excluded', reasons: result.reasons };
    if (!result.matchedTags.length) return { kind: 'no_goal_match' };
    const ceiling = budgetMaximumCents[routineProfile.budgetPreference];
    if (ceiling !== null && product.listPriceCents !== null && product.listPriceCents > ceiling) {
      return { kind: 'over_budget', tags: result.matchedTags };
    }
    return { kind: 'match', tags: result.matchedTags };
  };

  const ranked = routineProfile && analysis.status === 'ready' && analysis.result
    ? rankEligibleProducts(
      catalog.products,
      buildSafetyProfile(routineProfile),
      requestedTagsFor(analysis.result),
      budgetMaximumCents[routineProfile.budgetPreference],
      routineProfile.budgetPreference === 'no_limit' ? 'higher' : 'lower',
    )
    : [];
  const slotRankCounts = new Map<string, number>();
  const slotRanks = new Map<string, number>();
  for (const entry of ranked) {
    const next = (slotRankCounts.get(entry.product.routineSlot) ?? 0) + 1;
    slotRankCounts.set(entry.product.routineSlot, next);
    slotRanks.set(entry.product.id, next);
  }
  const specialtyRanks = new Map<string, { label: string; rank: number }>();
  for (const label of ['peptide', 'EV / conditioned-media'] as const) {
    const members = ranked
      .filter(({ product }) => {
        const review = getAdvancedProductEvidence(product.id);
        return review ? advancedEvidenceGroupLabel(review) === label : false;
      })
      .sort((left, right) => (
        advancedEvidenceTierRank(getAdvancedProductEvidence(left.product.id)) - advancedEvidenceTierRank(getAdvancedProductEvidence(right.product.id))
        || right.rankScore - left.rankScore
      ));
    members.forEach((entry, index) => specialtyRanks.set(entry.product.id, { label, rank: index + 1 }));
  }
  const statusPriority: Record<MatchStatus['kind'], number> = {
    match: 0,
    over_budget: 1,
    no_goal_match: 2,
    excluded: 3,
    hidden: 4,
    no_profile: 5,
  };
  const evaluated = catalog.products
    .map((product) => {
      const status = evaluate(product);
      const evidenceTags = status.kind === 'match' || status.kind === 'over_budget'
        ? status.tags
        : product.observationTags;
      return {
        product,
        status,
        evidence: assessProductEvidence(product, evidenceTags),
        slotRank: slotRanks.get(product.id) ?? null,
        specialtyRank: specialtyRanks.get(product.id) ?? null,
      };
    })
    .sort((a, b) => (
      statusPriority[a.status.kind] - statusPriority[b.status.kind]
      || (a.slotRank ?? Number.MAX_SAFE_INTEGER) - (b.slotRank ?? Number.MAX_SAFE_INTEGER)
      || b.evidence.effectivenessScore - a.evidence.effectivenessScore
      || a.product.productName.localeCompare(b.product.productName)
    ));
  const matchCount = evaluated.filter((entry) => entry.status.kind === 'match').length;
  const listedCount = catalog.products.length + catalog.outsideRoutine.length;

  return (
    <Screen title="Product list" back>
      <Text style={styles.eyebrow}>{catalogSourceLabels[catalog.source].toUpperCase()}</Text>
      <Text style={styles.title}>{fictional ? 'Fictional samples stand in for now' : 'Products your routine draws from'}</Text>
      <Text style={styles.subtitle}>
        {fictional
          ? 'The reviewed product list is empty, so routines use these clearly labeled fictional samples. Once reviewed products are loaded, they replace the samples automatically.'
          : betaCatalogTestingEnabled
            ? 'This TestFlight beta enables sufficiently identified topical products as research previews so you can test matching and budget choices. Hard safety blockers, unverified sunscreens, devices, supplements, and missing products remain outside personalized routines.'
            : 'Products below come from your reviewed product list. Routines pick from this list only; nothing commercial affects the order.'}
      </Text>

      <View style={styles.summary}>
        <View style={styles.summaryItem}><Text style={styles.summaryNumber}>{listedCount}</Text><Text style={styles.summaryLabel}>LISTED</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryNumber}>{routineProfile && analysis.result ? matchCount : '–'}</Text><Text style={styles.summaryLabel}>MATCH YOU</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryNumber}>{catalog.blocked.length + catalog.invalid.length}</Text><Text style={styles.summaryLabel}>HELD BACK</Text></View>
      </View>

      {!routineProfile || analysis.status !== 'ready' ? (
        <InfoCard title="See your matches" body="Complete a check-in and the short safety questions; each product then shows whether it matches your goals, budget, and safety answers." tone="lilac" />
      ) : null}

      <View style={styles.list}>
        {evaluated.map(({ product, status, evidence, slotRank, specialtyRank }) => {
          const badge = statusLabel(status);
          return (
            <View key={product.id} style={styles.row}>
              <View style={styles.rowHeading}>
                <Text style={styles.slot}>{slotLabels[product.routineSlot].toUpperCase()}{product.catalogState && product.catalogState !== 'catalog_approved' ? ' · RESEARCH PREVIEW' : ''}</Text>
                <Text style={[styles.badge, badge.tone === 'green' && styles.badgeGreen, badge.tone === 'gold' && styles.badgeGold]}>{badge.label}</Text>
              </View>
              <Text style={styles.brand}>{product.brandName}</Text>
              <Text style={styles.name}>{product.productName}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.price}>{formatPrice(product.listPriceCents, product.currencyCode)}</Text>
                <Text style={styles.meta}>{fictional ? 'Fictional price' : 'Approximate list price'}</Text>
              </View>
              <Text style={styles.tags}>Helps with: {product.observationTags.length ? product.observationTags.map(describeTag).join(', ') : 'no listed appearance goal'}</Text>
              <Text style={styles.evidence}>
                {specialtyRank ? `#${specialtyRank.rank} ${specialtyRank.label} match · ` : slotRank ? `#${slotRank} ${slotLabels[product.routineSlot].toLowerCase()} match · ` : ''}
                {ingredientEvidenceGradeLabels[evidence.grade]} · {evidence.effectivenessScore}/100
              </Text>
              {evidence.matchedSignals.length ? <Text style={styles.note}>Evidence signals: {evidence.matchedSignals.join(', ')}. Product-specific evidence and limits are identified below when available.</Text> : null}
              {product.cautionNote ? <Text style={styles.caution}>Caution: {product.cautionNote}</Text> : null}
              {product.note ? <Text style={styles.note}>Note: {product.note}</Text> : null}
              <Text style={styles.statusBody}>{statusBody(status)}</Text>
              {!fictional ? <AdvancedProductEvidenceDetails productId={product.id} /> : null}
              {!fictional ? <ProductProtocolDetails product={product} /> : null}
              <ProductPurchaseLink productId={product.id} productName={product.productName} />
            </View>
          );
        })}
      </View>

      {catalog.outsideRoutine.length ? (
        <>
          <Text style={styles.sectionTitle}>Also on the list</Text>
          <Text style={styles.sectionBody}>Bundles, travel sizes, body care, devices, and supplements are listed for reference. Daily routines are built from single face-care products only.</Text>
          <View style={styles.list}>
            {catalog.outsideRoutine.map((entry) => {
              const evidence = assessProductEvidence({
                productName: entry.productName,
                category: entry.category,
                routineSlot: entry.routineSlot,
                ingredients: entry.keyIngredients,
                observationTags: entry.skinConcernTags,
              });
              return (
              <View key={entry.productId} style={styles.row}>
                <View style={styles.rowHeading}>
                  <Text style={styles.slot}>{kindLabels[entry.productKind].toUpperCase()}</Text>
                  <Text style={styles.badge}>NOT IN ROUTINES</Text>
                </View>
                <Text style={styles.brand}>{entry.brand}</Text>
                <Text style={styles.name}>{entry.productName}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.price}>{formatPrice(entry.approximatePriceCents, entry.currencyCode)}</Text>
                  <Text style={styles.meta}>{entry.category}</Text>
                </View>
                {entry.sourceNotes?.findings ? <Text style={styles.tags}>Positioned for: {entry.sourceNotes.findings}</Text> : null}
                <Text style={styles.evidence}>{ingredientEvidenceGradeLabels[evidence.grade]} · {evidence.effectivenessScore}/100 · not ranked into a daily routine</Text>
                {entry.sourceNotes?.caution ? <Text style={styles.caution}>Caution: {entry.sourceNotes.caution}</Text> : null}
                <ProductProtocolDetails product={{
                  id: entry.productId,
                  brandName: entry.brand,
                  productName: entry.productName,
                  routineSlot: entry.routineSlot,
                  whenToUse: entry.sourceNotes?.whenToUse,
                  category: entry.category,
                }} />
                <ProductPurchaseLink productId={entry.productId} productName={entry.productName} />
              </View>
              );
            })}
          </View>
        </>
      ) : null}

      {catalog.blocked.length ? (
        <View style={styles.heldBack}>
          <Text style={styles.heldBackTitle}>Held back until verified</Text>
          <Text style={styles.heldBackBody}>These products are on the list but cannot be offered yet. Each shows the reviewer's reason.</Text>
          {catalog.blocked.map(({ entry, reasons }) => (
            <View key={entry.productId} style={styles.heldBackItem}>
              <Text style={styles.heldBackRow}>{entry.brand} {entry.productName}{entry.approximatePriceCents !== null ? ` · ${formatPrice(entry.approximatePriceCents, entry.currencyCode)}` : ''}</Text>
              <Text style={styles.heldBackReason}>{entry.blocker ?? reasons.join(', ').replaceAll('_', ' ')}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {catalog.invalid.length ? (
        <InfoCard title="Rows that could not be read" body={`${catalog.invalid.length} catalog row${catalog.invalid.length === 1 ? '' : 's'} did not match the product schema and were ignored.`} tone="gold" />
      ) : null}

      {analysis.status === 'ready' && routineProfile ? (
        <PrimaryButton label="Open today’s routine" onPress={() => router.push('/routine')} />
      ) : (
        <PrimaryButton label="Start a check-in" onPress={() => router.push('/consent')} />
      )}
      <SecondaryButton label="Back to home" onPress={() => router.replace('/')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.green, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 33, fontWeight: '400', marginTop: -4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -6 },
  summary: { flexDirection: 'row', gap: 10 },
  summaryItem: { flex: 1, backgroundColor: colors.panel, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, padding: 12, alignItems: 'center', ...shadows.card },
  summaryNumber: { color: colors.text, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: colors.muted, fontSize: 7, fontWeight: '800', letterSpacing: 0.8, marginTop: 3 },
  list: { backgroundColor: colors.panel, borderRadius: radius.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, ...shadows.card },
  row: { padding: 15, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 3 },
  rowHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  slot: { color: colors.blue, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  badge: { color: colors.muted, fontSize: 7, fontWeight: '800', letterSpacing: 0.6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3 },
  badgeGreen: { color: colors.green, borderColor: `${colors.green}66`, backgroundColor: `${colors.green}12` },
  badgeGold: { color: colors.gold, borderColor: `${colors.gold}66`, backgroundColor: `${colors.gold}12` },
  brand: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.4, marginTop: 5 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  price: { color: colors.green, fontSize: 11, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 9 },
  tags: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 4, textTransform: 'capitalize' },
  evidence: { color: colors.blue, fontSize: 10, lineHeight: 15, fontWeight: '800', marginTop: 3 },
  statusBody: { color: colors.text, fontSize: 10, lineHeight: 14, marginTop: 4 },
  note: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  caution: { color: colors.gold, fontSize: 9, lineHeight: 13, marginTop: 3 },
  sectionTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 20, marginTop: 6 },
  sectionBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -8 },
  heldBackBody: { color: colors.muted, fontSize: 11, lineHeight: 15, marginBottom: 4 },
  heldBackItem: { marginTop: 4 },
  heldBackReason: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  heldBack: { backgroundColor: `${colors.gold}12`, borderWidth: 1, borderColor: `${colors.gold}44`, borderRadius: radius.medium, padding: 14, gap: 4 },
  heldBackTitle: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  heldBackRow: { color: colors.muted, fontSize: 11, lineHeight: 15 },
});
