# Item Search — Search & Filter with a Virtualized List

A small Next.js + TypeScript app that searches and filters **100,000** generated items entirely on the
client and renders the results in a virtualized list.

- Case-insensitive substring search on `name`
- Combined filters: **category**, **price range** (inclusive, min and/or max) and **status**
- Matching-item count, a **Reset** button, and per-search timing (`… ms · scanned N`)
- Hand-written pure search/filter functions (no search libraries, no Lodash)
- A small custom virtual list (no virtualization dependency)

## Setup

Requires Node.js ≥ 20.9 (developed on Node 22).

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script                       | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `npm run build && npm start` | Production build (use this when judging performance)    |
| `npm test`                   | Vitest unit + component tests                           |
| `npm run bench`              | Manual benchmark: generation, filter timing, heap usage |
| `npm run lint` / `typecheck` | ESLint (Next config) / `tsc --noEmit`                   |
| `npm run format`             | Prettier                                                |

## Project structure

```
src/
  lib/                       framework-free logic, all unit-tested
    dataset.ts               Item type, columnar Dataset, createDataset/getItem
    generate.ts              deterministic generator for 100k items
    random.ts                seeded PRNG (mulberry32)
    filter.ts                pure search/filter functions
    searcher.ts              one-entry memo + incremental narrowing on top of filter.ts
    filter-form.ts           form state reducer → FilterCriteria
    virtual.ts               visible-row range math
    format.ts                shared Intl formatters
  components/
    AppLoader.tsx            client-only dynamic import of the app
    ClientApp.tsx            generates the dataset once per mount
    SearchApp.tsx            wires form state → search → list
    FilterBar.tsx            controls (memoised)
    VirtualList.tsx          fixed-row-height virtual list (memoised)
    ResultRow.tsx            one row (memoised)
scripts/benchmark.ts         manual benchmark
```

## Key technical decisions

### 1. Columnar data instead of 100k objects

The data lives in a `Dataset` of parallel arrays ("struct of arrays"):
`ids: Uint32Array`, `categoryCodes: Uint8Array` (an index into a list of 12 category labels),
`priceCents: Uint32Array`, `active: Uint8Array`, plus `names` and precomputed lower-cased
`searchNames`.

- **Memory:** the four numeric fields take exactly 1.0 MB. The same fields stored as 100k `Item`
  objects cost ~8.4 MB for object headers, boxed prices and array slots alone, not counting the strings
  (see benchmark).
- **Speed:** the filter loop reads dense typed arrays instead of chasing object pointers.
- **Exactness:** prices are integer cents, so `price >= min` is an exact integer comparison. With
  floats, `0.1 + 0.2` as a minimum could wrongly include or exclude a $0.30 item. A test covers this.
- **No row objects:** `Item` objects are only created by `getItem()` for the ~20 rows on screen.
- The generator writes directly into the columns, so no throw-away objects are created at startup.
  It uses a seeded PRNG, which keeps the data identical across reloads, tests and benchmark runs.

Lower-cased names are stored once (~4 MB). The alternative, calling `toLowerCase()` inside the loop,
is about **2.3× slower** (11.2 ms vs 4.9 ms for `"digital"`) and allocates ~100k temporary strings on
every keystroke.

### 2. Pure search/filter functions

`filter.ts` contains only pure functions: `compileCriteria`, `filterIndices`, `isRefinement`,
`isSameCriteria`, `parsePriceInput` and `search`. Results are a `Uint32Array` of dataset indices, kept
in dataset order.

- `compileCriteria` normalises the criteria once per search: it trims and lower-cases the query,
  maps the category to its code, converts prices to cents, and flags impossible criteria such as
  min > max or an unknown category.
- `filterIndices` runs the cheapest checks first: status and category are single byte reads, price
  is two integer comparisons. `String.prototype.includes` only runs for items that already passed
  every other filter.
- The scratch buffer is copied into a right-sized array, so a 24-item result does not keep a 400 KB
  buffer alive.
- When no criterion is set, the identity index list is returned without testing any item.

### 3. Incremental narrowing (`searcher.ts`)

`createSearcher` wraps the pure functions with a **one-entry memo**:

- **Equivalent criteria** return the _same_ result object. Typing `"1"` → `"1.0"` in a price field,
  or adding a trailing space to the query, causes no list re-render.
- **Refinement:** if the new criteria can only _narrow_ the previous ones, only the previous
  matches are scanned. Examples: the query gains characters (`"dig"` → `"digi"`, or more generally
  the new needle contains the old one), the minimum price goes up, the maximum price goes down, or
  a category/status is picked after "All". Typing `"digital monitor"` scans 100k → 24k → 10k →
  5k → … → 254 items.
- Only the last result is kept, so retained memory is at most one index array (≤ 400 KB).

The searcher is tested against an independent naive `Item[]` implementation. One test uses 200
random criteria; another runs 300 random edits in a row, which covers the narrowing and full-scan
paths in any order.

### 4. Responsive typing without stale results

Results are **derived synchronously** in the same render as the input change:
`form → useMemo(toCriteria) → useMemo(search)`. No debounce, `useDeferredValue`, transition or async
worker sits between the input and the results. So there is no window in which the list shows results
for an older query, and no out-of-order responses to guard against. This works because a full scan
takes ~2–5 ms and a narrowing keystroke well under 1 ms, which fits in a frame (numbers below).

Alternatives considered:

- **Debounce:** adds latency and shows stale results during the delay.
- **`useDeferredValue` / `startTransition`:** keeps the input snappy for slow work, but by design
  shows the previous results while the new ones render. The task asks for the opposite, and the work
  is already fast.
- **Web Worker:** the main thread still needs the data to render rows, so memory doubles (or rows
  must be messaged across). It also needs request IDs to drop stale replies. It's worth it only for
  much larger datasets (see "What I would do next").

### 5. Virtualized list

`VirtualList` is about 100 lines with fixed row height, instead of a dependency:

- **State:** it keeps only `firstVisibleRow` (`Math.floor(scrollTop / rowHeight)`) and the
  viewport height (from `ResizeObserver`). Scroll events within a row set the same value, so React
  bails out. The list re-renders only when a row boundary is crossed.
- **Rows:** visible rows plus 6 overscan rows on each side are positioned with `transform` inside a
  spacer as tall as the full list, so the native scrollbar stays accurate. About 20 rows are in the
  DOM at any time.
- **Memoisation:** rows are keyed by item id. `ResultRow`, `VirtualList` and `FilterBar` are all
  `memo`ised and get stable callbacks, so rows that stay on screen do not re-render.
- **Reset to top:** when results change, the scroll position resets. The `firstVisibleRow` state is
  adjusted during render, not in an effect, so no frame is painted with the old offset.
- **CSS:** `contain: strict` on the scroller and `contain: layout paint` on rows keep the browser's
  layout work local.
- **Accessibility:** `role="list"` / `listitem` with `aria-setsize` and `aria-posinset`, so screen
  readers know the real size. The scroller is focusable for keyboard scrolling.
- **Limit:** 100k × 44 px = 4.4M px, well under browser maximum element heights (~17M px in Firefox).

### 6. Client-only rendering

The data is generated in the browser, so the search UI is loaded with `next/dynamic({ ssr: false })`.
Rendering it on the server would mean generating 100k items per request for markup that depends on the
viewport size. The dataset is created once in a lazy `useState` initialiser.

### Small UX details

- Price inputs keep their raw string, so intermediate input like `12.` survives.
- Empty, invalid or negative prices mean "no bound".
- An inverted range (min > max) shows an inline error and returns zero results.
- The query is trimmed.
- Reset is disabled when nothing is set.
- The count is announced via `aria-live`.
- The layout adapts down to phone width.

## Performance observations

### Environment

- MacBook with **Intel Core i5-8210Y** (2 cores, 1.6 GHz, low-power "Y" series), 8 GB RAM, macOS 14
  (Darwin 23.6)
- Node.js 22.14 (V8) for `npm run bench`
- Chromium 152 (the Claude desktop app's built-in browser) against the **production build**
  (`next build && next start`)

This is a deliberately slow machine; a typical laptop should be noticeably faster.

### Method

- **Node benchmark** (`npm run bench`, source in `scripts/benchmark.ts`): each timing is the median
  (and p95) of 100 runs after 20 warm-up runs. Heap numbers use `process.memoryUsage().heapUsed`
  after forced GC (`--expose-gc`).
- **Browser:** a console script sets the search input's value and dispatches `input` events one
  character at a time. It measures from dispatch until after React's synchronous render and commit,
  plus a forced layout, taking the median of 7 runs. Scrolling was measured by moving `scrollTop` in
  600 px steps per animation frame, with a `PerformanceObserver` watching for long tasks.

### Results

Data generation (100k items): **~78 ms** median (first run ~90 ms).

| Memory (Node, after GC)                                             | Heap   |
| ------------------------------------------------------------------- | ------ |
| Whole columnar dataset                                              | 9.4 MB |
| ├ typed arrays (id, category, price, status)                        | 1.0 MB |
| └ strings (names + lower-cased names) and array slots               | 8.5 MB |
| _Comparison:_ same fields as 100k `Item` objects, excluding strings | 8.4 MB |

Full scan over all 100,000 items (`filterIndices`, Node):

| Scenario                             | Matches | Median |    p95 |
| ------------------------------------ | ------: | -----: | -----: |
| query `"a"` (broad)                  |  69,986 | 4.0 ms | 5.9 ms |
| query `"digital"`                    |   5,082 | 4.9 ms | 8.0 ms |
| query `"digital monitor 5"` (narrow) |      24 | 4.3 ms | 8.8 ms |
| query `"zzz"` (no match)             |       0 | 4.0 ms | 6.5 ms |
| category only                        |   8,260 | 0.6 ms | 1.5 ms |
| status only                          |  69,992 | 1.6 ms | 3.1 ms |
| price range only                     |  17,944 | 1.0 ms | 2.7 ms |
| query + category + price + status    |     163 | 1.5 ms | 3.4 ms |

Typing `"digital monitor"` one key at a time:

| Keystroke                        | Items scanned | Filter only (Node) | Filter + React render/commit + layout (browser) |
| -------------------------------- | ------------: | -----------------: | ----------------------------------------------: |
| `d`                              |       100,000 |             3.9 ms |                                         11.3 ms |
| `di`                             |        23,996 |             1.9 ms |                                          5.8 ms |
| `dig`                            |        10,082 |             1.0 ms |                                          5.7 ms |
| `digi` … `digital`               |         5,082 |         0.4–0.6 ms |                                      2.6–3.6 ms |
| `digital m`                      |         5,082 |             0.4 ms |                                          6.8 ms |
| `digital mo` … `digital monitor` |     510 → 254 |           < 0.1 ms |                                      1.3–6.2 ms |

Clearing the query back to all 100k items takes ~5 ms end to end in the browser.

Scrolling (browser):

- JS work per scroll step (scroll event → React → commit) has a median of **0.2 ms** and a max of
  1.3 ms.
- No long tasks (> 50 ms) were recorded.
- Median frame interval is 16.7 ms (60 fps), with p95 19 ms.
- About 20 rows and ~220 DOM elements exist in total, independent of the result count.

Two isolated ~1 s gaps did show up during the scripted scroll run. They coincided with no long task and
no app JS, so they came from the embedded browser pane, not from the app.

Page JS heap (`performance.memory.usedJSHeapSize`, Chromium, not force-GC'd) was **~13–18 MB** for the
whole page: React, the Next runtime, the dataset and transient garbage.

### Observations

- The worst case is the first keystroke from an empty query, which needs a full substring scan. Every
  following keystroke narrows the previous result. It is also when the list changes the most rows, so
  React's share is largest there.
- Category, status and price filters are roughly 3–8× cheaper than text search because they only read typed
  arrays.
- The first search after page load runs before the JIT has optimised the loop. The no-criteria fast
  path means the initial render does no scanning (~1 ms instead of ~50 ms cold).

## Testing

`npm test` runs 44 focused tests (Vitest):

- `filter.test.ts`: case-insensitive search, each filter on its own, inclusive and open price
  bounds, floating-point price input, inverted range, unknown category, combined filters (including
  all four), no mutation of the dataset, candidate-restricted filtering, refinement detection,
  price input parsing.
- `searcher.test.ts`: the optimised code against an independent naive `Item[]` implementation, using
  200 random criteria on a 20k dataset and 300 random sequential edits (catches stale or incorrect
  incremental results). Also checks result reuse for equivalent criteria and that narrowing really
  scans fewer items.
- `generate.test.ts`: 100k items, unique sequential ids, valid fields, determinism, and a round-trip
  through the columnar format.
- `virtual.test.ts`: visible-range math at the start, middle and end of the list, short lists, and
  an empty list.
- `SearchApp.test.tsx` (jsdom + Testing Library): count updates per keystroke, combined filters
  through the real controls, the inverted-range message, and Reset restoring every control.

## What I would do next (out of scope here)

- **Millions of items:** move the dataset and filtering into a Web Worker (typed arrays are
  transferable) and send back only the index array. Add request IDs to drop out-of-order replies.
  For text search, add an n-gram index.
- **Shareable filters:** keep the filter state in the URL.
- **More filtering:** multi-select categories and sorting.

## AI usage

- **Tool:** Claude Code (Anthropic's Claude Opus 5.5).
- **What it helped with:**
  - Scaffolding the project and tooling configuration (Vitest, Prettier).
  - Drafting the columnar dataset, the filter functions, the incremental searcher and the virtual
    list.
  - Writing the tests and the benchmark script.
  - Drafting this README.
- **How the output was validated:**
  - The optimised search was checked against a deliberately naive reference implementation, with
    randomised and sequential-edit tests.
  - Type-checking (`tsc`), ESLint and a production build were run.
  - The app was exercised manually in a browser on desktop and phone widths. A filter combination's
    count was cross-checked against an independent script.
  - Every performance claim above comes from the benchmark and browser measurements described, not
    estimates.
  - All code was reviewed line by line; I can explain every decision in it.
