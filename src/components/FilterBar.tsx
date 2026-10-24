import { type Dispatch, memo, useId } from "react";
import { type StatusFilter } from "@/lib/filter";
import { type FilterFormAction, type FilterFormState } from "@/lib/filter-form";
import styles from "./SearchApp.module.css";

type FilterBarProps = {
  form: FilterFormState;
  categories: readonly string[];
  dispatch: Dispatch<FilterFormAction>;
  canReset: boolean;
  priceRangeInvalid: boolean;
};

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const FilterBar = memo(function FilterBar({
  form,
  categories,
  dispatch,
  canReset,
  priceRangeInvalid,
}: FilterBarProps) {
  const id = useId();
  const change = (patch: Partial<FilterFormState>) => dispatch({ type: "change", patch });

  return (
    <form className={styles.filters} role="search" onSubmit={(event) => event.preventDefault()}>
      <div className={`${styles.field} ${styles.queryField}`}>
        <label htmlFor={`${id}-query`} className={styles.label}>
          Name
        </label>
        <input
          id={`${id}-query`}
          type="search"
          value={form.query}
          onChange={(event) => change({ query: event.target.value })}
          placeholder="Search by name…"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${id}-category`} className={styles.label}>
          Category
        </label>
        <select
          id={`${id}-category`}
          value={form.category}
          onChange={(event) => change({ category: event.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div
        role="group"
        className={`${styles.field} ${styles.priceField}`}
        aria-labelledby={`${id}-price`}
        aria-describedby={priceRangeInvalid ? `${id}-price-error` : undefined}
      >
        <span id={`${id}-price`} className={styles.label}>
          Price
        </span>
        <div className={styles.priceInputs}>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.minPrice}
            onChange={(event) => change({ minPrice: event.target.value })}
            placeholder="Min"
            aria-label="Minimum price"
            aria-invalid={priceRangeInvalid}
          />
          <span aria-hidden="true">–</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.maxPrice}
            onChange={(event) => change({ maxPrice: event.target.value })}
            placeholder="Max"
            aria-label="Maximum price"
            aria-invalid={priceRangeInvalid}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${id}-status`} className={styles.label}>
          Status
        </label>
        <select
          id={`${id}-status`}
          value={form.status}
          onChange={(event) => change({ status: event.target.value as StatusFilter })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className={styles.reset}
        onClick={() => dispatch({ type: "reset" })}
        disabled={!canReset}
      >
        Reset
      </button>

      {priceRangeInvalid && (
        <p id={`${id}-price-error`} className={styles.error} role="alert">
          Minimum price is greater than maximum price.
        </p>
      )}
    </form>
  );
});
