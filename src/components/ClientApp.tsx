"use client";

import { useState } from "react";
import { generateDataset } from "@/lib/generate";
import { SearchApp } from "./SearchApp";

export function ClientApp() {
  // Generated once per mount (~tens of ms); the lazy initialiser keeps it out of re-renders.
  const [dataset] = useState(() => generateDataset());
  return <SearchApp dataset={dataset} />;
}
