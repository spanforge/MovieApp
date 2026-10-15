// Deterministic upstream data for production-route integration tests only.
const originalFetch = globalThis.fetch;
const fixtures = [
  { id: 1, runtime: 85, language: 'ta', rating: 'PG' },
  { id: 2, runtime: 130, language: 'ta', rating: 'PG' },
  { id: 3, runtime: 85, language: 'hi', rating: 'PG' },
  { id: 4, runtime: 85, language: 'ta', rating: 'PG', rentalOnly: true },
  { id: 5, runtime: 85, language: 'ta', rating: '' },
  { id: 6, runtime: 85, language: 'ta', rating: 'R' },
  { id: 7, runtime: 85, language: 'ta', rating: 'PG', crime: true },
  { id: 8, runtime: 85, language: 'ta', rating: 'PG', unavailable: true },
  { id: 9, runtime: 85, language: 'ta', rating: 'PG-13' },
  { id: 10, runtime: 70, language: 'ta', rating: 'G' },
  { id: 11, runtime: 85, language: 'ko', rating: 'PG' },
  { id: 12, runtime: 85, language: 'en', rating: 'PG' },
];
const providers = [{ provider_id: 8, provider_name: 'Test subscription' }, { provider_id: 9, provider_name: 'Test rentals' }];
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname !== 'api.themoviedb.org') return originalFetch(input, options);
  let data;
  if (url.pathname === '/3/watch/providers/movie') data = { results: providers };
  else if (url.pathname === '/3/discover/movie') data = { total_pages: 1, results: fixtures.map(f => ({ id: f.id, genre_ids: f.crime ? [35,80] : [18,35,16,10751] })) };
  else {
    const f = fixtures.find(f => url.pathname === `/3/movie/${f.id}`);
    if (!f) return Response.json({ error: 'Unknown fixture' }, { status: 404 });
    const availability = { flatrate: f.rentalOnly || f.unavailable ? [] : [providers[0]], rent: f.unavailable ? [] : [providers[1]], link: `https://www.themoviedb.org/movie/${f.id}/watch` };
    data = { id: f.id, title: `Fixture ${f.id}`, overview: 'Integration test movie', poster_path: '/fixture.jpg', release_date: '2020-01-01', vote_average: 7.5, original_language: f.language, runtime: f.runtime, 'watch/providers': { results: { IN: availability, US: availability } }, release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: f.rating }] }, {iso_3166_1:'IN',release_dates:[{certification:'U'}]}] } };
  }
  return Response.json(data);
};
