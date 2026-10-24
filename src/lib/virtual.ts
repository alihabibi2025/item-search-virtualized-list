export type RowRange = {
  /** First rendered row (inclusive). */
  readonly start: number;
  /** Last rendered row (exclusive). */
  readonly end: number;
};

/**
 * Computes which rows of a fixed-row-height list need to be in the DOM.
 * `overscan` extra rows are rendered on each side so fast scrolling does not
 * reveal blank space before the next frame renders.
 */
export function getVisibleRange(
  firstVisibleRow: number,
  viewportHeight: number,
  rowHeight: number,
  rowCount: number,
  overscan: number,
): RowRange {
  if (rowCount === 0 || viewportHeight <= 0) return { start: 0, end: 0 };

  const first = Math.min(Math.max(firstVisibleRow, 0), rowCount - 1);
  // +1: a partially scrolled viewport can show one extra (partial) row.
  const visibleRows = Math.ceil(viewportHeight / rowHeight) + 1;

  return {
    start: Math.max(0, first - overscan),
    end: Math.min(rowCount, first + visibleRows + overscan),
  };
}
