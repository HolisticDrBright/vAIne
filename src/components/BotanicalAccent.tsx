import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

export function BotanicalAccent({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.branch, mirrored && styles.mirrored]}>
      <View style={styles.stem} />
      <View style={[styles.leaf, styles.leafOne]} />
      <View style={[styles.leaf, styles.leafTwo]} />
      <View style={[styles.leaf, styles.leafThree]} />
      <View style={[styles.leaf, styles.leafFour]} />
    </View>
  );
}

const styles = StyleSheet.create({
  branch: { width: 92, height: 120, opacity: 0.5 },
  mirrored: { transform: [{ scaleX: -1 }] },
  stem: { position: 'absolute', width: 1, height: 112, backgroundColor: colors.gold, left: 45, top: 4, transform: [{ rotate: '28deg' }] },
  leaf: { position: 'absolute', width: 32, height: 15, borderWidth: 1, borderColor: colors.gold, borderTopLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: `${colors.sageWash}55` },
  leafOne: { left: 41, top: 13, transform: [{ rotate: '17deg' }] },
  leafTwo: { left: 18, top: 38, transform: [{ rotate: '-34deg' }] },
  leafThree: { left: 54, top: 60, transform: [{ rotate: '18deg' }] },
  leafFour: { left: 28, top: 83, transform: [{ rotate: '-27deg' }] },
});
