# Using the app

## Walkthrough

1. **Load a filing.** Search for a company, choose 10-K or 10-Q, then click a filing in the list. Or drop in a filing file (the main `.htm` file from EDGAR, 2019 or later).
2. **Read the results.** The rating and observations are on the right, the ratio book below them, and a chart of the main statements in the middle. Small numbers under each ratio show the change from a year earlier, and a dot marks how it compares with its industry.
3. **Open the appendix** (link at the top) for every ratio with its formula, the industry and market comparison tables, the full rating rubric and the filing details.
4. **Compare.** Tick two filings in the Analyzed list to see them side by side.
5. **See trends.** Click "Load last 5 for trends" under a list of 10-Ks, then pick a ratio in the Trend panel.
6. **Share.** The address bar always holds a link to the current filing. Copy it to send someone the same view.
7. **Show / hide** (top right) controls which ratio groups appear. Light and dark themes are one click away.

Filings you've analyzed are remembered in your browser between visits.

## Reading the colors

Green always means favorable and red unfavorable. Lower debt and a lower P/E count as favorable, so red is not simply "went down".

## Good to know

- Works with US filings from about 2019 onward. No PDFs or older filings.
- A blank means the number isn't available. Missing values are hidden rather than shown as zero.
- There will be plenty of blanks because many public companies do not report certain values.
- Banks and insurers are reported differently, so they get a Banking section instead of some standard ratios, and Altman Z-score is unreliable for them.
- When a filing can't produce a ratio, the app uses Finnhub's trailing-twelve-month figure and labels it "Finnhub, TTM" in the appendix. A number computed from the filing is never replaced.
- On a 10-Q, ratios that mix a quarter's flow with a balance (ROA, ROE, asset turnover, P/E, EV/sales, net interest margin, Altman) are annualized and marked as such.
- Industry figures are group averages, not medians, and use Damodaran's definitions.
- The share price usually comes from a different date than the filing period.
- A company that moved to a new registration number (ExxonMobil Holdings is one) may have no filings under the new one. Upload its predecessor's filing instead.

## Where the data comes from

- **Filings:** [SEC EDGAR](https://www.sec.gov/edgar). Numbers are read from the structured data (inline XBRL) inside each filing.
- **Industry averages:** [Aswath Damodaran's US industry datasets](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html) (NYU Stern, January 2026).
- **Market ratios and gap filling:** [Finnhub](https://finnhub.io).
- **Share price:** Alpha Vantage, or Yahoo Finance's unofficial endpoint as a backup.
