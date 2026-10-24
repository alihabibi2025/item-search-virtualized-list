import { type FilterCriteria, type StatusFilter, parsePriceInput } from "./filter";

/**
 * Raw values of the filter controls. Price inputs are kept as strings so that
 * intermediate input like "12." is preserved while the user types.
 */
export type FilterFormState = {
  query: string;
  /** "" = all categories. */
  category: string;
  minPrice: string;
  maxPrice: string;
  status: StatusFilter;
};

export const INITIAL_FORM_STATE: FilterFormState = {
  query: "",
  category: "",
  minPrice: "",
  maxPrice: "",
  status: "all",
};

export type FilterFormAction = { type: "change"; patch: Partial<FilterFormState> } | { type: "reset" };

export function filterFormReducer(state: FilterFormState, action: FilterFormAction): FilterFormState {
  switch (action.type) {
    case "change":
      return { ...state, ...action.patch };
    case "reset":
      return INITIAL_FORM_STATE;
  }
}

export function toCriteria(form: FilterFormState): FilterCriteria {
  return {
    query: form.query,
    category: form.category === "" ? null : form.category,
    minPrice: parsePriceInput(form.minPrice),
    maxPrice: parsePriceInput(form.maxPrice),
    status: form.status,
  };
}

export function isPristine(form: FilterFormState): boolean {
  return (
    form.query === INITIAL_FORM_STATE.query &&
    form.category === INITIAL_FORM_STATE.category &&
    form.minPrice === INITIAL_FORM_STATE.minPrice &&
    form.maxPrice === INITIAL_FORM_STATE.maxPrice &&
    form.status === INITIAL_FORM_STATE.status
  );
}
