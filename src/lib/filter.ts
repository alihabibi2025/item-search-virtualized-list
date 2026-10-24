import { type Dataset, type Status, toCents } from "./dataset";

export type StatusFilter = "all" | Status;

/** User-facing filter state. Prices are in currency units, `null` = unbounded. */
export type FilterCriteria = {
  query: string;
  category: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  status: StatusFilter;
};

export const EMPTY_CRITERIA: FilterCriteria = {
  query: "",
  category: null,
  minPrice: null,
  maxPrice: null,
  status: "all",
};

/**
 * Criteria normalised against a dataset into the cheapest form to evaluate:
 * the query is lower-cased once, the category becomes its numeric code and
 * prices become integer cents.
 */
export type CompiledCriteria = {
  readonly needle: string;
  /** -1 = any category. */
  readonly categoryCode: number;
  readonly minCents: number;
  readonly maxCents: number;
  /** -1 = any status, otherwise the expected value of `dataset.active`. */
  readonly active: number;
  /** True when no item can possibly match (unknown category, min > max). */
  readonly impossible: boolean;
};

const ANY = -1;
const UNBOUNDED_MAX = Number.POSITIVE_INFINITY;

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function compileCriteria(criteria: FilterCriteria, categories: readonly string[]): CompiledCriteria {
  const categoryCode = criteria.category === null ? ANY : categories.indexOf(criteria.category);
  const unknownCategory = criteria.category !== null && categoryCode === -1;
  const minCents = criteria.minPrice === null ? 0 : toCents(criteria.minPrice);
  const maxCents = criteria.maxPrice === null ? UNBOUNDED_MAX : toCents(criteria.maxPrice);

  return {
    needle: normalizeQuery(criteria.query),
    categoryCode,
    minCents,
    maxCents,
    active: criteria.status === "all" ? ANY : criteria.status === "active" ? 1 : 0,
    impossible: unknownCategory || minCents > maxCents,
  };
}

export function isSameCriteria(a: CompiledCriteria, b: CompiledCriteria): boolean {
  return (
    a.needle === b.needle &&
    a.categoryCode === b.categoryCode &&
    a.minCents === b.minCents &&
    a.maxCents === b.maxCents &&
    a.active === b.active &&
    a.impossible === b.impossible
  );
}

/**
 * True when every item matching `next` is guaranteed to also match `prev`,
 * i.e. `next` only narrows `prev`. In that case `next` can be evaluated over
 * the previous result instead of the full dataset (typing "ab" → "abc",
 * raising the minimum price, picking a category after "All", ...).
 */
export function isRefinement(next: CompiledCriteria, prev: CompiledCriteria): boolean {
  return (
    !prev.impossible &&
    next.needle.includes(prev.needle) &&
    (prev.categoryCode === ANY || prev.categoryCode === next.categoryCode) &&
    next.minCents >= prev.minCents &&
    next.maxCents <= prev.maxCents &&
    (prev.active === ANY || prev.active === next.active)
  );
}

const NO_MATCHES = new Uint32Array(0);

/** True when the criteria match every item, so no item needs to be tested. */
export function isUnconstrained(criteria: CompiledCriteria): boolean {
  return (
    criteria.needle === "" &&
    criteria.categoryCode === ANY &&
    criteria.minCents === 0 &&
    criteria.maxCents === UNBOUNDED_MAX &&
    criteria.active === ANY
  );
}

function allIndices(size: number): Uint32Array {
  const indices = new Uint32Array(size);
  for (let i = 0; i < size; i++) indices[i] = i;
  return indices;
}

/**
 * Returns the dataset indices that satisfy `criteria`, in dataset order.
 *
 * Pure: depends only on its arguments and never mutates them (the returned
 * array may be `candidates` itself when nothing is filtered, so callers must
 * treat results as read-only). When `candidates` is given, only those indices
 * are tested; they must be ascending for the output to stay in dataset order.
 *
 * Cheap checks run first (status and category are single byte reads, price is
 * two integer comparisons) so the comparatively expensive substring search
 * only runs for items that already passed every other filter.
 */
export function filterIndices(
  dataset: Dataset,
  criteria: CompiledCriteria,
  candidates?: Uint32Array,
): Uint32Array {
  if (criteria.impossible) return NO_MATCHES;
  if (isUnconstrained(criteria)) return candidates ?? allIndices(dataset.size);

  const { searchNames, categoryCodes, priceCents, active } = dataset;
  const { needle, categoryCode, minCents, maxCents } = criteria;
  const wantedActive = criteria.active;
  const total = candidates ? candidates.length : dataset.size;
  const out = new Uint32Array(total);
  let count = 0;

  for (let k = 0; k < total; k++) {
    const i = candidates ? candidates[k] : k;
    if (wantedActive !== ANY && active[i] !== wantedActive) continue;
    if (categoryCode !== ANY && categoryCodes[i] !== categoryCode) continue;
    const price = priceCents[i];
    if (price < minCents || price > maxCents) continue;
    if (needle !== "" && !searchNames[i].includes(needle)) continue;
    out[count++] = i;
  }

  // Copy into a right-sized buffer so a narrow result does not keep the
  // full-size scratch buffer alive.
  return count === total ? out : out.slice(0, count);
}

/** Convenience wrapper: plain criteria in, matching indices out. */
export function search(dataset: Dataset, criteria: FilterCriteria): Uint32Array {
  return filterIndices(dataset, compileCriteria(criteria, dataset.categories));
}

/**
 * Parses the raw value of a price input. Empty, non-numeric and negative
 * values mean "no bound".
 */
export function parsePriceInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
