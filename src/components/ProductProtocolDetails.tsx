import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { getProductUseProtocol, type ProtocolProduct } from '@/data/productUseProtocols';
import { colors, radius } from '@/theme';

const sourceKindLabels = {
  official_product: 'OFFICIAL PRODUCT DIRECTIONS',
  official_brand_protocol: 'OFFICIAL BRAND PROTOCOL',
  catalog_research: 'CATALOG NOTE — VERIFY LABEL',
} as const;

export function ProductProtocolDetails({ product }: { product: ProtocolProduct }) {
  const protocol = getProductUseProtocol(product);

  const openSource = async () => {
    if (!protocol.sourceUrl) return;
    try {
      await Linking.openURL(protocol.sourceUrl);
    } catch {
      Alert.alert('Could not open the source', 'Please try again when you have an internet connection.');
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.badge, protocol.sourceKind === 'catalog_research' && styles.unverifiedBadge]}>
        {sourceKindLabels[protocol.sourceKind]}
      </Text>
      <Text style={styles.line}><Text style={styles.label}>Use: </Text>{protocol.intendedUse}</Text>
      <Text style={styles.line}><Text style={styles.label}>When: </Text>{protocol.cadence}</Text>
      <Text style={styles.line}><Text style={styles.label}>How: </Text>{protocol.application}</Text>
      <Text style={styles.line}><Text style={styles.label}>Order: </Text>{protocol.routineOrder}</Text>
      {protocol.safetyAdaptation ? <Text style={styles.safety}>{protocol.safetyAdaptation}</Text> : null}
      {protocol.sourceUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open manufacturer directions for ${product.productName}`}
          onPress={() => void openSource()}
          style={({ pressed }) => [styles.sourceButton, pressed && styles.pressed]}
        >
          <Text style={styles.sourceText}>{protocol.sourceLabel} ↗</Text>
        </Pressable>
      ) : (
        <Text style={styles.unverifiedSource}>{protocol.sourceLabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 9,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: `${colors.blue}36`,
    backgroundColor: `${colors.blue}08`,
    padding: 10,
    gap: 4,
  },
  badge: { color: colors.blue, fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  unverifiedBadge: { color: colors.gold },
  line: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  label: { color: colors.text, fontWeight: '800' },
  safety: { color: colors.gold, fontSize: 9, lineHeight: 14, marginTop: 2 },
  sourceButton: { alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center', marginTop: 2 },
  sourceText: { color: colors.oliveDark, fontSize: 9, fontWeight: '700', textDecorationLine: 'underline' },
  unverifiedSource: { color: colors.gold, fontSize: 8, lineHeight: 12, marginTop: 2 },
  pressed: { opacity: 0.72 },
});
