# GTM Benchmark Dashboard

A portfolio project that compares a **hypothetical** $20M ARR seat-based B2B SaaS company with 2026 go-to-market benchmarks. Built with Next.js, shadcn/ui, Tailwind and Recharts, styled after the bionis-dashboard registry block.

> All company figures are illustrative assumptions, not real data.

## What it shows

- **Dashboard:** key-metric cards, company vs. benchmark chart (company as % of benchmark, with the ±10% tolerance band), ranked largest deviations, comparison table (gap, gap %, index, flag), first test per gap, and the limits of the benchmarks.
- **Benchmarks:** every benchmark value with source, sample size, verification status and link. Missing values are marked `no source`, never estimated.
- **Company Assumptions:** every company value, labeled as an assumption.

Flag logic: index = company / benchmark; `Above` or `Below` when the index is outside 0.90 to 1.10, otherwise `At`. A separate Favorable / Unfavorable read accounts for metrics where lower is better (sales cycle). All calculations are in `src/components/gtm/data.ts`.

## Sources and verification

- ICONIQ State of Go-to-Market 2026 (January 2026 survey, 150+ B2B GTM executives): values taken from a secondary summary (SaaStr), so every one is marked **Unverified** until checked against the gated original.
- SaaS Capital benchmarks (NRR, growth): third source, bootstrapped/private population; marked for re-confirmation.
- Level Equity 2026 GTM Insights: no quantified values for the requested metrics were found in the page text.
- Win rate and NRR/NDR as an AE comp metric: no source.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.
