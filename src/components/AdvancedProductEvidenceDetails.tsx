import { StyleSheet, Text, View } from 'react-native';
import { advancedEvidenceTierLabels, getAdvancedProductEvidence } from '@/data/advancedProductEvidence';
import { colors, radius } from '@/theme';

export function AdvancedProductEvidenceDetails({ productId }: { productId: string }) {
  const review = getAdvancedProductEvidence(productId);
  if (!review) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{advancedEvidenceTierLabels[review.tier].toUpperCase()}</Text>
      <Text style={styles.title}>{review.label}</Text>
      <Text style={styles.body}>{review.summary}</Text>
      <Text style={styles.limitations}>Limits: {review.limitations}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 8, padding: 10, borderRadius: radius.small, borderWidth: 1, borderColor: `${colors.blue}44`, backgroundColor: `${colors.blue}0D` },
  eyebrow: { color: colors.blue, fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: colors.text, fontSize: 10, fontWeight: '800', marginTop: 3 },
  body: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  limitations: { color: colors.gold, fontSize: 9, lineHeight: 13, marginTop: 4 },
});
