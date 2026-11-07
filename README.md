# Filing Analyzer

Drop in an SEC 10-K or 10-Q and get financial ratios, quality scores, rule-based observations and a transparent screening rating. Every number traces back to the XBRL tag it came from.

> **Not investment advice.** The rating is a rules-based screen of one filing. It is not a recommendation to buy, sell or hold anything and ignores price, industry context and management.

## How it works

1. **Input:** upload an EDGAR inline-XBRL `.htm` filing (parsed in the browser; the file never leaves your machine), or look up a ticker (the server fetches the latest 10-K/10-Q list from SEC EDGAR).
2. **Parse and normalize:** `src/lib/ixbrl/parse.ts` reads the tagged facts; `normalize.ts` maps them to canonical line items using ordered us-gaap tag fallbacks, keeps only consolidated (non-dimensional) values, and picks current and prior-year periods (a 10-Q uses the quarter for income ratios and year-to-date for cash flow).
3. **Modules:** each analysis is a self-contained `AnalysisModule` in `src/modules/`. Adding one is a new file plus one line in `registry.ts`.

| Module | What it computes |
| --- | --- |
| Profitability | gross / operating / net / EBITDA margin, ROA, ROE, equity multiplier |
| Liquidity | current, quick, cash ratio, working capital |
| Leverage & solvency | debt/equity, net debt, interest coverage, liabilities/assets, debt/EBITDA |
| Efficiency | asset turnover, DSO, DIO, DPO, cash conversion cycle |
| Growth | YoY revenue, operating income, net income, EPS |
| Cash-flow quality | OCF/net income, free cash flow, FCF margin, accruals ratio |
| Banking | net interest income, net interest margin (approx.), efficiency ratio, noninterest income share, credit-loss provision, loans/deposits, equity/assets; shown only for filers that report them |
| Quality & distress | Piotroski F-score, Altman Z''-score |
| Industry comparison | company vs. Damodaran US industry averages: margins, ROE, debt/capital, coverage, P/E, P/B, EV/EBITDA, EV/sales, with Above/At/Below flags (+/-5%) and direction-aware colors (lower is favorable for debt and multiples) |
| Market ratios (provider) | Finnhub-reported P/E, PEG, EV/EBITDA, EV/revenue, P/B, beta, dividend yield beside the filing-based ones; needs a free `FINNHUB_API_KEY` |
| Valuation (optional) | P/E, P/B, market cap, EV/EBITDA, FCF yield; needs a share price (type one or click Fetch latest) |
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

Environment (`.env.local`, all optional except for the feature they enable):

- `SEC_USER_AGENT`: ticker lookup; SEC requires a contact in the User-Agent header. Uploads work without it.
- `ALPHAVANTAGE_API_KEY`: share price (free tier: 25 requests/day, latest daily close). Falls back to Yahoo Finance's unofficial endpoint.
- `FINNHUB_API_KEY`: provider market ratios (free key at finnhub.io).

### Industry data

`src/data/industry-*.json` comes from Aswath Damodaran's US industry datasets (NYU Stern, January 2026): https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html. Refresh yearly with `npm run bench:build`. Tickers map to industries through his company list; pick one from the header dropdown when none matches.

## Limits

- US GAAP inline-XBRL filings, about 2019 onward. No PDFs or older filings.
- Banks and insurers show `n/a` for several ratios; Altman Z'' is unreliable for them.
- Total debt sums the reported debt tags; the trace lists them.
- One filing gives one comparison period, so no trends.
- Fetch latest runs on demand to protect free-tier quotas. The price date usually differs from the filing period.
- Ratios the filing cannot produce are filled from Finnhub's trailing-twelve-month figures (margins, returns, current and quick ratio, debt/equity, interest coverage, turnover, growth) and tagged "Finnhub, TTM" in the appendix. A value computed from the filing is never replaced.
- Banks skip the industrial approximations (derived operating income, interest-based coverage, debt ratios) and get the Banking module instead.
- The Modules menu only shows or hides ratio sections. Every module always runs.
- Fallbacks: interest paid stands in for interest expense, and operating income is derived from pre-tax income plus interest, only when the standard tags are missing. Negative industry averages are compared in percentage points. Provider multiples fill in when the filing-based one cannot be computed.
- Some `n/a` are real: Apple does not tag interest expense, banks have no gross margin, some telecom and media filers report no cost of revenue.
- A registrant that reorganized under a new CIK (ExxonMobil Holdings) may have no 10-K there. Upload the predecessor's filing.
- Industry figures are January 2026 aggregates, not medians, on Damodaran definitions, for US-listed firms.
- Alpha Vantage's company overview is premium-only, so ratios come from Finnhub.
