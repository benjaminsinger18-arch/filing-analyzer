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
| Industry comparison | company vs. Damodaran US industry averages: margins, ROE, debt/capital, coverage, P/E, P/B, EV/EBITDA, EV/sales, with Above/At/Below flags (+/-10%) |
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

`src/data/industry-*.json` is generated from Aswath Damodaran's US industry datasets (NYU Stern, January 2026): https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html (acknowledgement requested). Refresh once a year with `npm run bench:build`. A ticker maps to an industry through Damodaran's company list; if none matches, pick an industry from the dropdown in the header.

## Limits

- US GAAP inline-XBRL filings only (roughly 2019 onward). PDFs and older filings are not supported.
- Banks, insurers and other filers without a classified balance sheet will show `n/a` for several ratios; Altman Z'' is unreliable for them.
- Total debt sums the debt tags a company reports; check the trace for what was included.
- A single filing cannot show trends beyond one comparison period.
- "Fetch latest" fetches the price (Alpha Vantage, else Yahoo) and, with a Finnhub key, provider ratios. It is on demand to protect free-tier quotas. The price date is shown next to valuation and usually differs from the filing period.
- Industry figures are annual aggregates from January 2026, not medians, on Damodaran definitions (e.g. pre-tax unadjusted operating margin, positive-EBITDA EV/EBITDA); US-listed firms only. They are not the same period as the filing.
- Alpha Vantage's company-overview endpoint is premium-only, which is why ratios come from Finnhub.
