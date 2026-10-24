"use client";

import dynamic from "next/dynamic";
import styles from "@/app/page.module.css";

/**
 * The dataset is generated in the browser, so the search UI is client-only:
 * rendering it on the server would mean generating (and serialising) 100k
 * items per request for markup that depends on the viewport size anyway.
 */
export const AppLoader = dynamic(() => import("./ClientApp").then((module) => module.ClientApp), {
  ssr: false,
  loading: () => <p className={styles.loading}>Loading items…</p>,
});
