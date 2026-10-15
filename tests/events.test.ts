import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validEvent,eventNames} from '../lib/events.ts';
test('usage events accept only predefined names and optional public movie IDs', () => {
  for (const event of eventNames) assert.equal(validEvent({event,movieId:123}),true);
  assert.equal(validEvent({event:'visit'}),true);
  for (const data of [null,{}, {event:'unknown'}, {event:'visit',mood:'private text'}, {event:'movie_chosen',movieId:-1}, {event:'visit',visitorId:'persistent-id'}]) assert.equal(validEvent(data),false);
});
