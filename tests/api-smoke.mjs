import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { once } from 'node:events';

const port = 3097;
const server = spawn(process.execPath,['--import','./tests/fixtures/tmdb.mjs','node_modules/next/dist/bin/next','start','--port',String(port)],{ env: {...process.env,TMDB_READ_ACCESS_TOKEN:`integration-test-${Date.now()}`}, stdio:['ignore','pipe','pipe'] });
let output = '';
server.stdout.on('data',chunk => {output += chunk;});
server.stderr.on('data',chunk => {output += chunk;});
try {
  for (let attempt = 0; attempt < 100 && !output.includes('Ready'); attempt++) {
    if (server.exitCode !== null) throw new Error(`Test server exited: ${output}`);
    await new Promise(resolve => setTimeout(resolve,100));
  }
  assert.ok(output.includes('Ready'),'Production test server starts');
  async function get(path) { const response = await fetch(`http://localhost:${port}${path}`); return {status:response.status,data:await response.json()}; }
  const home = await fetch(`http://localhost:${port}`);
  assert.equal(home.status,200);
  assert.match(await home.text(),/Find a movie/);
  assert.equal(home.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await fetch(`http://localhost:${port}/privacy`)).status,200);
  const logo = await fetch(`http://localhost:${port}/tmdb.svg`);assert.equal(logo.status,200);assert.match(await logo.text(),/<svg/);
  async function post(path,data,origin) {return fetch(`http://localhost:${port}${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(origin ? {Origin:origin} : {})},body:JSON.stringify(data)});}
  assert.equal((await post('/api/events',{event:'movie_chosen',movieId:1})).status,204);
  assert.equal((await post('/api/events',{event:'search_success',mood:'not allowed'})).status,400);
  assert.equal((await post('/api/events',{event:'visit'},'https://other.example')).status,403);
  assert.equal((await post('/api/feedback',{category:'availability',movieId:1,message:'This movie is missing from the listed service.'})).status,201);
  assert.equal((await post('/api/feedback',{category:'bug',message:'no'})).status,400);
  assert.equal((await post('/api/feedback',{category:'bug',message:'x'.repeat(5000)})).status,413);
  const providerResult = await get('/api/providers?region=IN');
  assert.equal(providerResult.status,200); assert.equal(providerResult.data.providers.length,2);
  assert.equal((await get('/api/providers?region=XX')).status,400);
  assert.equal((await get('/api/providers?region=US')).status,400);
  assert.equal((await get('/api/providers?region=toString')).status,400);
  assert.equal((await get('/api/recommendations?mood=happy&region=US')).status,400);
  assert.equal((await get('/api/recommendations?mood=happy&language=ko')).status,400);
  const strict = await get('/api/recommendations?mood=happy&region=IN&language=ta&minutes=90&services=8&group=family');
  assert.equal(strict.status,200); assert.deepEqual(strict.data.movies.map(m => m.id),[1,10]);
  assert.ok(strict.data.movies.every(m => m.reason && m.watchLink && m.region === 'IN'));
  assert.ok(strict.data.movies.every(m => m.indianCertification === 'U'));
  const rentals = await get('/api/recommendations?mood=happy&region=IN&services=9&rentals=true');
  assert.equal(rentals.status,200); assert.ok(rentals.data.movies.some(m => m.id === 4));
  const subscriptionOnly = await get('/api/recommendations?mood=happy&region=IN&services=9');
  assert.equal(subscriptionOnly.status,200); assert.equal(subscriptionOnly.data.movies.length,0);
  const exclusions = await get('/api/recommendations?mood=happy&region=IN&language=ta&minutes=90&services=8&group=family&exclude=1');
  assert.deepEqual(exclusions.data.movies.map(m => m.id),[10]);
  const allLanguages = await get('/api/recommendations?mood=happy');
  assert.equal(allLanguages.status,200);
  assert.ok(allLanguages.data.movies.some(m => m.original_language === 'en'));
  assert.ok(!allLanguages.data.movies.some(m => m.original_language === 'ko'));
  const invalid = await get('/api/recommendations?mood=happy&minutes=-1'); assert.equal(invalid.status,400);
  const unknown = await get('/api/recommendations?mood=xyzzy'); assert.equal(unknown.status,400);
  assert.equal((await post('/api/feedback',{category:'bug',message:'Valid message'},'https://other.example')).status,403);
  let rateResponse;
  for(let i=0;i<42;i++) rateResponse=await post('/api/events',{event:'visit'});
  assert.equal(rateResponse.status,429);
  console.log('Production API smoke checks passed: homepage, privacy, logo, security headers, providers, strict filters, Indian certificates, rentals, exclusions, feedback/events validation, origin checks, body limits and rate limits. TMDB responses were mocked; no real token used.');
} finally {
  server.kill();
  if (server.exitCode === null) await once(server,'exit');
}
