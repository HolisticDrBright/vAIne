import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { getCatalogCommercialLink } from '@/data/catalogCommercialLinks';
import { colors, radius } from '@/theme';

export function ProductPurchaseLink({ productId, productName }: { productId: string; productName: string }) {
  const link = getCatalogCommercialLink(productId);
  if (!link) return null;

  const affiliate = link.affiliateRelationship !== 'none';
  const openProduct = async () => {
    try {
      await Linking.openURL(link.destinationUrl);
    } catch {
      Alert.alert('Could not open this product', 'Please try again when you have an internet connection.');
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${affiliate ? 'Buy' : 'View'} ${productName}`}
        onPress={() => void openProduct()}
        style={({ pressed }) => [styles.button, affiliate && styles.affiliateButton, pressed && styles.pressed]}
      >
        <Text style={[styles.buttonText, affiliate && styles.affiliateButtonText]}>
          {affiliate ? 'Buy product' : 'View product'}  ↗
        </Text>
      </Pressable>
      {link.disclosure ? <Text style={styles.disclosure}>{link.disclosure}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', gap: 5, marginTop: 9 },
  button: {
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: `${colors.white}AA`,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affiliateButton: { backgroundColor: colors.blue, borderColor: colors.blue },
  buttonText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  affiliateButtonText: { color: colors.white },
  disclosure: { color: colors.muted, fontSize: 8, lineHeight: 12, maxWidth: 320 },
  pressed: { opacity: 0.76 },
});
