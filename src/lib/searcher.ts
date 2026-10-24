import { type Dataset } from "./dataset";
import {
  type CompiledCriteria,
  type FilterCriteria,
  compileCriteria,
  filterIndices,
  isRefinement,
  isSameCriteria,
  isUnconstrained,
} from "./filter";

export type SearchResult = {
  /** Matching dataset indices, in dataset order. */
  readonly indices: Uint32Array;
  /** How many items were tested to produce this result. */
  readonly scanned: number;
  /** Wall-clock time spent filtering, in milliseconds. */
  readonly durationMs: number;
};

export type Searcher = (criteria: FilterCriteria) => SearchResult;

/**
 * Wraps the pure filter functions with a one-entry memo:
 *
 * - identical (compiled) criteria return the previous result object as-is, so
 *   inputs that do not change the outcome ("1" → "1.0") cause no re-render;
 * - criteria that only narrow the previous ones are evaluated over the
 *   previous matches instead of all items, which makes the common
 *   "keep typing" case scan progressively fewer items.
 *
 * Only the last result is retained, so memory stays bounded by one index
 * array.
 */
export function createSearcher(dataset: Dataset, now: () => number = () => performance.now()): Searcher {
  let previous: { compiled: CompiledCriteria; result: SearchResult } | null = null;

  return (criteria) => {
    const compiled = compileCriteria(criteria, dataset.categories);
    if (previous && isSameCriteria(compiled, previous.compiled)) return previous.result;

    const start = now();
    const candidates =
      previous && isRefinement(compiled, previous.compiled) ? previous.result.indices : undefined;
    const indices = filterIndices(dataset, compiled, candidates);
    const result: SearchResult = {
      indices,
      scanned: compiled.impossible || isUnconstrained(compiled) ? 0 : (candidates?.length ?? dataset.size),
      durationMs: now() - start,
    };

    previous = { compiled, result };
    return result;
  };
}
