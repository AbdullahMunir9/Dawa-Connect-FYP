export const PLATFORM_PROCESSING_FEE = 9;

export function processingFeeFor(subtotal) {
  return Math.max(0, Number(subtotal) || 0) > 0 ? PLATFORM_PROCESSING_FEE : 0;
}
