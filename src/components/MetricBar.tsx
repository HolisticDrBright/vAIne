import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export function MetricBar({ label, value, trend }: { label: string; value: number; trend?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${value}%` as `${number}%` }]} /></View>
      <Text style={[styles.value, trend && styles.trend]}>{trend ? '↑' : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: colors.muted, fontSize: 11, width: 105 },
  track: { height: 6, borderRadius: 10, backgroundColor: '#2E415B', flex: 1, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.blue, borderRadius: 10 },
  value: { color: colors.text, fontSize: 11, width: 22, textAlign: 'right' },
  trend: { color: colors.green, fontSize: 17 },
});
