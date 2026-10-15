import { moods, resolveMood } from './moods.ts';

export const languages = { any: 'Any language', ta: 'Tamil', te: 'Telugu', hi: 'Hindi', en: 'English', ml: 'Malayalam', kn: 'Kannada', ko: 'Korean', ja: 'Japanese', fr: 'French', es: 'Spanish' };
export const countries = { IN: 'India', US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia' };
export type Preferences = { region: string; language: string; minutes: string; intent: string; group: string; age: string; gentle: boolean; rentals: boolean; services: number[] };
export const defaults: Preferences = { region: 'IN', language: 'any', minutes: 'any', intent: 'match', group: 'solo', age: 'any', gentle: false, rentals: false, services: [] };
export type Provider = { provider_id: number; provider_name: string };
export type Movie = { id: number; title: string; overview: string; poster_path: string | null; release_date: string; vote_average: number; genre_ids: number[]; original_language: string; runtime: number; certification: string; providers: Provider[]; rent: Provider[]; watchLink: string | null; region: string; reason: string };
export function parsePreferences(params: URLSearchParams): Preferences {
  const value = (name: string, allowed: string[], fallback: string) => { const v = params.get(name) ?? fallback; if (!allowed.includes(v)) throw new Error(`Invalid ${name}.`); return v; };
  const services = params.get('services') ?? '';
  if (services && !/^\d+(,\d+){0,29}$/.test(services)) throw new Error('Invalid streaming services.');
  return {
    region: value('region', Object.keys(countries), 'IN'), language: value('language', Object.keys(languages), 'any'),
    minutes: value('minutes', ['any','90','120','150'], 'any'), intent: value('intent', ['match','uplift','surprise'], 'match'),
    group: value('group', ['solo','date','friends','family'], 'solo'), age: value('age', ['any','PG','PG-13','R'], 'any'),
    gentle: params.get('gentle') === 'true', rentals: params.get('rentals') === 'true', services: services ? [...new Set(services.split(',').map(Number))] : [],
  };
}
export function genrePlan(input: string, preferences: Preferences, random = Math.random) {
  let mood = resolveMood(input);
  if (!mood) throw new Error('Choose a mood or try a description like “sad”, “stressed”, or “need a laugh”.');
  let genres: string = mood.genres;
  let reason = `${mood.label} mood: a ${mood.label.toLowerCase()} genre match`;
  if (preferences.intent === 'uplift') { genres = '35|10751'; reason = 'A comedy or family pick to lift your spirits'; }
  if (preferences.intent === 'surprise') { const choice = moods[Math.floor(random() * moods.length)]; genres = choice.genres; reason = `A surprise from the ${choice.label.toLowerCase()} shelf`; }
  if (preferences.group === 'family') { genres = '16|10751'; reason += '; animation or family genres for watching together'; }
  if (preferences.group === 'date') { genres = `${genres},35|10749`; reason += '; comedy or romance for date night'; }
  if (preferences.group === 'friends') { genres = `${genres},12|35|53`; reason += '; adventure, comedy, or suspense for your group'; }
  return { genres, reason, mood: mood.label };
}
export function discoverParams(preferences: Preferences, genres: string, page: number) {
  const params = new URLSearchParams({ with_genres: genres, include_adult: 'false', 'vote_count.gte': '50', 'vote_average.gte': '6', sort_by: 'popularity.desc', watch_region: preferences.region, with_watch_monetization_types: preferences.rentals ? 'flatrate|rent' : 'flatrate', page: String(page), 'with_runtime.gte': '1', 'primary_release_date.lte': new Date().toISOString().slice(0,10) });
  if (preferences.language !== 'any') params.set('with_original_language', preferences.language);
  if (preferences.minutes !== 'any') params.set('with_runtime.lte', preferences.minutes);
  if (preferences.services.length) params.set('with_watch_providers', preferences.services.join('|'));
  if (preferences.gentle || preferences.group === 'family') params.set('without_genres', '27,10752,80');
  const age = preferences.group === 'family' && preferences.age === 'any' ? 'PG' : preferences.age;
  if (age !== 'any') { params.set('certification_country', 'US'); params.set('certification.lte', age); }
  return params;
}
export function eligible(movie: Movie, preferences: Preferences) {
  if (!movie.runtime || (preferences.minutes !== 'any' && movie.runtime > Number(preferences.minutes))) return false;
  if (preferences.language !== 'any' && movie.original_language !== preferences.language) return false;
  if (preferences.group === 'family' && !movie.genre_ids.some(id => [16,10751].includes(id))) return false;
  if (preferences.group === 'date' && !movie.genre_ids.some(id => [35,10749].includes(id))) return false;
  if (preferences.group === 'friends' && !movie.genre_ids.some(id => [12,35,53].includes(id))) return false;
  if ((preferences.gentle || preferences.group === 'family') && movie.genre_ids.some(id => [27,10752,80].includes(id))) return false;
  const age = preferences.group === 'family' && preferences.age === 'any' ? 'PG' : preferences.age;
  const ratings = ['G','PG','PG-13','R'];
  if (age !== 'any' && (!ratings.includes(movie.certification) || ratings.indexOf(movie.certification) > ratings.indexOf(age))) return false;
  const offers = [...movie.providers, ...(preferences.rentals ? movie.rent : [])];
  return offers.some(provider => !preferences.services.length || preferences.services.includes(provider.provider_id));
}
export function matchesGenres(ids: number[], expression: string) {
  return expression.split(',').every(group => group.split('|').some(id => ids.includes(Number(id))));
}
export function rankMovies(movies: Movie[], saved: Movie[], rejected: Movie[]) {
  const affinity = new Map<number, number>();
  for (const [list, weight] of [[saved, 1], [rejected, -1]] as const) for (const movie of list) for (const id of movie.genre_ids) affinity.set(id, (affinity.get(id) ?? 0) + weight);
  const score = (movie: Movie) => movie.genre_ids.reduce((sum, id) => sum + (affinity.get(id) ?? 0), 0);
  return [...movies].sort((a,b) => score(b) - score(a));
}
