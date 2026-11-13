# Developing

Built with Next.js 16, React 19, Tailwind, Recharts and KaTeX. Filing parsing uses htmlparser2 and runs in the browser, so uploaded files never leave your machine.

## Scripts

```bash
npm run dev          # development server on http://localhost:3000
npm test             # unit tests (Vitest)
npm run lint
npm run build        # production build
npm start            # serve the production build
npm run bench:build  # refresh industry data from Damodaran's spreadsheets
```

CI runs lint, tests and the production build on every push and pull request (`.github/workflows/ci.yml`).

## Folder map

```text
src/lib/ixbrl/    read the filing's tagged numbers and map them to standard line items
src/modules/      one file per analysis: profitability, liquidity, leverage, and so on
src/components/   the page (analyzer.tsx renders; use-analyzer.ts holds the state)
src/app/api/      server routes for SEC lookup, search, market data and industry averages
src/data/         industry averages and the ticker-to-industry map
scripts/          one-off data builders (Damodaran benchmarks)
```

## How a filing becomes a rating

1. `src/app/api/search` resolves a name or ticker to a company; `src/app/api/edgar` lists its 10-K or 10-Q filings and fetches the chosen one (only `sec.gov` URLs are allowed).
2. `src/lib/ixbrl/parse.ts` pulls every tagged fact out of the inline XBRL. A dropped-in `.htm` enters here directly.
3. `src/lib/ixbrl/normalize.ts` maps the facts to standard line items (revenue, operating income, total debt, and so on) with fallbacks for the common tag variants, and records which tag each number came from.
4. `src/modules/registry.ts` runs the eleven ratio modules in order, then the rating and observations modules, which read the others' results.
5. Every metric carries its inputs, so the appendix can show the formula with the exact figures substituted.

## Add an analysis

Create a file in `src/modules/` that exports an `AnalysisModule` (an `id`, a `title` and a `run(fin)` that returns metrics), then add it to `src/modules/registry.ts`. Every metric lists its inputs, so the formula trace and tests come for free.

| Module | What it computes |
| --- | --- |
| Profitability | gross, operating, net and EBITDA margin, ROA, ROE, equity multiplier |
| Liquidity | current, quick and cash ratio, working capital |
| Leverage | debt/equity, net debt, interest coverage, liabilities/assets, debt/EBITDA |
| Efficiency | asset turnover, DSO, DIO, DPO, cash conversion cycle |
| Growth | year-over-year revenue, operating income, net income, EPS |
| Cash flow | OCF/net income, free cash flow, FCF margin, accruals ratio |
| Banking | net interest income and margin, efficiency ratio, provisions, loans/deposits, equity/assets |
| Quality | Piotroski F-score, Altman Z''-score |
| Industry | company vs. Damodaran industry averages, flagged Above, At or Below (within 5%) |
| Market | Finnhub P/E, PEG, EV/EBITDA, EV/revenue, P/B, beta, dividend yield |
| Valuation | P/E, P/B, market cap, EV/EBITDA, FCF yield from a share price |
| Rating | weighted composite from the rubric in `src/modules/rating.ts` |
| Observations | plain-language flags such as an operating loss or thin interest coverage |

## Tests

`npm test` runs the Vitest suites under `src/**/__tests__`: the iXBRL parse-and-normalize pipeline against the fixture in `src/lib/ixbrl/__tests__/fixture.ts`, the EDGAR and search helpers, the KaTeX formula builder, and the module-level benchmark, gap-fill and prior-period logic. When you add a tag fallback to the normalizer, extend the fixture so the mapping is pinned.
