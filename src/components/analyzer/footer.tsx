export function Footer() {
  return (
    <footer className="px-3 py-4 text-[11px] text-(--muted)">
      <p>
        Filings from SEC EDGAR. Industry averages from Damodaran (US, January 2026). Market ratios from Finnhub. Prices from Alpha Vantage or Yahoo Finance.
      </p>
      <p className="mt-1">
        A rules-based screen of one filing. Not investment advice.{' '}
        <a className="text-(--accent) underline" href="https://github.com/benjaminsinger18-arch/filing-analyzer" target="_blank" rel="noreferrer">Source on GitHub</a>
      </p>
    </footer>
  )
}
