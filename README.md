# Filing Analyzer

Drop in an SEC 10-K or 10-Q and get financial ratios, quality scores, rule-based observations and a transparent screening rating. Every number traces back to the XBRL tag it came from.

> **Not investment advice.** The rating is a rules-based screen of one filing. It is not a recommendation to buy, sell or hold anything and ignores price, industry context and management.

## How it works

1. **Input:** upload an EDGAR inline-XBRL `.htm` filing (parsed in the browser; the file never leaves your machine), or look up a ticker (the server fetches the latest 10-K/10-Q list from SEC EDGAR).
2. **Parse and normalize:** `src/lib/ixbrl/parse.ts` reads the tagged facts; `normalize.ts` maps them to canonical line items using ordered us-gaap tag fallbacks, keeps only consolidated (non-dimensional) values, and picks current and prior-year periods (a 10-Q uses the quarter for income ratios and year-to-date for cash flow).
3. **Modules:** each analysis is a self-contained `AnalysisModule` in `src/modules/`. Adding one is a new file plus one line in `registry.ts`.

| Module | What it computes |
| --- | --- |
| Profitability | gross / operating / net margin, ROA, ROE, equity multiplier |
| Liquidity | current, quick, cash ratio, working capital |
| Leverage & solvency | debt/equity, net debt, interest coverage, liabilities/assets, debt/EBITDA |
| Efficiency | asset turnover, DSO, DIO, DPO, cash conversion cycle |
| Growth | YoY revenue, operating income, net income, EPS |
| Cash-flow quality | OCF/net income, free cash flow, FCF margin, accruals ratio |
| Quality & distress | Piotroski F-score, Altman Z''-score |
| Valuation (optional) | P/E, P/B, market cap, EV/EBITDA, FCF yield; needs a share price you type in |
| Screening rating | weighted composite using the published rubric in `src/modules/rating.ts` |
| Observations | templated flags such as operating loss, thin coverage, weak cash conversion |

Missing inputs produce `n/a` with a reason, never zero or NaN.

## Run locally

```bash
npm install
cp .env.example .env.local   # then set SEC_USER_AGENT to "Your Name your-email@example.com"
npm run dev
npm test
```

`SEC_USER_AGENT` is only needed for ticker lookup; SEC requires a contact in the User-Agent header. Uploads work without it.

## Limits

- US GAAP inline-XBRL filings only (roughly 2019 onward). PDFs and older filings are not supported.
- Banks, insurers and other filers without a classified balance sheet will show `n/a` for several ratios; Altman Z'' is unreliable for them.
- Total debt sums the debt tags a company reports; check the trace for what was included.
- A single filing cannot show trends beyond one comparison period.
