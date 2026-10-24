/**
 * Small manual benchmark for generation, search/filter timing and memory.
 *
 *   npm run bench
 *
 * Runs in Node (V8, same engine as Chrome) with --expose-gc so heap numbers
 * are measured after a full collection. Each timing is the median of many
 * runs after a warm-up, which filters out JIT and GC noise.
 */
import { type Item, getItem } from "../src/lib/dataset";
import { EMPTY_CRITERIA, type FilterCriteria, compileCriteria, filterIndices } from "../src/lib/filter";
import { ITEM_COUNT, generateDataset } from "../src/lib/generate";
import { createSearcher } from "../src/lib/searcher";

const WARMUP_RUNS = 20;
const MEASURED_RUNS = 100;

const gc = globalThis.gc;
if (!gc) throw new Error("Run with --expose-gc (use `npm run bench`).");

function heapUsedMb(): number {
  gc!();
  gc!();
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(run: () => void, runs = MEASURED_RUNS): { median: number; p95: number } {
  for (let i = 0; i < WARMUP_RUNS; i++) run();
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { median: median(times), p95: times[Math.floor(times.length * 0.95)] };
}

const ms = (value: number) => value.toFixed(2).padStart(7);

// --- Generation & memory -----------------------------------------------------

const baseline = heapUsedMb();
const generationStart = performance.now();
let dataset = generateDataset();
const firstGenerationMs = performance.now() - generationStart;
const datasetHeapMb = heapUsedMb() - baseline;
const generation = measure(() => {
  dataset = generateDataset();
}, 10);

const typedArrayMb =
  (dataset.ids.byteLength +
    dataset.categoryCodes.byteLength +
    dataset.priceCents.byteLength +
    dataset.active.byteLength) /
  1024 /
  1024;

// The same rows as plain `Item` objects, for comparison. The name and category
// strings are shared with the dataset, so this measures only what the object
// representation adds on top of the strings (object headers, fields, boxed
// prices, array slots) — i.e. what the typed arrays replace.
const beforeObjects = heapUsedMb();
const objects: Item[] = Array.from({ length: dataset.size }, (_, i) => getItem(dataset, i));
const objectsHeapMb = heapUsedMb() - beforeObjects;
// Referenced after the measurement so the array is still alive while measured.
if (objects.length !== dataset.size) throw new Error("unreachable");

console.log(`Items: ${ITEM_COUNT.toLocaleString("en-US")}`);
console.log(`Node ${process.version} · ${process.platform} ${process.arch}\n`);
console.log(
  `Generation: first run ${firstGenerationMs.toFixed(1)} ms, median ${generation.median.toFixed(1)} ms`,
);
console.log(`Heap, whole columnar dataset:                      ${datasetHeapMb.toFixed(1)} MB`);
console.log(`  typed arrays (id, category, price, status):      ${typedArrayMb.toFixed(1)} MB`);
console.log(
  `  strings (names + lower-cased names) and slots:   ${(datasetHeapMb - typedArrayMb).toFixed(1)} MB`,
);
console.log(`Heap, same fields as 100k Item objects (no strings): ${objectsHeapMb.toFixed(1)} MB\n`);

// --- Full scans ---------------------------------------------------------------

const scenarios: Array<[string, Partial<FilterCriteria>]> = [
  ["no criteria (all items)", {}],
  ['query "a" (broad)', { query: "a" }],
  ['query "digital"', { query: "digital" }],
  ['query "digital monitor 5" (narrow)', { query: "digital monitor 5" }],
  ['query "zzz" (no match)', { query: "zzz" }],
  ["category only", { category: "Cardiology" }],
  ["status only", { status: "active" }],
  ["price range only", { minPrice: 100, maxPrice: 1000 }],
  [
    "query + category + price + status",
    { query: "pro", category: "Cardiology", minPrice: 100, maxPrice: 3000, status: "active" },
  ],
];

console.log("Full scan over all items (filterIndices)");
console.log("scenario                               matches   median ms   p95 ms");
for (const [label, partial] of scenarios) {
  const compiled = compileCriteria({ ...EMPTY_CRITERIA, ...partial }, dataset.categories);
  const matches = filterIndices(dataset, compiled).length;
  const { median: med, p95 } = measure(() => filterIndices(dataset, compiled));
  console.log(`${label.padEnd(38)} ${String(matches).padStart(7)}   ${ms(med)}   ${ms(p95)}`);
}

// --- Alternative: lower-casing on every search ---------------------------------

{
  const needle = "digital";
  const { median: med } = measure(() => {
    let count = 0;
    for (let i = 0; i < dataset.size; i++) if (dataset.names[i].toLowerCase().includes(needle)) count++;
    return count;
  });
  console.log(`\nFor comparison, query "digital" lower-casing names on the fly: ${med.toFixed(2)} ms median`);
}

// --- Typing simulation ----------------------------------------------------------

const typed = "digital monitor";
const keystrokes = Array.from({ length: typed.length }, (_, i) => typed.slice(0, i + 1));
const perKeystroke = keystrokes.map(() => [] as number[]);
const scanned = keystrokes.map(() => 0);

for (let run = 0; run < WARMUP_RUNS + MEASURED_RUNS; run++) {
  const search = createSearcher(dataset);
  keystrokes.forEach((query, i) => {
    const start = performance.now();
    const result = search({ ...EMPTY_CRITERIA, query });
    if (run >= WARMUP_RUNS) perKeystroke[i].push(performance.now() - start);
    scanned[i] = result.scanned;
  });
}

console.log(`\nTyping "${typed}" one key at a time (createSearcher, narrows previous result)`);
console.log("query                 scanned   median ms");
keystrokes.forEach((query, i) => {
  console.log(
    `${JSON.stringify(query).padEnd(20)} ${String(scanned[i]).padStart(8)}   ${ms(median(perKeystroke[i]))}`,
  );
});
