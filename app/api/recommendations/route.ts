import { NextRequest, NextResponse } from 'next/server';
import { discoverParams, eligible, genrePlan, matchesGenres, parsePreferences, type Movie } from '@/lib/discovery';
import { tmdb } from '@/lib/tmdb';
type Rating = { iso_3166_1: string; release_dates: { certification: string }[] };
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  let preferences, plan;
  try { preferences = parsePreferences(query); plan = genrePlan((query.get('mood') ?? '').slice(0,300), preferences); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const excluded = query.get('exclude') ?? '';
  if (excluded && !/^\d+(,\d+){0,499}$/.test(excluded)) return NextResponse.json({ error: 'Invalid excluded movies.' }, { status: 400 });
  if (!process.env.TMDB_READ_ACCESS_TOKEN) return NextResponse.json({ error: 'Movie discovery needs a TMDB token. Add TMDB_READ_ACCESS_TOKEN to the server environment.' }, { status: 503 });
  try {
    const first = await tmdb(`/discover/movie?${discoverParams(preferences, plan.genres, 1)}`);
    const maxPage = Math.min(first.total_pages ?? 1, 5);
    const page = query.get('shuffle') === 'true' ? Math.floor(Math.random() * Math.max(1,maxPage)) + 1 : 1;
    const data = page === 1 ? first : await tmdb(`/discover/movie?${discoverParams(preferences, plan.genres, page)}`);
    const excludedIds = new Set(excluded.split(',').map(Number));
    const candidates = data.results.filter((movie: { id: number }) => !excludedIds.has(movie.id));
    let failed = 0;
    const movies: Movie[] = [];
    // Bound concurrent requests and keep the full request within Vercel's function budget.
    for (let start = 0; start < Math.min(candidates.length, 20); start += 5) {
      const batch = await Promise.all(candidates.slice(start,start+5).map(async (candidate: { id: number; genre_ids: number[] }) => {
        try {
          const detail = await tmdb(`/movie/${candidate.id}?append_to_response=watch/providers,release_dates`);
          const local = detail['watch/providers']?.results?.[preferences.region];
          const certification = (detail.release_dates?.results as Rating[] | undefined)?.find(r => r.iso_3166_1 === 'US')?.release_dates.find(r => r.certification)?.certification ?? '';
          const movie: Movie = { id: detail.id, title: detail.title, overview: detail.overview, poster_path: detail.poster_path, release_date: detail.release_date, vote_average: detail.vote_average, genre_ids: candidate.genre_ids, original_language: detail.original_language, runtime: detail.runtime, certification, providers: local?.flatrate ?? [], rent: local?.rent ?? [], watchLink: local?.link ?? null, region: preferences.region, reason: `${plan.reason}. ${detail.runtime} minutes${preferences.language !== 'any' ? '; matches your original-language preference' : ''}.` };
          return eligible(movie, preferences) && matchesGenres(movie.genre_ids, plan.genres) ? movie : null;
        } catch { failed++; return null; }
      }));
      movies.push(...batch.filter((movie): movie is Movie => movie !== null));
      if (movies.length >= 9) break;
    }
    if (!movies.length && failed) return NextResponse.json({ error: 'Movie details or availability could not be verified. Please retry.' }, { status: 502 });
    return NextResponse.json({ movies, mood: plan.mood, region: preferences.region, partial: failed > 0 });
  } catch { return NextResponse.json({ error: 'We couldn’t reach the movie service. Please try again in a moment.' }, { status: 502 }); }
}
