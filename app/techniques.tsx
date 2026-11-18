import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { techniqueLibrary } from '@/data/techniqueLibrary';
import { zonePresentation } from '@/data/zonePresentation';
import { describeTag } from '@/domain/recommendations/presentation';
import { attachCommercialLinks, type CommercialLink } from '@/domain/recommendations/commercialAttachment';
import { buildTechniqueSafetyProfile, requestedTagsFor, techniqueQuestionsAnswered } from '@/domain/recommendations/routineBuilder';
import {
  PLACEHOLDER_REVIEW_LABEL,
  UNIVERSAL_STOP_RULE,
  isPlaceholderTechnique,
  techniqueCategoryLabels,
  techniqueExclusionCopy,
  techniqueToolLabels,
  type Technique,
  type TechniqueTool,
} from '@/domain/techniques/technique';
import { evaluateTechniqueEligibility, techniqueReasonCopy, type TechniqueEligibilityResult } from '@/domain/techniques/techniqueEligibility';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, fonts, radius, shadows } from '@/theme';

/**
 * "Get the tool" placeholders. These are synthetic entries with no link:
 * they are pending review, so the commercial-attachment rules drop every
 * one of them, and the interface says so. A real, disclosed affiliate link
 * can only appear here once it passes those same rules.
 */
const toolLinkPlaceholders: readonly CommercialLink[] = (['gua_sha_tool', 'facial_cups', 'microcurrent_device', 'red_light_device'] as const).map((tool) => ({
  productId: `tool:${tool}`,
  destinationUrl: '',
  affiliateRelationship: 'affiliate',
  disclosure: 'Synthetic placeholder. vAIne may earn a commission on a future reviewed link; that never affects which techniques are offered.',
  sourceLinkStatus: 'pending',
  reviewStatus: 'pending',
}));

function ToolPlaceholder({ tool }: { tool: TechniqueTool }) {
  const [attached] = attachCommercialLinks([{ id: `tool:${tool}` }], toolLinkPlaceholders);
  return (
    <View style={styles.toolBox}>
      <Text style={styles.toolTitle}>Get a {techniqueToolLabels[tool].toLowerCase()}</Text>
      <Text style={styles.toolBody}>
        {attached.commercialLink
          ? 'A reviewed link is available.'
          : 'Synthetic placeholder: no link is attached in this beta. Any future link will be reviewed first and disclosed as affiliate, and it will never change which techniques you are offered.'}
      </Text>
    </View>
  );
}

function TechniqueCard({ technique, eligibility, toolOwned, answered }: { technique: Technique; eligibility: TechniqueEligibilityResult | null; toolOwned: boolean; answered: boolean }) {
  const blocked = eligibility ? !eligibility.eligible : false;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <Text style={styles.category}>{techniqueCategoryLabels[technique.category].toUpperCase()}</Text>
        {isPlaceholderTechnique(technique)
          ? <Text style={styles.placeholderBadge}>{PLACEHOLDER_REVIEW_LABEL}</Text>
          : <Text style={styles.reviewedBadge}>REVIEWED {technique.reviewedAtIso ? new Date(technique.reviewedAtIso).getFullYear() : ''}</Text>}
      </View>
      <Text style={styles.name}>{technique.name}</Text>
      <Text style={styles.meta}>
        {Math.round(technique.durationSeconds / 60)} min · {technique.requiredTool ? techniqueToolLabels[technique.requiredTool] : 'No tool needed'} · {technique.zones.map((zone) => zonePresentation[zone].shortLabel).join(', ')}
      </Text>
      <Text style={styles.body}>{technique.evidenceNote}</Text>
      {technique.observationTags.length ? <Text style={styles.tags}>May support: {technique.observationTags.map(describeTag).join(', ')}</Text> : null}
      {eligibility?.matchedTags.length ? <Text style={styles.match}>Matches this check-in on {eligibility.matchedTags.map(describeTag).join(', ')}.</Text> : null}
      <Text style={styles.skipTitle}>Who should skip this</Text>
      <Text style={styles.skip}>{technique.skipNote}</Text>
      {technique.exclusionFlags.length ? (
        <Text style={styles.flags}>{technique.exclusionFlags.map((flag) => techniqueExclusionCopy[flag]).join(' ')}</Text>
      ) : null}
      {!answered ? (
        <Text style={styles.status}>Answer the technique safety questions in routine preferences to see whether this is offered to you.</Text>
      ) : blocked ? (
        <Text style={styles.statusBlocked}>{eligibility!.reasons.map(techniqueReasonCopy).join(' ')}</Text>
      ) : (
        <>
          {!toolOwned && technique.requiredTool ? <ToolPlaceholder tool={technique.requiredTool} /> : null}
          <PrimaryButton label={toolOwned ? 'Start guided session' : 'Preview the session'} onPress={() => router.push({ pathname: '/technique-session', params: { id: technique.id } })} />
        </>
      )}
    </View>
  );
}

export default function TechniquesScreen() {
  const { analysis } = useAnalysisSession();
  const { routineProfile } = useRoutineProfile();
  const answered = routineProfile ? techniqueQuestionsAnswered(routineProfile) : false;
  const owned = new Set<TechniqueTool>(routineProfile?.toolsOwned ?? []);

  const evaluated = useMemo(() => {
    const profile = routineProfile ? buildTechniqueSafetyProfile(routineProfile, analysis.result) : null;
    const tags = analysis.result ? requestedTagsFor(analysis.result) : [];
    return techniqueLibrary.map((technique) => ({
      technique,
      eligibility: profile && answered ? evaluateTechniqueEligibility(technique, profile, tags) : null,
      toolOwned: technique.requiredTool === null || owned.has(technique.requiredTool),
    })).sort((a, b) => (
      Number(Boolean(b.eligibility?.eligible)) - Number(Boolean(a.eligibility?.eligible))
      || Number(b.toolOwned) - Number(a.toolOwned)
      || a.technique.name.localeCompare(b.technique.name)
    ));
  }, [analysis.result, answered, owned, routineProfile]);

  const doable = evaluated.filter((entry) => entry.eligibility?.eligible && entry.toolOwned);
  const needsTool = evaluated.filter((entry) => entry.eligibility?.eligible && !entry.toolOwned);
  const withheld = evaluated.filter((entry) => entry.eligibility && !entry.eligibility.eligible);

  return (
    <Screen title="Techniques" back>
      <Text style={styles.eyebrow}>AT-HOME COSMETIC TECHNIQUES</Text>
      <Text style={styles.title}>Gentle techniques, matched by rules</Text>
      <Text style={styles.subtitle}>Gua sha, facial exercise, microcurrent, red light, and cupping are matched to your safety answers and owned tools by fixed rules, never by the AI. Each entry describes temporary appearance effects only and shows who reviewed it. {UNIVERSAL_STOP_RULE}</Text>

      {techniqueLibrary.some(isPlaceholderTechnique) ? (
        <InfoCard title="Some entries await review" body="Entries marked as placeholders are synthetic samples whose steps, cues, skip lists, and evidence notes will be replaced by a reviewing practitioner before they are presented as guidance." tone="gold" />
      ) : null}

      {!routineProfile ? (
        <>
          <InfoCard title="Safety answers come first" body="Techniques are offered only after the routine preferences, which now include five short technique questions and the tools you own." tone="lilac" />
          <PrimaryButton label="Answer routine preferences" onPress={() => router.push('/routine-intake')} />
        </>
      ) : !answered ? (
        <>
          <InfoCard title="A few quick questions to add" body="Your saved answers predate some of the technique questions. Until they are answered, every technique is treated cautiously and none is added to your plan." tone="lilac" />
          <PrimaryButton label="Update routine preferences" onPress={() => router.push('/routine-intake')} />
        </>
      ) : (
        <View style={styles.summary}>
          <View style={styles.summaryItem}><Text style={styles.summaryNumber}>{doable.length}</Text><Text style={styles.summaryLabel}>READY TODAY</Text></View>
          <View style={styles.summaryItem}><Text style={styles.summaryNumber}>{needsTool.length}</Text><Text style={styles.summaryLabel}>NEED A TOOL</Text></View>
          <View style={styles.summaryItem}><Text style={styles.summaryNumber}>{withheld.length}</Text><Text style={styles.summaryLabel}>WITHHELD</Text></View>
        </View>
      )}

      {evaluated.map((entry) => (
        <TechniqueCard key={entry.technique.id} technique={entry.technique} eligibility={entry.eligibility} toolOwned={entry.toolOwned} answered={answered} />
      ))}

      <SecondaryButton label="Change routine preferences" onPress={() => router.push('/routine-intake')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 33, fontWeight: '400', marginTop: -4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -6 },
  summary: { flexDirection: 'row', gap: 10 },
  summaryItem: { flex: 1, backgroundColor: colors.panel, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, padding: 12, alignItems: 'center', ...shadows.card },
  summaryNumber: { color: colors.text, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: colors.muted, fontSize: 7, fontWeight: '800', letterSpacing: 0.8, marginTop: 3 },
  card: { backgroundColor: colors.panel, padding: 15, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, gap: 6, ...shadows.card },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  category: { color: colors.blue, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  placeholderBadge: { color: colors.gold, fontSize: 7, fontWeight: '800', letterSpacing: 0.6, borderWidth: 1, borderColor: `${colors.gold}66`, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3 },
  reviewedBadge: { color: colors.green, fontSize: 7, fontWeight: '800', letterSpacing: 0.6, borderWidth: 1, borderColor: `${colors.green}66`, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 10 },
  body: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  tags: { color: colors.muted, fontSize: 10, textTransform: 'capitalize' },
  match: { color: colors.green, fontSize: 10, fontWeight: '700' },
  skipTitle: { color: colors.gold, fontSize: 10, fontWeight: '800', marginTop: 4 },
  skip: { color: colors.text, fontSize: 11, lineHeight: 16 },
  flags: { color: colors.muted, fontSize: 9, lineHeight: 13 },
  status: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  statusBlocked: { color: colors.gold, fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 4 },
  toolBox: { backgroundColor: colors.panelSoft, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, padding: 11, marginTop: 4 },
  toolTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  toolBody: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3 },
});
