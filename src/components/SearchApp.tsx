"use client";

import { useCallback, useMemo, useReducer } from "react";
import { type Dataset } from "@/lib/dataset";
import { INITIAL_FORM_STATE, filterFormReducer, isPristine, toCriteria } from "@/lib/filter-form";
import { formatCount, formatDuration } from "@/lib/format";
import { createSearcher } from "@/lib/searcher";
import { FilterBar } from "./FilterBar";
import { ResultRow } from "./ResultRow";
import { VirtualList } from "./VirtualList";
import styles from "./SearchApp.module.css";

const ROW_HEIGHT = 44;

/**
 * Results are derived synchronously from the same state that drives the
 * inputs, in the same render. There is no debounce, deferred value or async
 * hop, so the list can never show results for a previous input: what is on
 * screen always matches what is in the controls. Filtering is fast enough
 * (a few milliseconds for 100k items, less while narrowing) to keep this
 * well within a frame.
 */
export function SearchApp({ dataset }: { dataset: Dataset }) {
  const [form, dispatch] = useReducer(filterFormReducer, INITIAL_FORM_STATE);
  const search = useMemo(() => createSearcher(dataset), [dataset]);
  const criteria = useMemo(() => toCriteria(form), [form]);
  // The searcher returns the same result object when the effective criteria
  // did not change, so everything below stays memoised in that case.
  const result = useMemo(() => search(criteria), [search, criteria]);
  const { indices } = result;

  const priceRangeInvalid =
    criteria.minPrice !== null && criteria.maxPrice !== null && criteria.minPrice > criteria.maxPrice;

  const getRowKey = useCallback((row: number) => dataset.ids[indices[row]], [dataset, indices]);
  const renderRow = useCallback(
    (row: number) => <ResultRow dataset={dataset} itemIndex={indices[row]} />,
    [dataset, indices],
  );

  return (
    <div className={styles.app}>
      <FilterBar
        form={form}
        categories={dataset.categories}
        dispatch={dispatch}
        canReset={!isPristine(form)}
        priceRangeInvalid={priceRangeInvalid}
      />

      <div className={styles.summary}>
        <p aria-live="polite">
          <strong>{formatCount(indices.length)}</strong> of {formatCount(dataset.size)} items
        </p>
        <p className={styles.timing}>
          {formatDuration(result.durationMs)} · scanned {formatCount(result.scanned)}
        </p>
      </div>

      <div className={styles.table}>
        <div className={`${styles.columns} ${styles.header}`} aria-hidden="true">
          <span>ID</span>
          <span>Name</span>
          <span>Category</span>
          <span className={styles.price}>Price</span>
          <span>Status</span>
        </div>
        <div className={styles.body}>
          {indices.length === 0 ? (
            <p className={styles.empty}>No items match the current search and filters.</p>
          ) : (
            <VirtualList
              rowCount={indices.length}
              rowHeight={ROW_HEIGHT}
              getRowKey={getRowKey}
              renderRow={renderRow}
              resetKey={indices}
              aria-label="Search results"
            />
          )}
        </div>
      </div>
    </div>
  );
}
