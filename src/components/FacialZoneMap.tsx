import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { FaceIllustration } from './FaceIllustration';
import type { SkinZone } from '@/domain/analysis/observationTaxonomy';
import type { NormalizedRect, Size } from '@/domain/zones/zoneAlignment';
import { projectRectToContainer } from '@/domain/zones/zoneAlignment';
import { zoneOrder, zonePresentation } from '@/data/zonePresentation';
import { FACE_CANVAS, zoneGeometry } from '@/data/zoneGeometry';
import { colors, radius } from '@/theme';

interface FacialZoneMapProps {
  selectedZone: SkinZone;
  onSelectZone: (zone: SkinZone) => void;
  photoUri?: string;
  /** Original pixel size of the photo; required for aligned placement. */
  photoSize?: Size;
  /**
   * Individually derived zone rects (normalized to the photo). When absent,
   * the map uses the fixed guide — callers label the two modes honestly.
   */
  alignedZones?: Record<SkinZone, NormalizedRect> | null;
}

const MARKER_MARGIN = 14;

function clampToCanvas(value: number, max: number): number {
  return Math.min(Math.max(value, MARKER_MARGIN), max - MARKER_MARGIN);
}

export function FacialZoneMap({
  selectedZone,
  onSelectZone,
  photoUri,
  photoSize,
  alignedZones,
}: FacialZoneMapProps) {
  const aligned = Boolean(photoUri && photoSize && alignedZones);

  const geometryFor = (zone: SkinZone) => {
    if (aligned && photoSize && alignedZones) {
      const projected = projectRectToContainer(alignedZones[zone], photoSize, FACE_CANVAS);
      const highlight = {
        left: projected.left,
        top: projected.top,
        width: projected.width,
        height: projected.height,
        borderRadius: Math.min(projected.width, projected.height) * 0.35,
      };
      return {
        highlight,
        marker: {
          left: clampToCanvas(projected.left + projected.width / 2, FACE_CANVAS.width),
          top: clampToCanvas(projected.top + projected.height / 2, FACE_CANVAS.height),
        },
      };
    }
    return zoneGeometry[zone];
  };

  const selectedGeometry = geometryFor(selectedZone);

  return (
    <View style={styles.stage}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.faceCanvas}>
        {photoUri ? (
          <Image
            accessibilityLabel="Your local front check-in photo"
            source={{ uri: photoUri }}
            style={styles.photo}
          />
        ) : <FaceIllustration />}
        <View pointerEvents="none" style={[styles.highlight, selectedGeometry.highlight]} />
        {zoneOrder.map((zone) => {
          const selected = zone === selectedZone;
          const marker = geometryFor(zone).marker;
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
      {photoUri ? (
        <View pointerEvents="none" style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{aligned ? 'ALIGNED ON-DEVICE' : 'FIXED GUIDE'}</Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.hintText}>Tap a facial zone</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 340, overflow: 'hidden', borderRadius: 26, backgroundColor: colors.sageWash, alignItems: 'center', justifyContent: 'flex-end', borderWidth: 1, borderColor: colors.line },
  glow: { position: 'absolute', width: 310, height: 310, borderRadius: 155, backgroundColor: colors.white, opacity: 0.7, top: 12 },
  faceCanvas: { width: FACE_CANVAS.width, height: FACE_CANVAS.height, position: 'relative' },
  photo: { width: FACE_CANVAS.width, height: FACE_CANVAS.height, borderRadius: 104, borderWidth: 2, borderColor: colors.white, resizeMode: 'cover' },
  highlight: { position: 'absolute', borderWidth: 2, borderColor: colors.oliveDark, backgroundColor: `${colors.gold}24` },
  marker: { position: 'absolute', width: 22, height: 22, borderWidth: 1, borderColor: colors.oliveDark, borderRadius: 11, backgroundColor: `${colors.white}E8`, alignItems: 'center', justifyContent: 'center' },
  markerSelected: { borderWidth: 2, borderColor: colors.gold, backgroundColor: colors.gold },
  markerPressed: { opacity: 0.68 },
  markerDot: { color: colors.lilac, fontSize: 7 },
  markerDotSelected: { color: colors.ink },
  selectionLabel: { position: 'absolute', left: 12, top: 12, backgroundColor: `${colors.white}E8`, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  selectionLabelText: { color: colors.oliveDark, fontSize: 9, fontWeight: '800' },
  modeBadge: { position: 'absolute', right: 12, top: 12, backgroundColor: `${colors.white}E8`, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  modeBadgeText: { color: colors.green, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  hint: { position: 'absolute', right: 12, bottom: 12, backgroundColor: `${colors.white}E8`, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  hintText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
});
