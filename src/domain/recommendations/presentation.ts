/** Small display helpers shared by the routine and product-list screens. */

const priceFormatters = new Map<string, Intl.NumberFormat>();

export function formatPrice(amountCents: number, currencyCode: string): string {
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
