// Formatters are created once: constructing Intl objects per row is costly.
const priceFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const countFormatter = new Intl.NumberFormat("en-US");

export const formatPrice = (price: number): string => priceFormatter.format(price);
export const formatCount = (count: number): string => countFormatter.format(count);

/** Browsers coarsen `performance.now()` (often to 0.1 ms), so tiny values are shown as a bound. */
export const formatDuration = (ms: number): string => (ms < 0.1 ? "< 0.1 ms" : `${ms.toFixed(1)} ms`);
