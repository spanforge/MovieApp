const target = process.argv[2];
if (!target || !/^https?:\/\//.test(target)) {console.error('Usage: node scripts/check-deployment.mjs https://your-app.vercel.app');process.exit(1);}
const base = new URL(target);
async function request(path) {return fetch(new URL(path,base),{signal:AbortSignal.timeout(60000)});}
try {
  for (const path of ['/','/privacy','/tmdb.svg']) {const r=await request(path);if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);console.log(path,r.status);}
  const providers=await request('/api/providers?region=IN');const p=await providers.json();
  if(!providers.ok || !p.providers?.length)throw new Error(`Provider lookup failed: HTTP ${providers.status}`);
  const movies=await request('/api/recommendations?mood=happy&region=IN&language=en');const m=await movies.json();
  if(!movies.ok || !m.movies?.length)throw new Error(`Movie lookup failed or empty: HTTP ${movies.status}`);
  if(!m.movies.every(movie=>movie.region==='IN'&&movie.original_language==='en'&&movie.providers.length))throw new Error('Unexpected region, language, or missing streaming offers.');
  const poster=m.movies.find(movie=>movie.poster_path);if(poster){const image=await fetch(`https://image.tmdb.org/t/p/w500${poster.poster_path}`);if(!image.ok)throw new Error('Poster retrieval failed');await image.body?.cancel();}
  for (const query of ['mood=funny&language=ta','mood=happy&language=hi&group=family','mood=thriller&language=en','mood=thoughtful&language=ml&minutes=120']) {
    const response=await request(`/api/recommendations?${query}`);const data=await response.json();
    if(!response.ok)throw new Error(`Combination failed: ${query}, HTTP ${response.status}`);
    const filters=new URLSearchParams(query);
    if(!data.movies.every(movie => movie.region==='IN' && movie.original_language===filters.get('language') && (!filters.has('minutes') || movie.runtime<=Number(filters.get('minutes')))))throw new Error(`Filters not honored: ${query}`);
    console.log(query,`${data.movies.length} verified candidates${data.movies.length ? '' : ' (no matches; filters were not relaxed)'}`);
  }
  console.log('Live deployment retrieval, India availability, language and poster checks passed.');
} catch(error){console.error(error.message);process.exitCode=1;}
