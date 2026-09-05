/** Small display helpers shared by the routine and product-list screens. */

const priceFormatters = new Map<string, Intl.NumberFormat>();

export const PRICE_NOT_VERIFIED = 'Price not yet verified';

export function formatPrice(amountCents: number | null, currencyCode: string): string {
  if (amountCents === null) return PRICE_NOT_VERIFIED;
  let formatter = priceFormatters.get(currencyCode);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode });
    } catch {
      formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    }
    priceFormatters.set(currencyCode, formatter);
  }
  return formatter.format(amountCents / 100);
}

/** Turns an observation tag into plain words for the interface. */
export function describeTag(tag: string): string {
  return tag.replace(/^appearance\./, '').replace(/^referral\./, '').replaceAll('_', ' ');
}
