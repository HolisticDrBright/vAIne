import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { getRoutineCatalog } from '@/data/routineCatalog';
import { visibilityReasonCopy } from '@/domain/recommendations/governance';
import { formatPrice } from '@/domain/recommendations/presentation';
import { colors, fonts, radius, shadows } from '@/theme';

/**
 * Every product on the list that is kept from everyone, with the reviewer's
 * reason in their own words and the gate it failed. Held back means
 * category-level guidance instead, never a guess.
 */
export default function HeldBackScreen() {
  const catalog = useMemo(() => getRoutineCatalog(), []);
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof catalog.blocked>();
    for (const item of catalog.blocked) {
      const key = item.reasons[0] ?? 'inactive';
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [catalog.blocked]);

  return (
    <Screen title="Held back" back>
      <Text style={styles.eyebrow}>KEPT FROM EVERYONE, WITH THE REASON</Text>
      <Text style={styles.title}>{catalog.blocked.length} product{catalog.blocked.length === 1 ? '' : 's'} held back</Text>
      <Text style={styles.subtitle}>These are on your product list but cannot be offered to anyone yet. Each failed at least one visibility gate, shown below with the reviewer’s own note where one exists. Nothing here is ranked or linked.</Text>

      {catalog.invalid.length ? (
        <InfoCard title="Rows that could not be read" body={`${catalog.invalid.length} row${catalog.invalid.length === 1 ? '' : 's'} did not match the product schema and were ignored entirely.`} tone="gold" />
      ) : null}

      {grouped.map(([reason, items]) => (
        <View key={reason} style={styles.group}>
          <View style={styles.groupHeading}>
            <Text style={styles.groupTitle}>{visibilityReasonCopy[reason as keyof typeof visibilityReasonCopy] ?? reason.replaceAll('_', ' ')}</Text>
            <Text style={styles.groupCount}>{items.length}</Text>
          </View>
          {items.map(({ entry, reasons }) => (
            <View key={entry.productId} style={styles.row}>
              <Text style={styles.name}>{entry.brand} {entry.productName}{entry.approximatePriceCents !== null ? ` · ${formatPrice(entry.approximatePriceCents, entry.currencyCode)}` : ''}</Text>
              {entry.blocker ? <Text style={styles.blocker}>Reviewer: {entry.blocker}</Text> : null}
              <Text style={styles.gates}>Gates failed: {reasons.map((item) => visibilityReasonCopy[item].toLowerCase()).join('; ')}.</Text>
            </View>
          ))}
        </View>
      ))}

      {!catalog.blocked.length ? <InfoCard title="Nothing held back" body="Every row on the product list passed the visibility gate." tone="green" /> : null}

      <PrimaryButton label="How we pick products" onPress={() => router.push('/how-we-pick')} />
      <SecondaryButton label="Back to the product list" onPress={() => router.push('/products')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 33, fontWeight: '400', marginTop: -4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -6 },
  group: { backgroundColor: colors.panel, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadows.card },
  groupHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: `${colors.gold}12`, borderBottomWidth: 1, borderBottomColor: colors.line },
  groupTitle: { color: colors.gold, fontSize: 12, fontWeight: '800', flex: 1 },
  groupCount: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  row: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 3 },
  name: { color: colors.text, fontSize: 13, fontWeight: '700' },
  blocker: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  gates: { color: colors.muted, fontSize: 10, lineHeight: 14 },
});
