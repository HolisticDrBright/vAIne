import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export function ScoreRing({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <View style={[styles.outer, compact && styles.outerCompact]}>
      <Text style={[styles.number, compact && styles.numberCompact]}>{score}</Text>
      <Text style={styles.label}>/100</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: 116, height: 116, borderRadius: 60, borderWidth: 7, borderColor: colors.blue, justifyContent: 'center', alignItems: 'center' },
  outerCompact: { width: 70, height: 70, borderRadius: 36, borderWidth: 4 },
  number: { color: colors.text, fontWeight: '700', fontSize: 35 },
  numberCompact: { fontSize: 22 },
  label: { color: colors.muted, fontSize: 10 },
});
