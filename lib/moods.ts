export const moods = [
  { id: 'sad', label: 'Feeling low', icon: '☂', genres: '18', words: ['sad', 'down', 'low', 'bad day', 'cry', 'heartbroken'] },
  { id: 'happy', label: 'Feel-good', icon: '☀', genres: '35|10751', words: ['happy', 'joy', 'cheer', 'feel good', 'feel-good', 'uplift', 'sad', 'down', 'bad day'] },
  { id: 'funny', label: 'Need a laugh', icon: '☺', genres: '35', words: ['laugh', 'funny', 'comedy', 'humor', 'bored'] },
  { id: 'romantic', label: 'Romantic', icon: '♡', genres: '10749', words: ['romantic', 'romance', 'love', 'date'] },
  { id: 'adventure', label: 'Adventurous', icon: '↗', genres: '12|28', words: ['adventure', 'action', 'exciting', 'energy', 'adventurous'] },
  { id: 'thoughtful', label: 'Thoughtful', icon: '✧', genres: '18|878', words: ['thoughtful', 'think', 'mind', 'deep', 'reflect', 'inspire'] },
  { id: 'thriller', label: 'On the edge', icon: 'ϟ', genres: '53|9648', words: ['thrill', 'mystery', 'suspense', 'edge', 'tense'] },
  { id: 'cozy', label: 'Cozy night', icon: '☾', genres: '16|10751', words: ['cozy', 'cosy', 'relax', 'stress', 'tired', 'comfort', 'chill'] },
  { id: 'scary', label: 'Feeling brave', icon: '♧', genres: '27', words: ['scary', 'horror', 'fear', 'brave', 'spooky'] },
] as const;
export function resolveMood(text: string) {
  const normalized = text.toLowerCase().trim();
  return moods.find(m => m.id === normalized) ?? moods.find(m => m.words.some(word => normalized.includes(word))) ?? null;
}
