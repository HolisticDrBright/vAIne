import { Image, StyleSheet, Text, View } from 'react-native';
import type { LocalCapture } from '@/state/CaptureSessionContext';
import { colors, radius, shadows } from '@/theme';

interface LocalCaptureStripProps {
  captures: readonly LocalCapture[];
  title?: string;
}

const angleLabels = {
  front: 'Front',
  left_profile: 'Left',
  right_profile: 'Right',
} as const;

export function LocalCaptureStrip({ captures, title = 'Your local check-in photos' }: LocalCaptureStripProps) {
  if (!captures.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.badge}>LOCAL ONLY</Text>
      </View>
      <View style={styles.row}>
        {captures.map((capture) => (
          <View key={capture.angle} style={styles.capture}>
            <Image
              accessibilityLabel={`${angleLabels[capture.angle]} check-in photo`}
              source={{ uri: capture.uri }}
              style={styles.image}
            />
            <Text style={styles.label}>{angleLabels[capture.angle]}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>Shown for your reference. These photos were not uploaded or analyzed.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, padding: 14, gap: 11, ...shadows.card },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  badge: { color: colors.green, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  row: { flexDirection: 'row', gap: 8 },
  capture: { flex: 1, gap: 5 },
  image: { width: '100%', aspectRatio: 0.72, borderRadius: radius.small, backgroundColor: colors.panelSoft },
  label: { color: colors.muted, textAlign: 'center', fontSize: 9, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 10, lineHeight: 15 },
});
