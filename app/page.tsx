'use client';
import { useEffect, useRef, useState } from 'react';
import { moods, resolveMood } from '@/lib/moods';
import { countries, defaults, languages, rankMovies, type Movie, type Preferences, type Provider } from '@/lib/discovery';

type Library = { saved: Movie[]; seen: Movie[]; rejected: Movie[] };
type Metrics = { searches: number; shuffles: number; saves: number; watchClicks: number; picks: number };
const emptyLibrary: Library = { saved: [], seen: [], rejected: [] };
const emptyMetrics: Metrics = { searches: 0, shuffles: 0, saves: 0, watchClicks: 0, picks: 0 };
const storageKey = 'moodreel.v2';
function validMovie(value: unknown): value is Movie {
  if (!value || typeof value !== 'object') return false;
  const m = value as Movie;
  return Number.isInteger(m.id) && typeof m.title === 'string' && typeof m.overview === 'string' && typeof m.region === 'string' && typeof m.reason === 'string' && typeof m.original_language === 'string' && typeof m.release_date === 'string' && typeof m.runtime === 'number' && typeof m.certification === 'string' && typeof m.vote_average === 'number' && Array.isArray(m.genre_ids) && m.genre_ids.every(Number.isInteger) && Array.isArray(m.providers) && Array.isArray(m.rent) && [...m.providers,...m.rent].every(p => typeof p.provider_name === 'string' && Number.isInteger(p.provider_id)) && (m.poster_path === null || /^\/[a-zA-Z0-9._-]+$/.test(m.poster_path)) && (m.watchLink === null || /^https:\/\/(www\.)?themoviedb\.org\//.test(m.watchLink));
}
export default function Home() {
  const [selected,setSelected] = useState('happy');
  const [text,setText] = useState('');
  const [preferences,setPreferences] = useState<Preferences>(defaults);
  const [library,setLibrary] = useState<Library>(emptyLibrary);
  const [metrics,setMetrics] = useState<Metrics>(emptyMetrics);
  const [ready,setReady] = useState(false);
  const [storageError,setStorageError] = useState('');
  const [providers,setProviders] = useState<Provider[]>([]);
  const [providerState,setProviderState] = useState('loading');
  const [providerRetry,setProviderRetry] = useState(0);
  const [pool,setPool] = useState<Movie[] | null>(null);
  const [shown,setShown] = useState<number[]>([]);
  const [resultLabel,setResultLabel] = useState('');
  const [resultRegion,setResultRegion] = useState('IN');
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [tab,setTab] = useState<'recommendations'|'saved'|'history'>('recommendations');
  const [winner,setWinner] = useState<number | null>(null);
  const results = useRef<HTMLElement>(null);
  const requestId = useRef(0);
  const lastSearch = useRef<{ mood: string; preferences: Preferences } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.library) setLibrary({ saved: Array.isArray(data.library.saved) ? data.library.saved.filter(validMovie).slice(0,200) : [], seen: Array.isArray(data.library.seen) ? data.library.seen.filter(validMovie).slice(0,200) : [], rejected: Array.isArray(data.library.rejected) ? data.library.rejected.filter(validMovie).slice(0,200) : [] });
        if (data.preferences) {
          const p = data.preferences;
          setPreferences({ region: p.region in countries ? p.region : 'IN', language: p.language in languages ? p.language : 'any', minutes: ['any','90','120','150'].includes(p.minutes) ? p.minutes : 'any', intent: ['match','uplift','surprise'].includes(p.intent) ? p.intent : 'match', group: ['solo','date','friends','family'].includes(p.group) ? p.group : 'solo', age: ['any','PG','PG-13','R'].includes(p.age) ? p.age : 'any', gentle: p.gentle === true, rentals: p.rentals === true, services: Array.isArray(p.services) ? p.services.filter(Number.isInteger).slice(0,30) : [] });
        }
        if (data.metrics) setMetrics(Object.fromEntries(Object.keys(emptyMetrics).map(key => [key, Number.isFinite(data.metrics[key]) && data.metrics[key] >= 0 ? data.metrics[key] : 0])) as Metrics);
      }
    } catch { setStorageError('Browser storage is unavailable or could not be read. Your choices work for this visit.'); }
    setReady(true);
  },[]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey,JSON.stringify({ preferences,library,metrics })); }
    catch { setStorageError('Your browser could not save changes. They will last only for this visit.'); }
  },[ready,preferences,library,metrics]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setProviderState('loading'); setProviders([]);
    fetch(`/api/providers?region=${preferences.region}`,{ signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json(); setProviders(data.providers); setProviderState('ready');
    }).catch(() => { if (!controller.signal.aborted) setProviderState('error'); });
    return () => controller.abort();
  },[ready,preferences.region,providerRetry]);
  function update<K extends keyof Preferences>(key: K,value: Preferences[K]) { setPreferences(p => ({...p,[key]:value})); }
  function count(key: keyof Metrics) { setMetrics(m => ({...m,[key]:m[key]+1})); }
  const hidden = new Set([...library.seen,...library.rejected].map(m => m.id));
  const available = rankMovies((pool ?? []).filter(m => !hidden.has(m.id)),library.saved,library.rejected);
  const shortlist = available.slice(0,3);
  function save(movie: Movie) {
    const exists = library.saved.some(m => m.id === movie.id);
    setLibrary(l => ({...l,saved: exists ? l.saved.filter(m => m.id !== movie.id) : [movie,...l.saved].slice(0,200)}));
    if (!exists) count('saves');
    setNotice(exists ? `${movie.title} removed from your watchlist.` : `${movie.title} saved for later.`);
  }
  function feedback(movie: Movie,kind: 'seen'|'rejected') {
    setLibrary(l => ({...l,saved:l.saved.filter(m => m.id !== movie.id),[kind]:[movie,...l[kind].filter(m => m.id !== movie.id)].slice(0,200)}));
    if (winner === movie.id) setWinner(null);
    setNotice(`${movie.title} ${kind === 'seen' ? 'marked as seen' : 'hidden'}. Undo this in History.`);
  }
  async function discover(shuffle = false) {
    const mood = shuffle && lastSearch.current ? resolveMood(lastSearch.current.mood) : resolveMood(text.trim() || selected);
    if (!mood) { setError('Try “feeling low”, “stressed”, or “need a laugh”, or select a mood.'); return; }
    const prefs = shuffle && lastSearch.current ? lastSearch.current.preferences : preferences;
    const id = ++requestId.current;
    setLoading(true); setError(''); setNotice('');
    const exclusions = [...new Set([...hidden,...(shuffle ? shown : [])])].slice(-500);
    const params = new URLSearchParams({ mood:mood.id, ...Object.fromEntries(Object.entries(prefs).filter(([key]) => key !== 'services').map(([key,value]) => [key,String(value)])), services:prefs.services.join(','), exclude:exclusions.join(','), shuffle:String(shuffle) });
    try {
      const response = await fetch(`/api/recommendations?${params}`,{ signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error(data.error);
      setPool(data.movies); setShown(previous => [...new Set([...(shuffle ? previous : []),...data.movies.map((m: Movie) => m.id)])].slice(-300));
      setResultLabel(data.mood); setResultRegion(data.region); setWinner(null); setTab('recommendations');
      lastSearch.current = { mood:mood.id,preferences:{...prefs,services:[...prefs.services]} };
      count(shuffle ? 'shuffles' : 'searches');
      if (data.partial) setNotice('Some movie details could not be loaded. These picks have verified watch options.');
      setTimeout(() => results.current?.scrollIntoView({ behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start' }),50);
    } catch (err) { if (id === requestId.current) setError(err instanceof Error && err.name !== 'TimeoutError' ? err.message : 'Movie discovery took too long. Please retry.'); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  function pick() { if (!shortlist.length) return; setWinner(shortlist[Math.floor(Math.random()*shortlist.length)].id); count('picks'); }
  function clearData() { requestId.current++; setLoading(false); setLibrary(emptyLibrary); setMetrics(emptyMetrics); setPreferences(defaults); setPool(null); setShown([]); setWinner(null); setText(''); setSelected('happy'); setTab('recommendations'); lastSearch.current=null; setError(''); setNotice('Your saved movies, history, preferences, and local counters have been cleared.'); }
  function card(movie: Movie,history = false) {
    const isSaved = library.saved.some(m => m.id === movie.id);
    return <article className={`movie ${winner === movie.id && tab === 'recommendations' ? 'chosen' : ''}`} key={movie.id}>
      <div className="movie-poster"><span>{movie.title}</span>{movie.poster_path && <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`${movie.title} poster`} loading="lazy" onError={e => {e.currentTarget.style.display='none';}}/>}<div className="rating">★ {movie.vote_average.toFixed(1)}</div>{winner === movie.id && tab === 'recommendations' && <div className="winner-label">Your movie tonight</div>}</div>
      <div className="movie-body"><div className="movie-year">{movie.release_date?.slice(0,4)} · {movie.runtime} min · {languages[movie.original_language as keyof typeof languages] ?? movie.original_language.toUpperCase()}{movie.certification ? ` · US ${movie.certification}` : ' · Unrated'}</div><h3>{movie.title}</h3><div className="reason"><strong>Why this fits</strong>{movie.reason}</div><p>{movie.overview || 'A new story to discover.'}</p>
      <div className="availability"><span>SUBSCRIPTION STREAMING · {countries[movie.region as keyof typeof countries] ?? movie.region}</span><div>{movie.providers.map(p => p.provider_name).join(' · ') || 'No subscription option listed'}</div>{movie.rent.length > 0 && <><span>RENTAL OPTIONS · EXTRA COST</span><div>{movie.rent.map(p => p.provider_name).join(' · ')}</div></>}</div>
      {tab !== 'recommendations' && <p className="snapshot-note">Saved availability snapshot. Open watch options to check current listings.</p>}
      {movie.watchLink && <a href={movie.watchLink} target="_blank" rel="noopener noreferrer" onClick={() => count('watchClicks')}>View watch options <span>↗</span></a>}
      {history ? <button className="small-button" onClick={() => {setLibrary(l => ({...l,seen:l.seen.filter(m => m.id !== movie.id),rejected:l.rejected.filter(m => m.id !== movie.id)}));setNotice(`${movie.title} restored to recommendations.`);}}>Undo {library.seen.some(m => m.id === movie.id) ? 'seen' : 'not interested'}</button> : <div className="movie-actions"><button className={isSaved ? 'small-button saved' : 'small-button'} aria-pressed={isSaved} onClick={() => save(movie)}>{isSaved ? '✓ Saved' : '+ Watchlist'}</button><button className="small-button" onClick={() => feedback(movie,'seen')}>Seen it</button><button className="small-button" onClick={() => feedback(movie,'rejected')}>Not interested</button></div>}</div>
    </article>;
  }
  return <main>
    <header><a className="brand" href="/" aria-label="Moodreel home"><span className="brand-icon">m<span>✦</span></span> moodreel<span className="brand-dot">.</span></a><span className="header-note">A little less scrolling. A lot more cinema.</span><button className="pill" onClick={() => {setTab('saved');results.current?.scrollIntoView({behavior:'smooth'});}}>Watchlist · {library.saved.length}</button></header>
    <section className="hero"><div className="intro"><div className="eyebrow"><span/> MOVIES THAT MEET YOU WHERE YOU ARE</div><h1>Every mood has<br/>a <em>movie.</em></h1><p>Your mood. Your services. Your kind of night.<br className="desktop"/> Three thoughtful picks to make choosing easy.</p><div className="hero-foot"><span className="tiny-star">✦</span> Less searching. More watching.</div></div><div className="cinema" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="poster poster-back"><span>TAKE THE<br/>SCENIC<br/><i>route.</i></span><small>A LITTLE ADVENTURE GOES A LONG WAY</small></div><div className="poster poster-front"><div className="sun"/><div className="hill hill-back"/><div className="hill"/><span>somewhere<br/><i>good.</i></span><small>A FEEL-GOOD KIND OF FILM</small></div><div className="floating-tag">✦ &nbsp; Your next great watch</div><span className="decor-star">✳</span></div></section>
    <section className="picker"><div className="section-top"><div><span className="step">01 / THE VIBE CHECK</span><h2>How are you feeling?</h2></div><p>Start with your mood. Make it your night.</p></div>
    <form onSubmit={e => {e.preventDefault();void discover();}}><div className="moods" role="group" aria-label="Select your mood">{moods.map(m => <button key={m.id} type="button" className={`mood ${selected === m.id && !text ? 'active' : ''}`} aria-pressed={selected === m.id && !text} onClick={() => {setSelected(m.id);setText('');setError('');}}><span>{m.icon}</span>{m.label}</button>)}</div>
    <div className="input-row"><div className="mood-input"><label htmlFor="mood">Or, put it in your own words</label><input id="mood" maxLength={300} value={text} onChange={e => setText(e.target.value)} placeholder="Feeling sad, tired, excited, or ready for an adventure…"/></div><div className="country"><label htmlFor="region">Watching from</label><select id="region" value={preferences.region} onChange={e => setPreferences(p => ({...p,region:e.target.value,services:[]}))}>{Object.entries(countries).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></div></div>
    <div className="preference-grid"><div><label htmlFor="intent">How do you want to feel?</label><select id="intent" value={preferences.intent} onChange={e => update('intent',e.target.value)}><option value="match">Match my mood</option><option value="uplift">Lift my spirits</option><option value="surprise">Surprise me</option></select></div><div><label htmlFor="language">Original language</label><select id="language" value={preferences.language} onChange={e => update('language',e.target.value)}>{Object.entries(languages).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></div><div><label htmlFor="minutes">How much time?</label><select id="minutes" value={preferences.minutes} onChange={e => update('minutes',e.target.value)}><option value="any">Any length</option><option value="90">90 minutes or less</option><option value="120">Two hours or less</option><option value="150">Two and a half hours or less</option></select></div><div><label htmlFor="group">Who’s watching?</label><select id="group" value={preferences.group} onChange={e => update('group',e.target.value)}><option value="solo">Just me</option><option value="date">Date night</option><option value="friends">Friends</option><option value="family">Family</option></select></div><div><label htmlFor="age">Maximum US age rating</label><select id="age" value={preferences.age} onChange={e => update('age',e.target.value)}><option value="any">{preferences.group === 'family' ? 'Family default: PG' : 'Any rating'}</option><option value="PG">PG (includes G)</option><option value="PG-13">PG-13 and below</option><option value="R">R and below</option></select></div></div>
    <p className="field-note">Language means original audio; dubbed tracks depend on the provider. Family defaults to animation/family genres and US PG or below. Ratings are guidance, not a guarantee of suitability.</p>
    <fieldset className="services"><legend>My subscriptions <span>Optional · select none to search all services</span></legend>{providerState === 'loading' ? <p className="field-note" role="status">Loading services…</p> : providerState === 'error' ? <p className="field-note">Couldn’t load services. <button type="button" className="text-button" onClick={() => setProviderRetry(v => v+1)}>Retry</button> or search all services.</p> : providers.length === 0 ? <p className="field-note">No services listed for this country.</p> : <div className="service-options">{providers.map(p => <label className="check-label" key={p.provider_id}><input type="checkbox" checked={preferences.services.includes(p.provider_id)} onChange={e => update('services',e.target.checked ? [...preferences.services,p.provider_id].slice(0,30) : preferences.services.filter(id => id !== p.provider_id))}/>{p.provider_name}</label>)}</div>}{preferences.services.length > 0 && <button type="button" className="text-button" onClick={() => update('services',[])}>Clear {preferences.services.length} selected services</button>}</fieldset>
    <div className="extra-options"><label className="check-label"><input type="checkbox" checked={preferences.rentals} onChange={e => update('rentals',e.target.checked)}/>Include rentals (extra cost)</label><label className="check-label"><input type="checkbox" checked={preferences.gentle} onChange={e => update('gentle',e.target.checked)}/>Avoid horror, war, and crime genres</label></div><p className="field-note">Genre exclusions don’t screen individual scenes, violence, language, or other sensitive content. Check a parental/content guide when needed.</p>
    <div className="submit-row"><span>Preferences stay on this browser. No account needed.</span><button className="discover" disabled={loading || !ready} type="submit">{loading ? 'Finding your films…' : 'Find my three picks'}<span>↗</span></button></div>{error && <p className="error" role="alert">{error}</p>}</form></section>
    {storageError && <p className="error" role="status">{storageError}</p>}
    <section className="results" ref={results} aria-busy={loading}><div className="tabs" role="group" aria-label="Movie collection"><button aria-pressed={tab === 'recommendations'} onClick={() => setTab('recommendations')}>Your picks</button><button aria-pressed={tab === 'saved'} onClick={() => setTab('saved')}>Watchlist ({library.saved.length})</button><button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>History ({library.seen.length+library.rejected.length})</button></div><p className="notice" role="status">{notice}</p>
    {tab === 'recommendations' ? <>{pool !== null ? <><div className="section-top"><div><span className="step">02 / YOUR NEXT GREAT WATCH</span><h2>{resultLabel}: your shortlist.</h2><p className="field-note">Verified watch options in {countries[resultRegion as keyof typeof countries]}. Saves and dismissals help rank your next picks.</p></div><div className="result-actions"><button className="small-button" disabled={loading || !shortlist.length} onClick={pick}>Pick for me ✦</button><button className="small-button" disabled={loading} onClick={() => void discover(true)}>{loading ? 'Searching…' : 'Shuffle picks ↻'}</button></div></div>{winner && shortlist.some(m => m.id === winner) && <p className="pick-announcement" role="status">Tonight’s pick: <strong>{shortlist.find(m => m.id === winner)?.title}</strong>. Your decision is made.</p>}{shortlist.length ? <div className="movie-grid">{shortlist.map(m => card(m))}</div> : <div className="empty-state"><h3>No matching movies this time.</h3><p>Try another shuffle, clear selected services, allow more time, or broaden language and rating preferences. Your filters are never silently relaxed.</p></div>}</> : <div className="how-it-works"><div><span>01</span><h3>Set the mood</h3><p>Match your feelings or change the vibe.</p></div><div><span>02</span><h3>Make it personal</h3><p>Your language, services, and available time.</p></div><div><span>03</span><h3>Choose one. Press play.</h3><p>Three picks, or let us choose tonight’s movie.</p></div></div>}</> : tab === 'saved' ? <><div className="section-top"><div><span className="step">FOR ANOTHER NIGHT</span><h2>Your watchlist.</h2></div></div>{library.saved.length ? <div className="movie-grid">{library.saved.map(m => card(m))}</div> : <div className="empty-state">Save a movie from your picks and it will be here next time.</div>}</> : <><div className="section-top"><div><span className="step">MAKE ROOM FOR SOMETHING NEW</span><h2>Seen & not interested.</h2></div></div>{library.seen.length+library.rejected.length ? <div className="movie-grid">{[...library.seen,...library.rejected].map(m => card(m,true))}</div> : <div className="empty-state">Movies you mark as seen or not interested appear here. You can undo either choice.</div>}</>}
    <p className="availability-note">Streaming availability by JustWatch via TMDB. Catalogs, audio tracks, and prices can change; confirm with the provider.</p></section>
    <details className="insights"><summary>Your local activity & privacy</summary><p>Only on this browser: {metrics.searches} searches · {metrics.shuffles} shuffles · {metrics.saves} saves · {metrics.watchClicks} watch-option clicks · {metrics.picks} automatic picks.</p><p>These counters help you see how you use Moodreel. They are not sent to an analytics service. Your watchlist and history are stored on this device (up to 200 movies per list); clearing browser data removes them.</p><button className="small-button" onClick={clearData}>Clear my local data</button></details>
    <footer><a className="brand" href="/">moodreel.</a><p>Made for the love of a good movie night.</p><div><a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">Movie data & images: TMDB</a><a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">Watch availability: JustWatch</a></div><small>This product uses the TMDB API but is not endorsed or certified by TMDB.</small></footer>
  </main>;
}

