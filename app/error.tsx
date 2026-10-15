'use client';
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className="info-page"><h1>Something went wrong.</h1><p>Your saved movies are still on this browser. Try loading the page again.</p><button className="discover" onClick={reset}>Try again</button><a href="/">Back to movies</a></main>;}
