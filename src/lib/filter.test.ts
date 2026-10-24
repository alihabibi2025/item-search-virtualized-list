import { describe, expect, it } from "vitest";
import { fixtureDataset, idsOf } from "@/test/fixtures";
import {
  EMPTY_CRITERIA,
  type FilterCriteria,
  compileCriteria,
  filterIndices,
  isRefinement,
  parsePriceInput,
  search,
} from "./filter";

const dataset = fixtureDataset();
const find = (criteria: Partial<FilterCriteria>) =>
  idsOf(dataset, search(dataset, { ...EMPTY_CRITERIA, ...criteria }));
const compile = (criteria: Partial<FilterCriteria>) =>
  compileCriteria({ ...EMPTY_CRITERIA, ...criteria }, dataset.categories);

describe("search by name", () => {
  it("returns every item, in dataset order, when no criteria are set", () => {
    expect(find({})).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("is case-insensitive in both the query and the names", () => {
    expect(find({ query: "DIGITAL" })).toEqual([1, 2, 7]);
    expect(find({ query: "thermo" })).toEqual([1, 5]);
    expect(find({ query: "ThErMoMeTeR" })).toEqual([1]);
  });

  it("matches substrings anywhere in the name", () => {
    expect(find({ query: "scope" })).toEqual([6]);
    expect(find({ query: "al m" })).toEqual([7]);
  });

  it("ignores surrounding whitespace and treats a blank query as no filter", () => {
    expect(find({ query: "  monitor  " })).toEqual([4, 7]);
    expect(find({ query: "   " })).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns nothing when no name matches", () => {
    expect(find({ query: "wheelchair" })).toEqual([]);
  });
});

describe("filters", () => {
  it("filters by category", () => {
    expect(find({ category: "Cardiology" })).toEqual([4, 6, 7]);
  });

  it("returns nothing for an unknown category", () => {
    expect(find({ category: "Astrology" })).toEqual([]);
  });

  it("filters by status", () => {
    expect(find({ status: "active" })).toEqual([1, 3, 4, 7]);
    expect(find({ status: "inactive" })).toEqual([2, 5, 6]);
  });

  it("filters by an inclusive price range", () => {
    expect(find({ minPrice: 19.99, maxPrice: 249 })).toEqual([1, 2, 3, 6]);
  });

  it("supports open-ended price ranges", () => {
    expect(find({ minPrice: 200 })).toEqual([4, 6]);
    expect(find({ maxPrice: 5 })).toEqual([5, 7]);
    expect(find({ minPrice: 0 })).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("compares prices exactly despite floating point input", () => {
    // 0.1 + 0.2 = 0.30000000000000004 must still exclude a 0.10 item from [0.3, ∞).
    expect(find({ minPrice: 0.1 + 0.2 })).not.toContain(7);
    expect(find({ minPrice: 0.1, maxPrice: 0.1 })).toEqual([7]);
    expect(find({ minPrice: 45.5, maxPrice: 45.5 })).toEqual([2]);
  });

  it("returns nothing when the minimum price exceeds the maximum", () => {
    expect(find({ minPrice: 100, maxPrice: 50 })).toEqual([]);
  });
});

describe("combined search and filters", () => {
  it("requires every criterion to match (logical AND)", () => {
    expect(find({ query: "digital", status: "active" })).toEqual([1, 7]);
    expect(find({ query: "digital", category: "Cardiology" })).toEqual([7]);
    expect(find({ category: "Cardiology", status: "inactive" })).toEqual([6]);
    expect(find({ category: "Diagnostics", maxPrice: 10 })).toEqual([5]);
  });

  it("combines all four criteria", () => {
    expect(
      find({ query: "monitor", category: "Cardiology", minPrice: 100, maxPrice: 1000, status: "active" }),
    ).toEqual([4]);
    expect(
      find({ query: "monitor", category: "Cardiology", minPrice: 100, maxPrice: 1000, status: "inactive" }),
    ).toEqual([]);
  });

  it("does not mutate the dataset", () => {
    const before = structuredClone(dataset);
    find({ query: "digital", category: "Cardiology", minPrice: 1, status: "active" });
    expect(dataset).toEqual(before);
  });
});

describe("filterIndices with candidates", () => {
  it("only tests the given candidate indices", () => {
    const candidates = Uint32Array.of(0, 3, 6);
    expect(idsOf(dataset, filterIndices(dataset, compile({ status: "active" }), candidates))).toEqual([
      1, 4, 7,
    ]);
    expect(idsOf(dataset, filterIndices(dataset, compile({ query: "monitor" }), candidates))).toEqual([4, 7]);
  });
});

describe("isRefinement", () => {
  it("detects criteria that can only narrow the previous result", () => {
    expect(isRefinement(compile({ query: "dig" }), compile({ query: "di" }))).toBe(true);
    expect(isRefinement(compile({ query: "xdigx" }), compile({ query: "dig" }))).toBe(true);
    expect(isRefinement(compile({ category: "Pharmacy" }), compile({}))).toBe(true);
    expect(isRefinement(compile({ status: "active" }), compile({}))).toBe(true);
    expect(
      isRefinement(compile({ minPrice: 20, maxPrice: 50 }), compile({ minPrice: 10, maxPrice: 60 })),
    ).toBe(true);
  });

  it("rejects criteria that may match items the previous result excluded", () => {
    expect(isRefinement(compile({ query: "di" }), compile({ query: "dig" }))).toBe(false);
    expect(isRefinement(compile({ category: "Nutrition" }), compile({ category: "Pharmacy" }))).toBe(false);
    expect(isRefinement(compile({}), compile({ status: "active" }))).toBe(false);
    expect(isRefinement(compile({ minPrice: 5 }), compile({ minPrice: 10 }))).toBe(false);
    expect(isRefinement(compile({ maxPrice: 70 }), compile({ maxPrice: 60 }))).toBe(false);
    expect(isRefinement(compile({ minPrice: 1 }), compile({ minPrice: 10, maxPrice: 5 }))).toBe(false);
  });
});

describe("parsePriceInput", () => {
  it.each([
    ["", null],
    ["   ", null],
    ["abc", null],
    ["-5", null],
    ["0", 0],
    ["12.5", 12.5],
    [" 7 ", 7],
  ])("parses %j as %j", (raw, expected) => {
    expect(parsePriceInput(raw)).toBe(expected);
  });
});

describe("unconstrained criteria", () => {
  it("returns the candidates unchanged when nothing is filtered", () => {
    const candidates = Uint32Array.of(1, 4);
    expect(filterIndices(dataset, compile({ query: "  " }), candidates)).toBe(candidates);
  });
});
