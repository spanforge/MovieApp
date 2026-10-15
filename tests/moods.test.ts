import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moods, resolveMood } from '../lib/moods.ts';
test('all mood selections resolve to their own genre mapping', () => {
  for (const mood of moods) assert.equal(resolveMood(mood.id)?.id, mood.id);
});
test('natural mood descriptions select suitable genres', () => {
  assert.equal(resolveMood('I am stressed and need to relax')?.id, 'cozy');
  assert.equal(resolveMood('Had a bad day, feeling sad')?.id, 'sad');
  assert.equal(resolveMood('Date night with my love')?.id, 'romantic');
  assert.equal(resolveMood('I need a laugh')?.id, 'funny');
});
test('unrecognized moods require clarification', () => {
  assert.equal(resolveMood(''), null);
  assert.equal(resolveMood('xyzzy'), null);
});
