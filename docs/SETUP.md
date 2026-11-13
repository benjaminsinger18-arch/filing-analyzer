# Setup

Everything you need to run Filing Analyzer on your own computer.

## Run it

You need [Node.js](https://nodejs.org) 20.9 or newer (which includes npm) and [Git](https://git-scm.com).

```bash
git clone https://github.com/benjaminsinger18-arch/filing-analyzer.git
cd filing-analyzer
npm install
```

Create your settings file, then open `.env.local` in any text editor:

```bash
cp .env.example .env.local        # Mac / Linux
copy .env.example .env.local      # Windows (Command Prompt)
```

Set `SEC_USER_AGENT` to your name and email, like `Jane Doe jane@example.com`. The SEC asks every program that downloads filings to say who is asking, and it blocks requests that don't. Leave the other two lines empty for now.

```bash
npm run dev
```

Open <http://localhost:3000>. Click one of the example tickers to try it.

Uploading a downloaded filing works without any settings. Searching by company name or ticker needs `SEC_USER_AGENT`.

## Settings

Everything lives in `.env.local`. Restart `npm run dev` after changing it.

| Setting | What it turns on | Where to get it | If left empty |
| --- | --- | --- | --- |
| `SEC_USER_AGENT` | Searching companies and loading filings from the SEC | Your own name and email, no signup | Search fails. Uploads still work. |
| `FINNHUB_API_KEY` | Market ratios, and fills ratios a filing can't provide | Free key at [finnhub.io](https://finnhub.io) | Those ratios stay hidden. |
| `ALPHAVANTAGE_API_KEY` | Share price from Alpha Vantage (free tier: 25 requests a day) | Free key at [alphavantage.co](https://www.alphavantage.co/support/#api-key) | Price comes from Yahoo Finance instead. |

Keep `.env.local` private. It is already excluded from Git.

## Deploying

The app is a standard Next.js project, so it deploys to Vercel with no extra configuration. Set the same three environment variables in the hosting dashboard. `SEC_USER_AGENT` is the only required one.

## Troubleshooting

- **"Lookup failed" or no filings found:** check that `SEC_USER_AGENT` is set in `.env.local` with a real name and email, then restart `npm run dev`.
- **No price or market ratios:** add the optional keys above. Yahoo Finance covers the price without one.
- **The app looks out of date after `git pull`:** stop the server, run `npm install`, and start `npm run dev` again.
- **Port 3000 is already in use:** run `npm run dev -- -p 3100` and open that port instead.
- **Node version error on install:** update Node to 20.9 or newer (`node -v` shows your version).
