import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, discoverParams, eligible, genrePlan, matchesGenres, parsePreferences, rankMovies, type Movie } from '../lib/discovery.ts';

const movie: Movie = { id: 1, title: 'A movie', overview: '', poster_path: null, release_date: '2020-01-01', vote_average: 7, genre_ids: [35], original_language: 'ta', runtime: 90, certification: 'PG', providers: [{ provider_id: 8, provider_name: 'Netflix' }], rent: [{ provider_id: 9, provider_name: 'Rental' }], watchLink: null, region: 'IN', reason: '' };
test('validate user filters and reject invalid upstream parameters', () => {
  assert.deepEqual(parsePreferences(new URLSearchParams()), defaults);
  for (const query of ['region=XX','language=bad','minutes=-1','age=NC-17','services=8|9','group=unknown','intent=unknown']) assert.throws(() => parsePreferences(new URLSearchParams(query)));
  assert.deepEqual(parsePreferences(new URLSearchParams('services=8,8,9')).services, [8,9]);
});
test('separate a sad mood from an uplifting desired feeling', () => {
  assert.equal(genrePlan('sad', defaults).genres, '18');
  assert.equal(genrePlan('sad', {...defaults,intent:'uplift'}).genres, '35|10751');
  assert.equal(genrePlan('sad', {...defaults,intent:'surprise'}, () => 0).genres, '18');
  assert.throws(() => genrePlan('xyzzy',defaults));
});
test('runtime, original language, regional services and rental filters reach discovery', () => {
  const params = discoverParams({...defaults,language:'ta',minutes:'90',services:[8,9],rentals:true},'35',2);
  assert.equal(params.get('with_original_language'),'ta');
  assert.equal(params.get('with_runtime.lte'),'90');
  assert.equal(params.get('with_watch_providers'),'8|9');
  assert.equal(params.get('with_watch_monetization_types'),'flatrate|rent');
  assert.equal(params.get('watch_region'),'IN');
  assert.equal(params.get('page'),'2');
});
test('verify runtime and availability after discovery rather than trusting upstream filters', () => {
  assert.equal(eligible(movie,{...defaults,language:'ta',minutes:'90',services:[8]}),true);
  assert.equal(eligible({...movie,runtime:91},{...defaults,minutes:'90'}),false);
  assert.equal(eligible({...movie,runtime:0},defaults),false);
  assert.equal(eligible(movie,{...defaults,language:'hi'}),false);
  assert.equal(eligible(movie,{...defaults,services:[9]}),false);
  assert.equal(eligible(movie,{...defaults,services:[9],rentals:true}),true);
  assert.equal(eligible({...movie,providers:[]},defaults),false);
  assert.equal(eligible({...movie,providers:[]},{...defaults,rentals:true}),true);
});
test('family and age filters exclude unrated or excessive ratings and excluded genres', () => {
  const family = {...defaults,group:'family'};
  assert.equal(discoverParams(family,'16|10751',1).get('certification.lte'),'PG');
  assert.equal(eligible({...movie,genre_ids:[16,10751]},family),true);
  assert.equal(eligible(movie,family),false);
  assert.equal(eligible({...movie,certification:''},family),false);
  assert.equal(eligible({...movie,certification:'PG-13'},family),false);
  assert.equal(eligible({...movie,genre_ids:[27]},family),false);
  assert.equal(eligible({...movie,genre_ids:[80]},{...defaults,gentle:true}),false);
  assert.equal(eligible({...movie,certification:'PG-13'},{...defaults,age:'PG-13'}),true);
});
test('group viewing honors both the mood and the group genres', () => {
  const date = genrePlan('sad',{...defaults,group:'date'});
  assert.equal(matchesGenres([18,10749],date.genres),true);
  assert.equal(matchesGenres([10749],date.genres),false);
  assert.equal(matchesGenres([18],date.genres),false);
  assert.equal(eligible({...movie,genre_ids:[18]},{...defaults,group:'friends'}),false);
});
test('saved and rejected genres affect ranking without mutating the candidate pool', () => {
  const drama = {...movie,id:2,genre_ids:[18]};
  const candidates = [drama,movie];
  assert.equal(rankMovies(candidates,[movie],[])[0].id,1);
  assert.equal(rankMovies([movie,drama],[],[movie])[0].id,2);
  assert.equal(candidates[0].id,2);
});
