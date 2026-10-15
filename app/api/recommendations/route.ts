import { NextRequest, NextResponse } from 'next/server';
import { resolveMood } from '@/lib/moods';
type Provider = { provider_id: number; provider_name: string; logo_path: string };
type Movie = { id: number; title: string; overview: string; poster_path: string | null; release_date: string; vote_average: number };
async function tmdb(path: string, token: string) {
  const response = await fetch(`https://api.themoviedb.org/3${path}`, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Movie service returned ${response.status}`);
  return response.json();
}
export async function GET(request: NextRequest) {
  const mood = resolveMood((request.nextUrl.searchParams.get('mood') ?? '').slice(0, 300));
  const region = request.nextUrl.searchParams.get('region') ?? 'IN';
  if (!mood || !['IN', 'US', 'GB', 'CA', 'AU'].includes(region)) return NextResponse.json({ error: 'Choose a mood and a supported country.' }, { status: 400 });
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: 'Movie discovery needs a free TMDB API token. Add TMDB_READ_ACCESS_TOKEN to your environment to get started.' }, { status: 503 });
  try {
    const page = Math.floor(Math.random() * 3) + 1;
    const data = await tmdb(`/discover/movie?with_genres=${encodeURIComponent(mood.genres)}&include_adult=false&vote_count.gte=200&vote_average.gte=6&sort_by=popularity.desc&watch_region=${region}&page=${page}`, token);
    const movies = await Promise.all((data.results as Movie[]).slice(0, 9).map(async movie => {
      try {
        const availability = await tmdb(`/movie/${movie.id}/watch/providers`, token);
        const local = availability.results[region];
        return { ...movie, providers: (local?.flatrate ?? []) as Provider[], rent: (local?.rent ?? []) as Provider[], watchLink: local?.link ?? null, availabilityFailed: false };
      } catch { return { ...movie, providers: [], rent: [], watchLink: null, availabilityFailed: true }; }
    }));
    return NextResponse.json({ movies, mood: mood.label, region });
  } catch { return NextResponse.json({ error: 'We couldn’t reach the movie service. Please try again in a moment.' }, { status: 502 }); }
}
