'use client';
import { useEffect, useRef, useState } from 'react';
import { moods, resolveMood } from '@/lib/moods';
import Feedback from '@/components/Feedback';
import type { EventName } from '@/lib/events';
import { countries, defaults, languages, rankMovies, type Movie, type Preferences, type Provider } from '@/lib/discovery';

type Library = { saved: Movie[]; seen: Movie[]; rejected: Movie[] };
type Metrics = { searches: number; shuffles: number; saves: number; watchClicks: number; picks: number };
const emptyLibrary: Library = { saved: [], seen: [], rejected: [] };
const emptyMetrics: Metrics = { searches: 0, shuffles: 0, saves: 0, watchClicks: 0, picks: 0 };
const storageKey = 'moodreel.v2';
function validMovie(value: unknown): value is Movie {
  if (!value || typeof value !== 'object') return false;
  const m = value as Movie;
  return Number.isInteger(m.id) && typeof m.title === 'string' && typeof m.overview === 'string' && m.region === 'IN' && m.original_language !== 'any' && Object.hasOwn(languages, m.original_language) && typeof m.reason === 'string' && typeof m.original_language === 'string' && typeof m.release_date === 'string' && typeof m.runtime === 'number' && typeof m.certification === 'string' && typeof m.vote_average === 'number' && Array.isArray(m.genre_ids) && m.genre_ids.every(Number.isInteger) && Array.isArray(m.providers) && Array.isArray(m.rent) && [...m.providers,...m.rent].every(p => typeof p.provider_name === 'string' && Number.isInteger(p.provider_id)) && (m.poster_path === null || /^\/[a-zA-Z0-9._-]+$/.test(m.poster_path)) && (m.watchLink === null || /^https:\/\/(www\.)?themoviedb\.org\//.test(m.watchLink));
}
export default function Home() {
  const [report,setReport] = useState<{movieId?:number} | null>(null);
  const [chosen,setChosen] = useState<number[]>([]);
  const [votes,setVotes] = useState<Record<string,'yes'|'no'>>({});
  const [sharing,setSharing] = useState(false);
  const [shareFallback,setShareFallback] = useState<{id:number;url:string} | null>(null);
  const visitSent = useRef(false);
  const returning = useRef(false);
  const [optionsOpen,setOptionsOpen] = useState(false);
  const [moreMoods,setMoreMoods] = useState(false);
  const [serviceQuery,setServiceQuery] = useState('');
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
  const [resultRegion,setResultRegion] = useState('IN');
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [undoMovie,setUndoMovie] = useState<Movie | null>(null);
  const [tab,setTab] = useState<'recommendations'|'saved'|'history'>('recommendations');
  const [winner,setWinner] = useState<number | null>(null);
  const results = useRef<HTMLElement>(null);
  const requestId = useRef(0);
  const lastSearch = useRef<{ mood: string; preferences: Preferences } | null>(null);
  useEffect(() => {
    try {
      const previous = Number(localStorage.getItem('moodreel.lastVisit'));
      returning.current = previous > 0 && Date.now()-previous > 30*60*1000;
      localStorage.setItem('moodreel.lastVisit',String(Date.now()));
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.library) setLibrary({ saved: Array.isArray(data.library.saved) ? data.library.saved.filter(validMovie).slice(0,200) : [], seen: Array.isArray(data.library.seen) ? data.library.seen.filter(validMovie).slice(0,200) : [], rejected: Array.isArray(data.library.rejected) ? data.library.rejected.filter(validMovie).slice(0,200) : [] });
        if (data.preferences) {
          const p = data.preferences;
          setPreferences({ region: 'IN', language: Object.hasOwn(languages, p.language) ? p.language : 'any', minutes: ['any','90','120','150'].includes(p.minutes) ? p.minutes : 'any', intent: ['match','uplift','surprise'].includes(p.intent) ? p.intent : 'match', group: ['solo','date','friends','family'].includes(p.group) ? p.group : 'solo', age: ['any','PG','PG-13','R'].includes(p.age) ? p.age : 'any', gentle: p.gentle === true, rentals: p.rentals === true, services: p.region === 'IN' && Array.isArray(p.services) ? p.services.filter(Number.isInteger).slice(0,30) : [] });
        }
        if (Array.isArray(data.chosen)) setChosen(data.chosen.filter(Number.isSafeInteger).slice(0,200));
        if (data.votes && typeof data.votes === 'object') setVotes(Object.fromEntries(Object.entries(data.votes).filter(([key,value]) => /^\d+$/.test(key) && ['yes','no'].includes(String(value))).slice(-200)) as Record<string,'yes'|'no'>);
        setSharing(data.sharing === true && !privacySignal());
        if (data.metrics) setMetrics(Object.fromEntries(Object.keys(emptyMetrics).map(key => [key, Number.isFinite(data.metrics[key]) && data.metrics[key] >= 0 ? data.metrics[key] : 0])) as Metrics);
      }
    } catch { setStorageError('Browser storage is unavailable or could not be read. Your choices work for this visit.'); }
    setReady(true);
  },[]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey,JSON.stringify({ preferences,library,metrics,chosen,votes,sharing })); }
    catch { setStorageError('Your browser could not save changes. They will last only for this visit.'); }
  },[ready,preferences,library,metrics,chosen,votes,sharing]);
  useEffect(() => {
    if (!ready || !optionsOpen) return;
    const controller = new AbortController();
    setProviderState('loading'); setProviders([]);
    fetch(`/api/providers?region=${preferences.region}`,{ signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json(); setProviders(data.providers); setProviderState('ready');
    }).catch(() => { if (!controller.signal.aborted) setProviderState('error'); });
    return () => controller.abort();
  },[ready,optionsOpen,preferences.region,providerRetry]);
  function privacySignal() { return navigator.doNotTrack === '1' || Boolean((navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl); }
  function emit(event: EventName,movieId?: number) {
    if (!sharing || privacySignal()) return;
    void fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,movieId}),keepalive:true}).catch(() => {});
  }
  useEffect(() => {
    if (ready && sharing && !visitSent.current) {visitSent.current=true;emit(returning.current ? 'return_visit' : 'visit');}
    // A visit is recorded at most once per page mount, after opt-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ready,sharing]);
  function chooseMovie(movie: Movie) {
    const already = chosen.includes(movie.id);
    setChosen(ids => already ? ids.filter(id => id !== movie.id) : [...ids,movie.id].slice(-200));
    if (!already) emit('movie_chosen',movie.id);
    setNotice(already ? `${movie.title} unmarked.` : `Enjoy ${movie.title}! Use Where to watch to find it.`);
  }
  function vote(movie: Movie,value: 'yes'|'no') {
    setVotes(previous => ({...previous,[movie.id]:value}));
    emit(value === 'yes' ? 'recommendation_helpful' : 'recommendation_unhelpful',movie.id);
    setNotice('Thanks for letting us know.');
  }
  async function shareMovie(movie: Movie) {
    const url=movie.watchLink ?? `https://www.themoviedb.org/movie/${movie.id}`;
    const shareText=`Tonight's movie: ${movie.title}. Suggested by Moodreel: ${window.location.origin}`;
    try {
      if (navigator.share) await navigator.share({title:movie.title,text:shareText,url});
      else if (navigator.clipboard?.writeText) {await navigator.clipboard.writeText(`${shareText}\n${url}`);setNotice('Movie link copied. Send it to a friend.');}
      else {setShareFallback({id:movie.id,url});return;}
      emit('share',movie.id);
    } catch(error) {if (!(error instanceof Error && error.name === 'AbortError')) {setShareFallback({id:movie.id,url});setNotice('Copy the movie link below to share it.');}}
  }
  function update<K extends keyof Preferences>(key: K,value: Preferences[K]) { setPreferences(p => ({...p,[key]:value})); }
  function count(key: keyof Metrics) { setMetrics(m => ({...m,[key]:m[key]+1})); }
  const hidden = new Set([...library.seen,...library.rejected].map(m => m.id));
  const available = rankMovies((pool ?? []).filter(m => !hidden.has(m.id)),library.saved,library.rejected);
  const shortlist = available.slice(0,3);
  function save(movie: Movie) {
    setUndoMovie(null);
    const exists = library.saved.some(m => m.id === movie.id);
    setLibrary(l => ({...l,saved: exists ? l.saved.filter(m => m.id !== movie.id) : [movie,...l.saved].slice(0,200)}));
    if (!exists) {count('saves');emit('save',movie.id);}
    setNotice(exists ? `${movie.title} removed from your watchlist.` : `${movie.title} saved for later.`);
  }
  function feedback(movie: Movie,kind: 'seen'|'rejected') {
    setLibrary(l => ({...l,saved:l.saved.filter(m => m.id !== movie.id),[kind]:[movie,...l[kind].filter(m => m.id !== movie.id)].slice(0,200)}));
    if (winner === movie.id) setWinner(null);
    setUndoMovie(movie);
    setNotice(`${movie.title} ${kind === 'seen' ? 'marked as seen' : 'hidden'}.`);
  }
  async function discover(shuffle = false, override?: Preferences) {
    const mood = shuffle && lastSearch.current ? resolveMood(lastSearch.current.mood) : resolveMood(text.trim() || selected);
    if (!mood) { setError('Try “feeling low”, “stressed”, or “need a laugh”, or select a mood.'); return; }
    const prefs = override ?? (shuffle && lastSearch.current ? lastSearch.current.preferences : preferences);
    const id = ++requestId.current;
    setLoading(true); setTab('recommendations'); setError(''); setNotice(''); setUndoMovie(null);
    const exclusions = [...new Set([...hidden,...(shuffle ? shown : [])])].slice(-500);
    const params = new URLSearchParams({ mood:mood.id, ...Object.fromEntries(Object.entries(prefs).filter(([key]) => key !== 'services').map(([key,value]) => [key,String(value)])), services:prefs.services.join(','), exclude:exclusions.join(','), shuffle:String(shuffle) });
    try {
      const response = await fetch(`/api/recommendations?${params}`,{ signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error(data.error);
      setPool(data.movies); setShown(previous => [...new Set([...(shuffle ? previous : []),...data.movies.map((m: Movie) => m.id)])].slice(-300));
      setResultRegion(data.region); setWinner(null); setTab('recommendations');
      lastSearch.current = { mood:mood.id,preferences:{...prefs,services:[...prefs.services]} };
      count(shuffle ? 'shuffles' : 'searches');
      emit(shuffle ? 'shuffle' : 'search_success');
      if (data.partial) setNotice('Some movie details could not be loaded. These picks have verified watch options.');
      setTimeout(() => {results.current?.focus({preventScroll:true});results.current?.scrollIntoView({ behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start' });},50);
    } catch (err) { if (id === requestId.current) emit('search_failed'); if (id === requestId.current) setError(err instanceof Error && err.name !== 'TimeoutError' ? err.message : 'Movie discovery took too long. Please retry.'); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  function pick() { if (!shortlist.length) return; setWinner(shortlist[Math.floor(Math.random()*shortlist.length)].id); count('picks'); }
  function broadenSearch() {
    const broad={...defaults,language:preferences.language};setPreferences(broad);void discover(false,broad);
  }
  function clearData() { setChosen([]);setVotes({});setSharing(false);try {localStorage.removeItem('moodreel.lastVisit');} catch {} setUndoMovie(null); requestId.current++; setLoading(false); setLibrary(emptyLibrary); setMetrics(emptyMetrics); setPreferences(defaults); setPool(null); setShown([]); setWinner(null); setText(''); setSelected('happy'); setTab('recommendations'); lastSearch.current=null; setError(''); setNotice('Your saved movies, history, preferences, and local counters have been cleared.'); }
  function undoFeedback(movie: Movie) {
    setLibrary(l => ({...l,seen:l.seen.filter(m => m.id !== movie.id),rejected:l.rejected.filter(m => m.id !== movie.id)}));
    setUndoMovie(null); setNotice(`${movie.title} can appear in your suggestions again.`);
  }
  const primaryMoods = ['happy','funny','cozy','sad','romantic','adventure'];
  const visibleMoods = moreMoods ? [...moods] : moods.filter(m => primaryMoods.includes(m.id) || m.id === selected);
  const moodNames: Record<string,string> = { happy: 'Happy', funny: 'Need a laugh', cozy: 'Tired', sad: 'Feeling low', romantic: 'Romantic', adventure: 'Adventurous', thoughtful: 'Thoughtful', thriller: 'Want suspense', scary: 'Feeling brave' };
  const preferenceSummary = [preferences.language !== 'any' ? languages[preferences.language as keyof typeof languages] : '', preferences.minutes !== 'any' ? `Up to ${preferences.minutes} min` : '', preferences.services.length ? `${preferences.services.length} streaming ${preferences.services.length === 1 ? 'app' : 'apps'}` : '', preferences.group !== 'solo' ? ({date:'Date night',friends:'With friends',family:'With family'}[preferences.group]) : '', preferences.intent !== 'match' ? preferences.intent === 'uplift' ? 'Cheer me up' : 'Surprise me' : '', preferences.age !== 'any' ? `US ${preferences.age} or below` : '', preferences.gentle ? 'Skip horror, war & crime' : '', preferences.rentals ? 'Rentals included' : ''].filter(Boolean);
  function card(movie: Movie,history = false) {
    const isSaved = library.saved.some(m => m.id === movie.id);
    return <article className={`movie ${winner === movie.id && tab === 'recommendations' ? 'chosen' : ''}`} key={movie.id}>
      <div className="movie-poster"><span>{movie.title}</span>{movie.poster_path && <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`${movie.title} poster`} loading="lazy" onError={e => {e.currentTarget.style.display='none';}}/>}<div className="rating" aria-label={`TMDB rating: ${movie.vote_average.toFixed(1)} out of 10`}><span aria-hidden="true">&#9733;</span> {movie.vote_average.toFixed(1)}</div>{winner === movie.id && tab === 'recommendations' && <div className="winner-label">Tonight's pick</div>}</div>
      <div className="movie-body"><h3>{movie.title}</h3><div className="movie-year">{movie.release_date?.slice(0,4)} | {movie.runtime} min | {languages[movie.original_language as keyof typeof languages] ?? movie.original_language.toUpperCase()}</div>
      <div className="availability"><span>Watch in {countries[movie.region as keyof typeof countries] ?? movie.region}</span><div>{movie.providers.length ? movie.providers.slice(0,3).map(p => p.provider_name).join(' | ') + (movie.providers.length > 3 ? ' + more' : '') : movie.rent.length ? `Rent on ${movie.rent.slice(0,2).map(p => p.provider_name).join(' or ')}` : 'Check current watch options'}</div></div>
      {tab !== 'recommendations' && <p className="snapshot-note">Availability may have changed since you saved this.</p>}
      <div className="card-main-actions">{movie.watchLink && <a className="watch-button" href={movie.watchLink} target="_blank" rel="noopener noreferrer" onClick={() => {count('watchClicks');emit('watch_options',movie.id);}}>Where to watch <span className="sr-only">(opens in a new tab)</span>↗</a>}{!history && <button className={isSaved ? 'small-button saved' : 'small-button'} aria-pressed={isSaved} aria-label={`${isSaved ? 'Unsave' : 'Save'} ${movie.title}`} onClick={() => save(movie)}>{isSaved ? 'Saved' : '+ Save'}</button>}</div>
      <details className="movie-details"><summary>About this movie</summary><p>{movie.overview || 'A new story to discover.'}</p><p className="reason"><strong>Why we picked it</strong>{movie.reason}</p><p className="field-note">Indian certificate: {movie.indianCertification || 'Not listed'}.<br/>US age rating: {movie.certification || 'Not listed'}. Check a content guide if watching with children.</p>{movie.rent.length > 0 && <p className="field-note">Also available to rent (extra cost): {movie.rent.map(p => p.provider_name).join(', ')}.</p>}{!history && <div className="movie-actions"><button className="small-button" onClick={() => feedback(movie,'seen')}>Already seen it</button><button className="small-button" onClick={() => feedback(movie,'rejected')}>Not for me</button></div>}{!history && <><div className="movie-actions"><button className="small-button" aria-pressed={chosen.includes(movie.id)} onClick={() => chooseMovie(movie)}>{chosen.includes(movie.id) ? 'Chosen for tonight' : 'I chose this movie'}</button><button className="small-button" onClick={() => void shareMovie(movie)}>Share movie</button></div><div className="useful-vote"><span>Was this a useful suggestion?</span><button className="small-button" aria-pressed={votes[movie.id] === 'yes'} onClick={() => vote(movie,'yes')}>Yes</button><button className="small-button" aria-pressed={votes[movie.id] === 'no'} onClick={() => vote(movie,'no')}>No</button></div></>}<button className="text-button" onClick={() => setReport({movieId:movie.id})}>Report a problem with this movie</button></details>
      {shareFallback?.id === movie.id && <label className="share-fallback">Copy this movie link<input readOnly value={shareFallback.url} onFocus={e => e.target.select()}/></label>}
      {history && <button className="small-button restore-button" onClick={() => undoFeedback(movie)}>Undo {library.seen.some(m => m.id === movie.id) ? 'seen' : 'hidden'}</button>}</div>
    </article>;
  }
  return <main>
    <a className="skip-link" href="#movie-form">Skip to choosing a movie</a>
    <header><a className="brand" href="/" aria-label="Moodreel home"><span className="brand-icon">m<span>✦</span></span> moodreel<span className="brand-dot">.</span></a><button className="pill" onClick={() => {setTab('saved');results.current?.scrollIntoView({behavior:'smooth'});}}>Saved movies{library.saved.length > 0 ? ` (${library.saved.length})` : ''}</button></header>
    <section className="simple-intro"><span className="eyebrow">LET'S FIND SOMETHING GOOD</span><h1>What are you in<br className="mobile-break"/> the <em>mood for?</em></h1><p>Choose a mood. We will suggest three movies and show you where to watch.</p></section>
    <section className="picker" id="movie-form" tabIndex={-1}><form onSubmit={e => {e.preventDefault();void discover();}}><h2 className="mood-heading">Today, I am feeling...</h2><div className="moods" role="group" aria-label="Choose a mood">{visibleMoods.map(m => <button key={m.id} type="button" className={`mood ${selected === m.id && !text ? 'active' : ''}`} aria-pressed={selected === m.id && !text} onClick={() => {setSelected(m.id);setText('');setError('');}}><span aria-hidden="true">{m.icon}</span>{moodNames[m.id]}</button>)}</div><div className="mood-alternatives"><button type="button" className="text-button" aria-expanded={moreMoods} onClick={() => setMoreMoods(v => !v)}>{moreMoods ? 'Fewer moods' : 'More moods'}</button><details className="describe-mood"><summary>Describe it instead</summary><label htmlFor="mood">How are you feeling?</label><input id="mood" maxLength={300} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. I have had a long day and need to relax"/></details></div>
    {text && <p className="field-note">Your mood: {text} <button type="button" className="text-button" onClick={() => setText('')}>Use selected mood instead</button></p>}
    <div className="language-choice"><div><label htmlFor="language">Movie language</label><select id="language" value={preferences.language} onChange={e => update('language',e.target.value)}>{Object.entries(languages).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></div></div><div className="search-context"><span>Movies to watch in <strong>India</strong></span></div>
    {preferenceSummary.length > 0 && <div className="active-preferences"><span>{preferenceSummary.join(' | ')}</span><button type="button" className="text-button" onClick={() => setPreferences({...defaults,region:preferences.region})}>Reset choices</button></div>}
    <button className="discover primary-discover" disabled={loading || !ready} type="submit">{loading ? 'Finding your movies...' : 'Find a movie'}<span aria-hidden="true">↗</span></button><p className="simple-reassurance">No sign-up. Just a good movie night.</p>{error && <div className="error" role="alert"><p>{error}</p><button type="button" className="small-button" disabled={loading} onClick={() => void discover()}>Try again</button><button type="button" className="text-button" onClick={() => setReport({})}>Tell us what went wrong</button></div>}
    <details className="optional-preferences" open={optionsOpen} onToggle={e => setOptionsOpen(e.currentTarget.open)}><summary>Make it yours <span>Optional choices</span></summary><p className="field-note">Have a favourite language or streaming app? Choose here. You can leave everything as it is.</p>{preferences.group === 'family' && <p className="rating-guidance">Family picks use animation/family genres and a US G/PG rating limit by default. This is not an Indian age rating or a check of individual scenes.</p>}<div className="preference-grid"><div><label htmlFor="minutes">Time to watch</label><select id="minutes" value={preferences.minutes} onChange={e => update('minutes',e.target.value)}><option value="any">Any length</option><option value="90">Up to 90 minutes</option><option value="120">Up to 2 hours</option><option value="150">Up to 150 minutes</option></select></div><div><label htmlFor="group">Watching with</label><select id="group" value={preferences.group} onChange={e => update('group',e.target.value)}><option value="solo">Just me</option><option value="date">My date</option><option value="friends">Friends</option><option value="family">Family</option></select></div><div><label htmlFor="intent">What would feel good?</label><select id="intent" value={preferences.intent} onChange={e => update('intent',e.target.value)}><option value="match">Something to match my mood</option><option value="uplift">Something to cheer me up</option><option value="surprise">Surprise me</option></select></div></div><p className="field-note">Movie language is the language it was made in. Check the streaming app for dubbed versions.</p>
    <fieldset className="services"><legend>Which streaming apps do you have?</legend><p className="field-note">Choose your apps, or leave them all unticked to search everywhere.</p>{providerState === 'loading' ? <p className="field-note" role="status">Loading streaming apps...</p> : providerState === 'error' ? <p className="field-note">We could not load the apps. <button type="button" className="text-button" onClick={() => setProviderRetry(v => v+1)}>Try again</button>. You can still find movies across all apps.</p> : providers.length === 0 ? <p className="field-note">No streaming apps listed for India.</p> : <><label htmlFor="service-search">Find your app</label><input id="service-search" className="service-search" type="search" value={serviceQuery} onChange={e => setServiceQuery(e.target.value)} placeholder="e.g. Netflix or Prime Video"/><div className="service-options">{providers.filter(p => p.provider_name.toLowerCase().includes(serviceQuery.toLowerCase())).map(p => <label className="check-label" key={p.provider_id}><input type="checkbox" checked={preferences.services.includes(p.provider_id)} onChange={e => update('services',e.target.checked ? [...preferences.services,p.provider_id].slice(0,30) : preferences.services.filter(id => id !== p.provider_id))}/>{p.provider_name}</label>)}</div>{!providers.some(p => p.provider_name.toLowerCase().includes(serviceQuery.toLowerCase())) && <p className="field-note">No app with that name. Try another name or clear your search.</p>}</>}{preferences.services.length > 0 && <button type="button" className="text-button" onClick={() => update('services',[])}>Clear selected apps ({preferences.services.length})</button>}</fieldset>
    <details className="content-choices"><summary>Age ratings & things to avoid</summary><label htmlFor="age">Age rating (US ratings)</label><select id="age" value={preferences.age} onChange={e => update('age',e.target.value)}><option value="any">{preferences.group === 'family' ? 'Family choice: G or PG' : 'Any rating'}</option><option value="PG">G or PG</option><option value="PG-13">Up to PG-13</option><option value="R">Up to R</option></select><p className="field-note">Family movies default to G or PG. Ratings vary by country; check a parents' guide if needed.</p><label className="check-label"><input type="checkbox" checked={preferences.gentle} onChange={e => update('gentle',e.target.checked)}/>Skip horror, war, and crime movies</label><p className="field-note">This skips those types of movies, but does not check individual scenes.</p></details><label className="check-label rental-choice"><input type="checkbox" checked={preferences.rentals} onChange={e => update('rentals',e.target.checked)}/>Also show movies I can rent for an extra charge</label><button className="discover" disabled={loading || !ready} type="submit">{loading ? 'Finding your movies...' : 'Find a movie'}<span aria-hidden="true">↗</span></button></details></form></section>
    {storageError && <p className="error" role="status">{storageError}</p>}
    <section className="results" ref={results} aria-busy={loading} aria-label="Movie suggestions and saved movies" tabIndex={-1}>{(pool !== null || tab !== 'recommendations') && <div className="tabs" role="group" aria-label="Your movies"><button aria-pressed={tab === 'recommendations'} onClick={() => setTab('recommendations')}>Suggestions</button><button aria-pressed={tab === 'saved'} onClick={() => setTab('saved')}>Saved movies ({library.saved.length})</button>{tab === 'history' && <button aria-pressed>Seen & hidden</button>}</div>}<div className="notice" role="status">{notice}{undoMovie && <button className="text-button" onClick={() => undoFeedback(undoMovie)}>Undo</button>}</div>
    {loading && <div className="loading-results" role="status"><p>Finding movies you can watch in India...</p><div className="movie-grid" aria-hidden="true">{[1,2,3].map(id => <div className="skeleton-card" key={id}><div/><span/><span/></div>)}</div></div>}
    {tab === 'recommendations' ? <>{!loading && pool !== null ? <><div className="section-top"><div><h2>{shortlist.length === 1 ? 'A movie for you.' : 'Your next movie could be here.'}</h2><p className="field-note">Where to watch in {countries[resultRegion as keyof typeof countries]}.</p></div>{shortlist.length > 0 && <div className="result-actions"><button className="small-button" disabled={loading} onClick={pick}>Choose one for me</button><button className="small-button" disabled={loading} onClick={() => void discover(true)}>{loading ? 'Looking...' : 'Show different movies'}</button></div>}</div>{winner && shortlist.some(m => m.id === winner) && <p className="pick-announcement" role="status">Try <strong>{shortlist.find(m => m.id === winner)?.title}</strong> tonight.</p>}{shortlist.length ? <div className="movie-grid">{shortlist.map(m => card(m))}</div> : <div className="empty-state"><h3>Let us try something a little different.</h3><p>We could not find a movie with these choices. Try removing the time, streaming-app, or age-rating limits. We will keep your language.</p><button className="small-button" disabled={loading} onClick={broadenSearch}>Keep my language, widen the search</button><button className="small-button" disabled={loading} onClick={() => void discover(true)}>Try more movies</button><button className="small-button" onClick={() => {setOptionsOpen(true);document.querySelector('.picker')?.scrollIntoView({behavior:'smooth'});}}>Change my choices</button></div>}</> : <p className="getting-started">{loading ? 'This can take a few seconds.' : 'A movie for your mood is one click away.'}</p>}</> : tab === 'saved' ? <><div className="section-top"><div><h2>Saved for another night.</h2></div></div>{library.saved.length ? <div className="movie-grid">{library.saved.map(m => card(m))}</div> : <div className="empty-state">See something you like? Tap Save on a movie and find it here later.</div>}</> : <><div className="section-top"><div><h2>Seen & hidden movies.</h2><p className="field-note">Changed your mind? Tap Undo to see a movie in your suggestions again.</p></div></div>{library.seen.length+library.rejected.length ? <div className="movie-grid">{[...library.seen,...library.rejected].map(m => card(m,true))}</div> : <div className="empty-state">Movies you have seen or hidden will appear here.</div>}</>}
    {pool !== null && <p className="availability-note">Where to watch: JustWatch via TMDB. Availability and prices can change.</p>}</section>
    <details className="insights"><summary>Your saved choices & privacy</summary><label className="check-label"><input type="checkbox" checked={sharing} onChange={e => {if (e.target.checked && privacySignal()) {setNotice('Your browser privacy signal keeps usage sharing off.');return;}setSharing(e.target.checked);}}/>Help improve Moodreel by sharing basic usage (optional)</label><p>Off by default. If enabled, search outcomes, movie IDs for interactions, and estimated return visits are sent to server logs. No typed moods or persistent visitor IDs are sent. <a href="/privacy">Read our privacy information</a>.</p><p>Saved movies and choices stay in this browser. No account is needed. Clearing browser data removes them.</p><button className="small-button" onClick={() => {setTab('history');results.current?.scrollIntoView({behavior:'smooth'});}}>Seen & hidden movies ({library.seen.length+library.rejected.length})</button><details className="activity-details"><summary>Your activity</summary><p>{metrics.searches} searches | {metrics.shuffles} requests for different movies | {metrics.saves} saves | {metrics.watchClicks} watch-option clicks | {metrics.picks} movies chosen for you. {chosen.length} chosen movies. These local counts stay in this browser; usage sharing is separate.</p></details><button className="text-button" onClick={clearData}>Clear my saved movies and choices</button></details>
    {report && <Feedback movieId={report.movieId} onClose={() => setReport(null)}/>}
    <footer><a className="brand" href="/">moodreel.</a><p>Made for a good movie night.</p><div><button className="text-button" onClick={() => setReport({})}>Feedback & help</button><a href="/privacy">Privacy & credits</a><a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer"><img src="/tmdb.svg" width="100" height="13" alt="TMDB movie information"/></a><a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">Where to watch: JustWatch</a></div><small>This product uses the TMDB API but is not endorsed or certified by TMDB.</small></footer>
  </main>;
}


