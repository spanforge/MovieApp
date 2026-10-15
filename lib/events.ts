export const eventNames = ['visit','return_visit','search_success','search_failed','shuffle','movie_chosen','watch_options','save','share','recommendation_helpful','recommendation_unhelpful'] as const;
export type EventName = typeof eventNames[number];
export function validEvent(value: unknown): value is { event: EventName; movieId?: number } {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string,unknown>;
  return Object.keys(data).every(key => ['event','movieId'].includes(key)) && eventNames.includes(data.event as EventName) && (data.movieId === undefined || (Number.isSafeInteger(data.movieId) && Number(data.movieId) > 0));
}
