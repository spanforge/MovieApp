'use client';
import { useRef, useState } from 'react';
import { moods, resolveMood } from '@/lib/moods';
type Provider = { provider_id: number; provider_name: string };
type Movie = { id: number; title: string; overview: string; poster_path: string | null; release_date: string; vote_average: number; providers: Provider[]; rent: Provider[]; watchLink: string | null; availabilityFailed: boolean };
export default function Home() {
  const [selected, setSelected] = useState('happy');
  const [text, setText] = useState('');
  const [region, setRegion] = useState('IN');
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [resultMood, setResultMood] = useState('');
  const [resultRegion, setResultRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const results = useRef<HTMLElement>(null);
  async function discover(event: React.FormEvent) {
    event.preventDefault();
    const mood = text.trim() ? resolveMood(text) : resolveMood(selected);
    if (!mood) { setError('Try a mood like “stressed and need to relax”, “romantic”, or “need a laugh”, or choose a mood above.'); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/recommendations?mood=${mood.id}&region=${region}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMovies(data.movies); setResultMood(data.mood); setResultRegion(data.region);
      setTimeout(() => results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  }
  return <main>
    <header><a className="brand" href="/" aria-label="Moodreel home"><span className="brand-icon">m<span>✦</span></span> moodreel<span className="brand-dot">.</span></a><span className="header-note">A little less scrolling. A lot more cinema.</span><span className="pill"><span /> YOUR NIGHT, SORTED</span></header>
    <section className="hero">
      <div className="intro"><div className="eyebrow"><span /> MOVIES THAT MEET YOU WHERE YOU ARE</div><h1>Every mood has<br />a <em>movie.</em></h1><p>The long day. The first date. The just-one-more kind of night.<br className="desktop" /> Tell us how you feel. We’ll find what to watch.</p><div className="hero-foot"><span className="tiny-star">✦</span> Good films. Your mood. Zero endless scrolling.</div></div>
      <div className="cinema" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="poster poster-back"><span>TAKE THE<br/>SCENIC<br/><i>route.</i></span><small>A LITTLE ADVENTURE GOES A LONG WAY</small></div><div className="poster poster-front"><div className="sun"/><div className="hill hill-back"/><div className="hill"/><span>somewhere<br/><i>good.</i></span><small>A FEEL-GOOD KIND OF FILM</small></div><div className="floating-tag">✦ &nbsp; Main character energy</div><span className="decor-star">✳</span><div className="film-label">PICK A MOOD. PRESS PLAY.</div></div>
    </section>
    <section className="picker"><div className="section-top"><div><span className="step">01 / THE VIBE CHECK</span><h2>What’s your mood?</h2></div><p>No wrong answers. Just good movies.</p></div>
      <form onSubmit={discover}><div className="moods" role="group" aria-label="Select your mood">{moods.map(m => <button key={m.id} type="button" className={`mood ${selected === m.id && !text ? 'active' : ''}`} aria-pressed={selected === m.id && !text} onClick={() => {setSelected(m.id); setText(''); setError('');}}><span>{m.icon}</span>{m.label}</button>)}</div>
      <div className="input-row"><div className="mood-input"><label htmlFor="mood">Or, put it in your own words</label><input id="mood" value={text} maxLength={300} onChange={e => setText(e.target.value)} placeholder="A long day. I could use something uplifting…" /></div><div className="country"><label htmlFor="region">Watching from</label><select id="region" value={region} onChange={e => setRegion(e.target.value)}><option value="IN">India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option></select></div><button className="discover" disabled={loading} type="submit">{loading ? 'Finding your films…' : 'Find my movie'}<span>{loading ? '◌' : '↗'}</span></button></div>
      {error && <p className="error" role="alert">{error}</p>}<div className="picker-note">✧ &nbsp; Handled by your mood. Powered by a world of movies.</div></form>
    </section>
    <section className="results" ref={results} aria-live="polite" aria-busy={loading}>{movies !== null ? <><div className="section-top"><div><span className="step">02 / YOUR NEXT GREAT WATCH</span><h2>{resultMood} films, coming right up.</h2></div><span className="results-country">Availability in {resultRegion}</span></div>{movies.length === 0 ? <p>No films found this time. Try another mood.</p> : <div className="movie-grid">{movies.map(movie => <article className="movie" key={movie.id}><div className="movie-poster">{movie.poster_path ? <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`${movie.title} poster`} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span>✦<br/>{movie.title}</span>}<div className="rating">★ {movie.vote_average.toFixed(1)}</div></div><div className="movie-body"><div className="movie-year">{movie.release_date?.slice(0,4) || 'Release TBA'}</div><h3>{movie.title}</h3><p>{movie.overview || 'A new story to discover.'}</p><div className="availability"><span>{movie.providers.length ? 'STREAM ON' : movie.rent.length ? 'RENT ON' : 'WHERE TO WATCH'}</span><div>{movie.availabilityFailed ? 'Availability temporarily unavailable' : (movie.providers.length ? movie.providers : movie.rent).map(p => p.provider_name).join(' · ') || 'No streaming options listed in this country'}</div></div>{movie.watchLink && <a href={movie.watchLink} target="_blank" rel="noopener noreferrer">View watch options <span>↗</span></a>}</div></article>)}</div>}<p className="availability-note">Streaming availability by JustWatch via TMDB. Catalogs can change; confirm pricing and availability with the provider.</p></> : <div className="how-it-works"><div><span>01</span><h3>Bring your mood</h3><p>Whatever you’re feeling, start there.</p></div><div><span>02</span><h3>Meet your next movie</h3><p>A fresh selection to match your moment.</p></div><div><span>03</span><h3>Find it. Stream it.</h3><p>See where to watch in your country.</p></div></div>}</section>
    <footer><a className="brand" href="/">moodreel.</a><p>Made for the love of a good movie night.</p><div><a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">Movie data & images: TMDB</a><a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">Watch availability: JustWatch</a></div><small>This product uses the TMDB API but is not endorsed or certified by TMDB.</small></footer>
  </main>;
}
