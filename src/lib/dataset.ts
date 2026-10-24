export type Status = "active" | "inactive";

export type Item = {
  id: number;
  name: string;
  category: string;
  price: number;
  status: Status;
};

/**
 * Column-oriented ("struct of arrays") storage for the items.
 *
 * Instead of keeping 100k `Item` objects alive, every field lives in its own
 * array. Numeric fields use typed arrays (no per-item object headers, no boxed
 * numbers), categories are stored once and referenced by a 1-byte code, and
 * prices are integer cents so range checks are exact integer comparisons.
 * The filter loop therefore walks dense, cache-friendly memory, and `Item`
 * objects are only materialised for the handful of rows currently on screen.
 */
export type Dataset = {
  readonly size: number;
  readonly ids: Uint32Array;
  readonly names: readonly string[];
  /** Lower-cased names, precomputed once so searching never allocates. */
  readonly searchNames: readonly string[];
  /** Distinct category labels; `categoryCodes[i]` indexes into this list. */
  readonly categories: readonly string[];
  readonly categoryCodes: Uint8Array;
  readonly priceCents: Uint32Array;
  /** 1 = active, 0 = inactive. */
  readonly active: Uint8Array;
};

const MAX_CATEGORIES = 256; // must fit in a Uint8Array code

export function toCents(price: number): number {
  return Math.round(price * 100);
}

/** Builds a dataset from plain items (used by tests and the generator). */
export function createDataset(items: readonly Item[]): Dataset {
  const size = items.length;
  const ids = new Uint32Array(size);
  const names = new Array<string>(size);
  const searchNames = new Array<string>(size);
  const categoryCodes = new Uint8Array(size);
  const priceCents = new Uint32Array(size);
  const active = new Uint8Array(size);
  const categories: string[] = [];
  const codeByCategory = new Map<string, number>();

  for (let i = 0; i < size; i++) {
    const item = items[i];
    let code = codeByCategory.get(item.category);
    if (code === undefined) {
      code = categories.length;
      if (code >= MAX_CATEGORIES) {
        throw new RangeError(`At most ${MAX_CATEGORIES} distinct categories are supported`);
      }
      categories.push(item.category);
      codeByCategory.set(item.category, code);
    }

    ids[i] = item.id;
    names[i] = item.name;
    searchNames[i] = item.name.toLowerCase();
    categoryCodes[i] = code;
    priceCents[i] = toCents(item.price);
    active[i] = item.status === "active" ? 1 : 0;
  }

  return { size, ids, names, searchNames, categories, categoryCodes, priceCents, active };
}

/** Materialises a single row. Only called for rows that are actually rendered. */
export function getItem(dataset: Dataset, index: number): Item {
  return {
    id: dataset.ids[index],
    name: dataset.names[index],
    category: dataset.categories[dataset.categoryCodes[index]],
    price: dataset.priceCents[index] / 100,
    status: dataset.active[index] === 1 ? "active" : "inactive",
  };
}
