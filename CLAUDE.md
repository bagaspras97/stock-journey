# Stock Journey

Interactive story site about stocks from 2010 to 2025, with a US and an Indonesian (IDX) market, in Indonesian and English.

- Published as a claude.ai artifact: https://claude.ai/artifact/F8R4VzUXCdun9GS2esgn3K (publish `kisah-saham-nvidia.html` with `hero.webp`, `d/ids.js`, `d/*.js` and every `d/s/*.js` in `files`).
- Netlify build: `netlify-site/` and `stock-journey-netlify.zip`.

## Layout

- `kisah-saham-nvidia.html`: the whole page (CSS and JS inline). It loads `d/ids.js`, then the index for one market and language, `d/{us|id}-{id|en}.js`. A stock's detail file, `d/s/{id}-{lang}.js`, loads when its page opens.
- `src/build-data.js`: builds `d/` from the raw Yahoo Finance JSON in `raw/px`.
- `src/stories-*.js`: Indonesian story text per stock. `src/en/*.js`: English translations; their chapter, cause, event and lesson counts must match the Indonesian text.
- `src/meta.js`: brand colors (light and dark), monogram initial, and Logo.dev domain per stock. Every stock needs an entry; the build fails without one. The page builds its color tokens from this data.
- `src/events.js` and `src/events-id.js`: market events for the US and Indonesia.
- `raw/tools/*.py`: helper scripts for IDX data checks, such as `zz3.py` for swings. Run them from `raw/tools`.

## Build

```bash
node src/build-data.js raw/px
sh src/build-netlify.sh
```

## Rules

- **Data must be valid.**
  - IDX cleaning lives in `clean()`: holidays, zero-volume rows and repeated stale rows are dropped, plus the `IDX_BAD`, `IDX_START` and `IDX_REFACTOR` lists.
  - Check every number in story text against the built chapter returns.
  - Bull chapters must be ≥ 0% and bear chapters ≤ 0%; the build enforces this.
- **Logo.dev:** only the publishable key (`pk_…`) may appear in code. Never use the secret key.
- **Footer:** generic text that differs for the US and ID markets, with no company names.
