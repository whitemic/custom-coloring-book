/** Price in cents: $5 flat for ≤10 pages, +$0.50/page after */
export function calcLibraryPriceCents(pageCount: number): number {
  if (pageCount === 0) return 0;
  return 500 + Math.max(0, pageCount - 10) * 50;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
