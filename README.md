# Moodreel

Responsive Next.js App Router movie discovery app, ready for Vercel. Describe your mood, choose how you want to feel, and get a shortlist of three movies that fit your preferences and have watch options in your country.

## Simple interface

The main screen offers six mood buttons and one “Find a movie” action. More moods and free-text descriptions are optional. Language, streaming apps, runtime, viewing group, and other preferences are inside “Make it yours”; saved filters stay visible in a short summary and can be reset. Streaming apps load only when this section opens, with a search box to find an app quickly.

Movie cards show the title, language, length, and where to watch, with a Save button. Plot, recommendation explanation, age rating, and seen/not-for-me feedback are under “About this movie.” Feedback has an immediate Undo action. Seen/hidden history and local activity remain available under “Your saved choices & privacy.”

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

- Nine mood choices and keyword-based free text matching, with separate “match my mood”, “lift my spirits”, and “surprise me” goals. Feeling low maps to drama when matching and comedy/family when uplifting. No paid AI service is needed.
- Choose original language (including Tamil, Telugu, Hindi, Malayalam, Kannada, and English), maximum runtime, and who is watching. Date night adds comedy/romance; friends adds adventure/comedy/thriller. Family uses animation/family genres. Original language does not indicate available dubbed audio.
- Subscription choices load dynamically for the selected country. Select none for all services; rentals are excluded by default and must be explicitly enabled. Movies must have a verified matching subscription/rental offer. Filters are verified against each movie's details, not silently relaxed when no matches exist.
- Maximum age rating uses **US** certification, independently of the streaming country. Family defaults to PG or below. Unrated titles are excluded when a rating limit is set. Family/optional genre exclusions remove horror, war, and crime; these do not screen sensitive scenes. Check a content guide for individual suitability.
- Show three picks with a genre-based explanation, “Pick for me”, and a shuffle that excludes previously fetched movies in this session. Fewer than three may appear when strict filters limit the available results.
- Save a watchlist, mark films seen, dismiss unwanted films, and undo feedback in History. Saved and dismissed genres influence the ranking of future candidate pools; this is a lightweight heuristic, not an AI taste model. Seen/dismissed IDs are excluded from discovery.
- Preferences, watchlist, feedback, and activity counters persist in browser localStorage, with no account or cross-device sync. Each library list is capped at 200 entries. Storage failures show a message and fall back to memory for the visit. Saved watch availability is a snapshot; links open current listings.
- “Your local activity & privacy” shows searches, shuffles, cumulative saves, watch-option clicks, and automatic picks. These counters are local only; there is no centralized analytics collection. The clear-data button resets stored preferences, lists, and counters.
- India is the default country. US, UK, Canada, and Australia are also available.
- TMDB supplies movie information, posters, US certificates, runtimes, and JustWatch provider data. Responses are cached for one hour. Initial results use the first popular page; shuffles vary across the first five pages. Detailed lookups use batches of five, with up to twenty candidates per request.
- Subscription streaming and rentals are separately labeled. Watch links open the regional TMDB watch-options page. Movies with failed details are omitted; complete lookup failure returns a retry message.
- Availability changes; confirm pricing and catalog listings with the provider.
- TMDB is free for noncommercial use with attribution. Review [API terms](https://www.themoviedb.org/api-terms-of-use) before monetizing. TMDB and JustWatch are credited in the interface.
- Decorative hero posters are CSS artwork; real movie posters load after a successful search.

## Verification

Run `npm test` for mood resolution, preference validation, discovery filters, eligibility, and ranking. Run `npm run typecheck` for TypeScript and `npm run build` for production compilation. After building, `npm run test:api` starts an isolated production server on port 3097 and verifies the homepage, provider endpoint, strict family/language/runtime/service filters, rentals, exclusions, and invalid/empty cases using deterministic TMDB fixtures. It never uses your real token and shuts down its test server afterward.
