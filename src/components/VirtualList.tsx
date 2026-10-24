"use client";

import { type ReactNode, type UIEvent, memo, useLayoutEffect, useRef, useState } from "react";
import { getVisibleRange } from "@/lib/virtual";
import styles from "./VirtualList.module.css";

type VirtualListProps = {
  rowCount: number;
  rowHeight: number;
  /** Stable key for the row at `index` (e.g. the item id). */
  getRowKey: (index: number) => number | string;
  renderRow: (index: number) => ReactNode;
  /** When this value changes the list scrolls back to the top. */
  resetKey: unknown;
  overscan?: number;
  "aria-label"?: string;
};

/**
 * Minimal fixed-row-height virtual list.
 *
 * Only the index of the first visible row is kept in state, so scrolling
 * re-renders the list only when a row boundary is crossed — not on every
 * scroll event. Rows are absolutely positioned inside a spacer as tall as the
 * full list, which keeps the native scrollbar accurate.
 */
export const VirtualList = memo(function VirtualList({
  rowCount,
  rowHeight,
  getRowKey,
  renderRow,
  resetKey,
  overscan = 6,
  "aria-label": ariaLabel,
}: VirtualListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [firstVisibleRow, setFirstVisibleRow] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  // New results: start from the top. Adjusting state during render (instead
  // of in an effect) avoids rendering one frame with the old scroll offset.
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setFirstVisibleRow(0);
  }

  useLayoutEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [resetKey]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    // React bails out when the value is unchanged, so this is cheap within a row.
    setFirstVisibleRow(Math.floor(event.currentTarget.scrollTop / rowHeight));
  };

  const { start, end } = getVisibleRange(firstVisibleRow, viewportHeight, rowHeight, rowCount, overscan);
  const rows: ReactNode[] = [];
  for (let index = start; index < end; index++) {
    rows.push(
      <div
        key={getRowKey(index)}
        role="listitem"
        aria-setsize={rowCount}
        aria-posinset={index + 1}
        className={styles.row}
        style={{ height: rowHeight, transform: `translateY(${index * rowHeight}px)` }}
      >
        {renderRow(index)}
      </div>,
    );
  }

  return (
    <div
      ref={scrollerRef}
      className={styles.scroller}
      onScroll={handleScroll}
      tabIndex={0}
      role="list"
      aria-label={ariaLabel}
    >
      <div className={styles.spacer} style={{ height: rowCount * rowHeight }}>
        {rows}
      </div>
    </div>
  );
});
