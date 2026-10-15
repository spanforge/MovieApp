'use client';
import { useEffect, useRef, useState } from 'react';
export default function Feedback({ movieId, onClose }: { movieId?: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category,setCategory] = useState(movieId ? 'availability' : 'suggestion');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [reference,setReference] = useState('');
  useEffect(() => {dialog.current?.showModal();},[]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category,message,movieId}),signal:AbortSignal.timeout(15000)});
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setReference(data.reference);
    } catch(error) {setError(error instanceof Error ? error.message : 'Please try again.');}
    finally {setBusy(false);}
  }
  return <dialog ref={dialog} aria-labelledby="feedback-title" onCancel={onClose} onClose={onClose} className="feedback-dialog"><div className="dialog-header"><h2 id="feedback-title">Help us make movie night better</h2><button className="small-button" aria-label="Close feedback" onClick={() => dialog.current?.close()}>Close</button></div>{reference ? <div role="status"><p>Thanks! Your feedback was submitted.</p><p className="field-note">Reference: {reference}. This form does not collect your contact details, so we cannot send a personal reply.</p></div> : <form onSubmit={submit}><label htmlFor="feedback-category">What would you like to tell us?</label><select id="feedback-category" value={category} onChange={e => setCategory(e.target.value)}><option value="suggestion">An idea or suggestion</option><option value="bug">Something is not working</option><option value="availability">A movie is not on the listed app</option><option value="recommendation">A recommendation did not fit</option></select>{movieId && <p className="field-note">About movie #{movieId}</p>}<label htmlFor="feedback-message">Your message</label><textarea id="feedback-message" required minLength={5} maxLength={1000} rows={5} value={message} onChange={e => setMessage(e.target.value)} aria-describedby="feedback-privacy"/><p id="feedback-privacy" className="field-note">Please do not include passwords, email addresses, or other private information. Your message is sent to our server logs for review.</p>{error && <p className="error" role="alert">{error}</p>}<button className="discover" disabled={busy} type="submit">{busy ? 'Sending...' : 'Send feedback'}</button></form>}</dialog>;
}
