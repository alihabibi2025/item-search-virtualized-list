import { describe, expect, it } from "vitest";
import { createDataset, getItem } from "./dataset";
import { CATEGORIES, ITEM_COUNT, generateDataset } from "./generate";

describe("generateDataset", () => {
  const dataset = generateDataset();

  it("generates 100,000 items with sequential unique ids", () => {
    expect(ITEM_COUNT).toBe(100_000);
    expect(dataset.size).toBe(ITEM_COUNT);
    expect(dataset.ids[0]).toBe(1);
    expect(dataset.ids[ITEM_COUNT - 1]).toBe(ITEM_COUNT);
    expect(new Set(dataset.ids).size).toBe(ITEM_COUNT);
  });

  it("produces well-formed items", () => {
    for (const index of [0, 1, 4_242, 50_000, ITEM_COUNT - 1]) {
      const item = getItem(dataset, index);
      expect(item.name.length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(item.category);
      expect(item.price).toBeGreaterThan(0);
      expect(Number.isInteger(Math.round(item.price * 100))).toBe(true);
      expect(["active", "inactive"]).toContain(item.status);
      expect(dataset.searchNames[index]).toBe(item.name.toLowerCase());
    }
  });

  it("is deterministic for a given seed", () => {
    const again = generateDataset(1_000);
    const other = generateDataset(1_000, 123);
    expect(again.names).toEqual(dataset.names.slice(0, 1_000));
    expect(other.names).not.toEqual(again.names);
  });
});

describe("createDataset / getItem", () => {
  it("round-trips plain items through the columnar representation", () => {
    const items = [
      { id: 10, name: "A", category: "X", price: 12.34, status: "active" as const },
      { id: 20, name: "B", category: "Y", price: 0.5, status: "inactive" as const },
      { id: 30, name: "C", category: "X", price: 999.99, status: "active" as const },
    ];
    const dataset = createDataset(items);
    expect(dataset.categories).toEqual(["X", "Y"]);
    expect(items.map((_, i) => getItem(dataset, i))).toEqual(items);
  });
});
