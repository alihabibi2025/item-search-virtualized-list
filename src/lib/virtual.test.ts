import { describe, expect, it } from "vitest";
import { getVisibleRange } from "./virtual";

describe("getVisibleRange", () => {
  it("renders the visible rows plus overscan at the top of the list", () => {
    // 400px / 40px = 10 rows, +1 partial row, +2 overscan below.
    expect(getVisibleRange(0, 400, 40, 1_000, 2)).toEqual({ start: 0, end: 13 });
  });

  it("adds overscan on both sides in the middle of the list", () => {
    expect(getVisibleRange(100, 400, 40, 1_000, 2)).toEqual({ start: 98, end: 113 });
  });

  it("clamps to the end of the list", () => {
    expect(getVisibleRange(995, 400, 40, 1_000, 2)).toEqual({ start: 993, end: 1_000 });
    expect(getVisibleRange(5_000, 400, 40, 1_000, 2)).toEqual({ start: 997, end: 1_000 });
  });

  it("handles lists shorter than the viewport", () => {
    expect(getVisibleRange(0, 400, 40, 3, 2)).toEqual({ start: 0, end: 3 });
  });

  it("renders nothing for an empty list or an unmeasured viewport", () => {
    expect(getVisibleRange(0, 400, 40, 0, 2)).toEqual({ start: 0, end: 0 });
    expect(getVisibleRange(0, 0, 40, 1_000, 2)).toEqual({ start: 0, end: 0 });
  });
});
