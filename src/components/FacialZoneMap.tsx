import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FaceIllustration } from './FaceIllustration';
import type { SkinZone } from '@/domain/analysis/observationTaxonomy';
import { zoneOrder, zonePresentation } from '@/data/zonePresentation';
import { FACE_CANVAS, zoneGeometry } from '@/data/zoneGeometry';
import { colors, radius } from '@/theme';

interface FacialZoneMapProps {
  selectedZone: SkinZone;
  onSelectZone: (zone: SkinZone) => void;
}

export function FacialZoneMap({ selectedZone, onSelectZone }: FacialZoneMapProps) {
  const selectedGeometry = zoneGeometry[selectedZone];

  return (
    <View style={styles.stage}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.faceCanvas}>
        <FaceIllustration />
        <View pointerEvents="none" style={[styles.highlight, selectedGeometry.highlight]} />
        {zoneOrder.map((zone) => {
          const selected = zone === selectedZone;
          const marker = zoneGeometry[zone].marker;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${zonePresentation[zone].label}`}
              accessibilityState={{ selected }}
              hitSlop={7}
              key={zone}
              onPress={() => onSelectZone(zone)}
              style={({ pressed }) => [
                styles.marker,
                { left: marker.left - 11, top: marker.top - 11 },
                selected && styles.markerSelected,
                pressed && styles.markerPressed,
              ]}
            >
              <Text style={[styles.markerDot, selected && styles.markerDotSelected]}>●</Text>
            </Pressable>
          );
        })}
      </View>
      <View pointerEvents="none" style={styles.selectionLabel}>
        <Text style={styles.selectionLabelText}>{zonePresentation[selectedZone].label}</Text>
      </View>
      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.hintText}>Tap a facial zone</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 340, overflow: 'hidden', borderRadius: 26, backgroundColor: '#142840', alignItems: 'center', justifyContent: 'flex-end', borderWidth: 1, borderColor: colors.line },
  glow: { position: 'absolute', width: 310, height: 310, borderRadius: 155, backgroundColor: colors.blue, opacity: 0.09, top: 12 },
  faceCanvas: { width: FACE_CANVAS.width, height: FACE_CANVAS.height, position: 'relative' },
  highlight: { position: 'absolute', borderWidth: 2, borderColor: colors.gold, backgroundColor: `${colors.gold}20` },
  marker: { position: 'absolute', width: 22, height: 22, borderWidth: 1, borderColor: `${colors.lilac}AA`, borderRadius: 11, backgroundColor: 'rgba(8,17,31,.82)', alignItems: 'center', justifyContent: 'center' },
  markerSelected: { borderWidth: 2, borderColor: colors.gold, backgroundColor: colors.gold },
  markerPressed: { opacity: 0.68 },
  markerDot: { color: colors.lilac, fontSize: 7 },
  markerDotSelected: { color: colors.ink },
  selectionLabel: { position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(8,17,31,.82)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  selectionLabelText: { color: colors.gold, fontSize: 9, fontWeight: '800' },
  hint: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(8,17,31,.82)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  hintText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
});
