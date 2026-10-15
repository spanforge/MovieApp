export async function tmdb(path: string) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error('Movie discovery needs a TMDB token. Add TMDB_READ_ACCESS_TOKEN to the server environment.');
  const response = await fetch(`https://api.themoviedb.org/3${path}`, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(response.status === 401 ? 'TMDB rejected the API token. Check the server configuration.' : 'The movie service is temporarily unavailable. Please retry.');
  return response.json();
}
