# Moodreel

Responsive Next.js App Router movie discovery app, ready for Vercel. Pick one of eight moods or describe a mood to see movie posters, ratings, summaries, and regional streaming/rental options.

## Local setup

Requires Node.js 20.9 or newer.

1. Run `npm install` (use `npm.cmd` in PowerShell if script execution is restricted).
2. Copy `.env.example` to `.env.local`.
3. Create a free [TMDB account](https://www.themoviedb.org/signup), request developer API access in [API settings](https://www.themoviedb.org/settings/api), and set `TMDB_READ_ACCESS_TOKEN` to the **API Read Access Token**.
4. Run `npm run dev` and open http://localhost:3000.

The token is server-only. Never prefix it with `NEXT_PUBLIC_` or commit `.env.local`. Without a token, searches display a setup message rather than fabricated movie data.

## Vercel deployment

Push this repo to GitHub, import it into Vercel, and choose the Next.js preset. Add `TMDB_READ_ACCESS_TOKEN` under project environment variables before deploying. Use the default `npm run build` command. Redeploy after changing environment variables. No database is required.

## Data and behavior

- Free text uses keyword matching to map moods to movie genres; no paid AI service is needed. Unsupported descriptions ask the user to choose a mood.
- India is the default country. US, UK, Canada, and Australia are also available.
- TMDB supplies movie information, posters, and JustWatch provider data. Responses are cached for one hour. Results vary across the first three popular result pages.
- Subscription streaming and rentals are separately labeled. Watch links open the regional TMDB watch-options page. Availability failures and absent providers have distinct messages.
- Availability changes; confirm pricing and catalog listings with the provider.
- TMDB is free for noncommercial use with attribution. Review [API terms](https://www.themoviedb.org/api-terms-of-use) before monetizing. TMDB and JustWatch are credited in the interface.
- Decorative hero posters are CSS artwork; real movie posters load after a successful search.

## Verification

Run `npm test` for mood resolution, `npm run typecheck` for TypeScript, and `npm run build` for production compilation.
