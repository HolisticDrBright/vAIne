import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { FaceIllustration } from './FaceIllustration';
import type { SkinZone } from '@/domain/analysis/observationTaxonomy';
import { zoneOrder, zonePresentation } from '@/data/zonePresentation';
import { colors, radius } from '@/theme';

interface FacialZoneMapProps {
  selectedZone: SkinZone;
  onSelectZone: (zone: SkinZone) => void;
}

const markerPositions: Record<SkinZone, ViewStyle> = {
  forehead: { top: 58, left: '50%', marginLeft: -48, width: 96, height: 38 },
  under_eyes: { top: 106, left: '50%', marginLeft: -69, width: 138, height: 40 },
  cheeks: { top: 145, left: '50%', marginLeft: -79, width: 158, height: 50 },
  nose_t_zone: { top: 116, left: '50%', marginLeft: -30, width: 60, height: 102 },
  mouth_lips: { top: 210, left: '50%', marginLeft: -43, width: 86, height: 38 },
  jawline: { top: 212, left: '50%', marginLeft: -80, width: 160, height: 68 },
  chin: { top: 246, left: '50%', marginLeft: -37, width: 74, height: 38 },
};

export function FacialZoneMap({ selectedZone, onSelectZone }: FacialZoneMapProps) {
  return (
    <View style={styles.stage}>
      <View pointerEvents="none" style={styles.glow} />
      <FaceIllustration />
      {zoneOrder.map((zone) => {
        const selected = zone === selectedZone;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${zonePresentation[zone].label}`}
            accessibilityState={{ selected }}
            key={zone}
            onPress={() => onSelectZone(zone)}
            style={({ pressed }) => [
              styles.marker,
              markerPositions[zone],
              selected && styles.markerSelected,
              pressed && styles.markerPressed,
            ]}
          >
            {selected ? <Text style={styles.markerText}>{zonePresentation[zone].shortLabel}</Text> : null}
          </Pressable>
        );
      })}
      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.hintText}>Tap a facial zone</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 340, overflow: 'hidden', borderRadius: 26, backgroundColor: '#142840', alignItems: 'center', justifyContent: 'flex-end', borderWidth: 1, borderColor: colors.line },
  glow: { position: 'absolute', width: 310, height: 310, borderRadius: 155, backgroundColor: colors.blue, opacity: 0.09, top: 12 },
  marker: { position: 'absolute', borderWidth: 1, borderColor: `${colors.lilac}66`, borderRadius: radius.pill, backgroundColor: `${colors.lilac}0D`, alignItems: 'center', justifyContent: 'center' },
  markerSelected: { borderWidth: 2, borderColor: colors.gold, backgroundColor: `${colors.gold}26` },
  markerPressed: { opacity: 0.68 },
  markerText: { color: colors.text, fontSize: 9, fontWeight: '800', backgroundColor: 'rgba(8,17,31,.78)', paddingHorizontal: 7, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  hint: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(8,17,31,.82)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  hintText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
});
