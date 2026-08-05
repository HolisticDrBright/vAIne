import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { FaceIllustration } from './FaceIllustration';
import type { SkinZone } from '@/domain/analysis/observationTaxonomy';
import { zonePresentation } from '@/data/zonePresentation';
import { colors, radius } from '@/theme';

const facePositions: Record<SkinZone, ViewStyle> = {
  forehead: { top: 36 },
  under_eyes: { top: -16 },
  cheeks: { top: -58 },
  nose_t_zone: { top: -54 },
  mouth_lips: { top: -142 },
  jawline: { top: -148 },
  chin: { top: -174 },
};

export function ZoneZoomIllustration({ zone }: { zone: SkinZone }) {
  return (
    <View style={styles.crop}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={[styles.faceLayer, facePositions[zone]]}>
        <View style={styles.faceScale}><FaceIllustration /></View>
      </View>
      <View pointerEvents="none" style={styles.focusFrame} />
      <View style={styles.label}>
        <Text style={styles.labelText}>{zonePresentation[zone].label.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  crop: { height: 260, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: colors.gold, backgroundColor: '#142840', alignItems: 'center' },
  glow: { position: 'absolute', width: 330, height: 330, borderRadius: 165, backgroundColor: colors.lilac, opacity: 0.12, top: -50 },
  faceLayer: { position: 'absolute', alignItems: 'center' },
  faceScale: { transform: [{ scale: 1.75 }] },
  focusFrame: { position: 'absolute', left: 24, right: 24, top: 34, bottom: 34, borderRadius: 90, borderWidth: 1.5, borderColor: colors.gold, backgroundColor: `${colors.gold}0A` },
  label: { position: 'absolute', left: 14, bottom: 14, backgroundColor: 'rgba(8,17,31,.88)', paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill },
  labelText: { color: colors.gold, fontWeight: '800', fontSize: 9, letterSpacing: 0.8 },
});
