import { StyleSheet, View } from 'react-native';

export function FaceIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.frame, compact && styles.frameCompact]}>
      <View style={[styles.hair, compact && styles.hairCompact]} />
      <View style={[styles.face, compact && styles.faceCompact]}>
        <View style={styles.eyes}><View style={styles.eye} /><View style={styles.eye} /></View>
        <View style={styles.nose} />
        <View style={styles.mouth} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 214, height: 268, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  frameCompact: { width: 130, height: 167, marginRight: -12 },
  hair: { position: 'absolute', top: 12, width: 182, height: 220, borderRadius: 95, backgroundColor: '#1F1C26' },
  hairCompact: { width: 120, height: 145, borderRadius: 70 },
  face: { width: 153, height: 205, borderRadius: 80, backgroundColor: '#B97255', alignItems: 'center', paddingTop: 70, zIndex: 1 },
  faceCompact: { transform: [{ scale: 0.7 }], marginBottom: -29 },
  eyes: { flexDirection: 'row', gap: 34 },
  eye: { width: 20, height: 9, borderRadius: 9, backgroundColor: '#171821' },
  nose: { width: 10, height: 21, marginTop: 17, borderBottomWidth: 2, borderColor: '#74442F', borderRadius: 5 },
  mouth: { width: 38, height: 12, backgroundColor: '#7C3440', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, marginTop: 15 },
});
