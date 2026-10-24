import { memo } from "react";
import { type Dataset, getItem } from "@/lib/dataset";
import { formatPrice } from "@/lib/format";
import styles from "./SearchApp.module.css";

type ResultRowProps = {
  dataset: Dataset;
  /** Index into the dataset (not into the result list). */
  itemIndex: number;
};

/**
 * Memoised so rows that stay on screen while scrolling are not re-rendered;
 * the `Item` object only exists while its row is mounted.
 */
export const ResultRow = memo(function ResultRow({ dataset, itemIndex }: ResultRowProps) {
  const item = getItem(dataset, itemIndex);
  return (
    <div className={styles.columns}>
      <span className={styles.id}>#{item.id}</span>
      <span className={styles.name} title={item.name}>
        {item.name}
      </span>
      <span className={styles.category}>{item.category}</span>
      <span className={styles.price}>{formatPrice(item.price)}</span>
      <span className={item.status === "active" ? styles.active : styles.inactive}>{item.status}</span>
    </div>
  );
});
