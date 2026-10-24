import { describe, expect, it } from "vitest";
import { type Dataset, type Item, getItem } from "./dataset";
import { EMPTY_CRITERIA, type FilterCriteria, search } from "./filter";
import { CATEGORIES, generateDataset } from "./generate";
import { createRandom, pick } from "./random";
import { createSearcher } from "./searcher";

/**
 * Deliberately naive reference implementation over plain `Item` objects,
 * written independently of the optimised columnar code.
 */
function referenceSearch(items: readonly Item[], criteria: FilterCriteria): number[] {
  const query = criteria.query.trim().toLowerCase();
  return items
    .filter(
      (item) =>
        item.name.toLowerCase().includes(query) &&
        (criteria.category === null || item.category === criteria.category) &&
        (criteria.minPrice === null || Math.round(item.price * 100) >= Math.round(criteria.minPrice * 100)) &&
        (criteria.maxPrice === null || Math.round(item.price * 100) <= Math.round(criteria.maxPrice * 100)) &&
        (criteria.status === "all" || item.status === criteria.status),
    )
    .map((item) => item.id);
}

const toIds = (dataset: Dataset, indices: Uint32Array) => Array.from(indices, (i) => dataset.ids[i]);

const dataset = generateDataset(20_000, 7);
const items = Array.from({ length: dataset.size }, (_, i) => getItem(dataset, i));
const QUERIES = ["", "d", "di", "dig", "digital", "digital s", "PRO", "pro ", "monitor 5", "zzz", "  kit "];

function randomCriteria(random: () => number): FilterCriteria {
  const min = random() < 0.5 ? null : Math.round(random() * 300_000) / 100;
  const max = random() < 0.5 ? null : Math.round(random() * 500_000) / 100;
  return {
    query: pick(random, QUERIES),
    category: random() < 0.5 ? null : pick(random, CATEGORIES),
    minPrice: min,
    maxPrice: max,
    status: pick(random, ["all", "active", "inactive"] as const),
  };
}

describe("search matches the reference implementation", () => {
  it("for random combinations of query and filters", () => {
    const random = createRandom(1);
    for (let run = 0; run < 200; run++) {
      const criteria = randomCriteria(random);
      expect(toIds(dataset, search(dataset, criteria)), JSON.stringify(criteria)).toEqual(
        referenceSearch(items, criteria),
      );
    }
  });
});

describe("createSearcher", () => {
  it("returns the same result object for equivalent criteria", () => {
    const searcher = createSearcher(dataset);
    const first = searcher({ ...EMPTY_CRITERIA, query: "Digital", minPrice: 1 });
    expect(searcher({ ...EMPTY_CRITERIA, query: " digital ", minPrice: 1.0 })).toBe(first);
  });

  it("narrows the previous result instead of rescanning while the user keeps typing", () => {
    const searcher = createSearcher(dataset);
    const broad = searcher({ ...EMPTY_CRITERIA, query: "di" });
    expect(broad.scanned).toBe(dataset.size);

    const narrow = searcher({ ...EMPTY_CRITERIA, query: "dig" });
    expect(narrow.scanned).toBe(broad.indices.length);

    const wider = searcher({ ...EMPTY_CRITERIA, query: "d" });
    expect(wider.scanned).toBe(dataset.size);
  });

  it("never returns stale results across a random sequence of edits", () => {
    // Simulates a user editing one control at a time, which exercises both the
    // narrowing path and the full-scan path in arbitrary order.
    const random = createRandom(2);
    const searcher = createSearcher(dataset);
    let criteria: FilterCriteria = EMPTY_CRITERIA;

    for (let step = 0; step < 300; step++) {
      const next = randomCriteria(random);
      const field = pick(random, ["query", "category", "minPrice", "maxPrice", "status"] as const);
      criteria = { ...criteria, [field]: next[field] };
      expect(toIds(dataset, searcher(criteria).indices), JSON.stringify(criteria)).toEqual(
        referenceSearch(items, criteria),
      );
    }
  });
});
