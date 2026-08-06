import { useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { FaceIllustration } from './FaceIllustration';
import type { SkinZone } from '@/domain/analysis/observationTaxonomy';
import type { NormalizedRect, Size } from '@/domain/zones/zoneAlignment';
import { getZoneZoomLayout } from '@/domain/zones/zoneAlignment';
import { zonePresentation } from '@/data/zonePresentation';
import { colors, radius } from '@/theme';

const CROP_HEIGHT = 260;

const facePositions: Record<SkinZone, ViewStyle> = {
  forehead: { top: 36 },
  under_eyes: { top: -16 },
  cheeks: { top: -58 },
  nose_t_zone: { top: -54 },
  mouth_lips: { top: -142 },
  jawline: { top: -148 },
  chin: { top: -174 },
};

const photoOffsets: Record<SkinZone, number> = {
  forehead: 66,
  under_eyes: 38,
  cheeks: 5,
  nose_t_zone: 15,
  mouth_lips: -42,
  jawline: -55,
  chin: -72,
};

interface ZoneZoomIllustrationProps {
  zone: SkinZone;
  photoUri?: string;
  /** Original pixel size of the photo; required for aligned cropping. */
  photoSize?: Size;
  /**
   * Individually derived zone rect (normalized to the ORIGINAL photo). When
   * present, the view pans/zooms the original file so this zone fills the
   * crop — never a screenshot or a pre-enlarged copy. When absent, the honest
   * fixed-guide crop is used and labeled as such.
   */
  zoneRect?: NormalizedRect | null;
}

export function ZoneZoomIllustration({ zone, photoUri, photoSize, zoneRect }: ZoneZoomIllustrationProps) {
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const aligned = Boolean(photoUri && photoSize && zoneRect);

  const onLayout = (event: LayoutChangeEvent) => {
    setViewportWidth(event.nativeEvent.layout.width);
  };

  const alignedLayout = aligned && viewportWidth && photoSize && zoneRect
    ? getZoneZoomLayout(zoneRect, photoSize, { width: viewportWidth, height: CROP_HEIGHT })
    : null;

  return (
    <View onLayout={onLayout} style={styles.crop}>
      <View pointerEvents="none" style={styles.glow} />
      {photoUri && alignedLayout ? (
        <Image
          accessibilityLabel={`Magnified ${zonePresentation[zone].label} aligned from your local front photo`}
          source={{ uri: photoUri }}
          style={{
            position: 'absolute',
            width: alignedLayout.imageWidth,
            height: alignedLayout.imageHeight,
            left: alignedLayout.offsetX,
            top: alignedLayout.offsetY,
          }}
        />
      ) : photoUri && !aligned ? (
        <Image
          accessibilityLabel={`Magnified ${zonePresentation[zone].label} from your local front photo`}
          source={{ uri: photoUri }}
          style={[styles.photo, { transform: [{ scale: 2.05 }, { translateY: photoOffsets[zone] }] }]}
        />
      ) : !photoUri ? (
        <View style={[styles.faceLayer, facePositions[zone]]}>
          <View style={styles.faceScale}><FaceIllustration /></View>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.focusFrame} />
      <View style={styles.label}>
        <Text style={styles.labelText}>{zonePresentation[zone].label.toUpperCase()}</Text>
      </View>
      {photoUri ? (
        <View pointerEvents="none" style={styles.localBadge}>
          <Text style={styles.localBadgeText}>
            {aligned ? 'LOCAL PHOTO · ALIGNED ON-DEVICE' : 'LOCAL PHOTO · FIXED GUIDE CROP'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  crop: { height: CROP_HEIGHT, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.sageWash, alignItems: 'center' },
  glow: { position: 'absolute', width: 330, height: 330, borderRadius: 165, backgroundColor: colors.white, opacity: 0.75, top: -50 },
  faceLayer: { position: 'absolute', alignItems: 'center' },
  faceScale: { transform: [{ scale: 1.75 }] },
  photo: { position: 'absolute', width: '100%', height: '100%', resizeMode: 'cover' },
  focusFrame: { position: 'absolute', left: 24, right: 24, top: 34, bottom: 34, borderRadius: 90, borderWidth: 1.5, borderColor: colors.gold, backgroundColor: `${colors.gold}0A` },
  label: { position: 'absolute', left: 14, bottom: 14, backgroundColor: `${colors.white}ED`, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill },
  labelText: { color: colors.oliveDark, fontWeight: '800', fontSize: 9, letterSpacing: 0.8 },
  localBadge: { position: 'absolute', right: 14, top: 14, backgroundColor: `${colors.white}ED`, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill },
  localBadgeText: { color: colors.green, fontSize: 7, fontWeight: '800', letterSpacing: 0.5 },
});
