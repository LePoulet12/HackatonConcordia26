import { useEffect, useRef, useState } from 'react';
import { LockKeyhole, Share2, X } from 'lucide-react';
import { api, generateCode, initialSharedState } from './sharing';
import NoteEditor from './NoteEditor';
import LiveNote from './LiveNote';

function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className="notes-modal" onCancel={onClose} aria-label={title}>
    <div className="modal-heading"><h2>{title}</h2><button type="button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}

export default function NoteWorkspace({ note, onChange, saveError, onPublish, onAccountChange }) {
  const linkId = new URLSearchParams(location.search).get('note');
  const sharedId = linkId || note?.sharedId;
  const [user, setUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [remote, setRemote] = useState(null);
  const [locked, setLocked] = useState(false);
  const [auth, setAuth] = useState(false);
  const [register, setRegister] = useState(false);
  const [share, setShare] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api('/session').then(({ user: current }) => {
      if (!cancelled) { setUser(current); setSessionReady(true); onAccountChange?.(current); }
    }).catch(() => { if (!cancelled) setSessionReady(true); });
    return () => { cancelled = true; };
  }, [onAccountChange]);
  useEffect(() => {
    if (!sharedId || !sessionReady) return;
    let cancelled = false;
    api(`/shared-notes/${sharedId}`).then((data) => {
      if (!cancelled) { setRemote(data); setLocked(false); setError(''); }
    }).catch((failure) => {
      if (!cancelled) {
        setRemote(null);
        setLocked(failure.status === 403);
        setError(failure.status === 403 ? '' : failure.message);
      }
    });
    return () => { cancelled = true; };
  }, [sharedId, sessionReady, sessionVersion]);

  async function authenticate(event) {
    event.preventDefault();
    setBusy(true); setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(fields) });
      setUser(result.user); onAccountChange?.(result.user); setAuth(false); setSessionVersion((value) => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function unlock(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api(`/shared-notes/${sharedId}/unlock`, { method: 'POST', body: JSON.stringify({ code }) });
      setCode(''); setSessionVersion((value) => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function showShare() {
    if (!user) { setError(''); setAuth(true); return; }
    setBusy(true); setError(''); setCopied(false);
    try {
      let id = sharedId;
      if (!id) {
        const result = await api('/shared-notes', { method: 'POST', body: JSON.stringify({ title: note.title, code: note.shareCode || generateCode(), state: initialSharedState(note.content) }) });
        id = result.id;
        onPublish(note.id, id);
      }
      const result = await api(`/shared-notes/${id}/share`);
      const url = new URL(location.href);
      url.search = ''; url.searchParams.set('note', id); url.hash = '#notes';
      setShare({ code: result.code, url: url.href });
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    try {
      await api('/logout', { method: 'POST' });
      setUser(null); setRemote(null); setSessionVersion((value) => value + 1);
    } catch (failure) { setError(failure.message); }
  }

  return <>
    <div className="workspace-account">
      {user ? <><span>{user.name}</span><button type="button" onClick={logout}>Déconnexion</button></> : <button type="button" onClick={() => { setError(''); setAuth(true); }}>Se connecter</button>}
      {!sharedId && note && <button className="share-button" type="button" disabled={busy} onClick={showShare}><Share2 size={17} /> Partager</button>}
      {linkId && <a href="/">Mes notes</a>}
    </div>
    {error && !auth && !locked && <p role="alert">{error}</p>}
    {sharedId ? (
      remote?.id === sharedId ? <LiveNote key={`${sharedId}:${sessionVersion}`} note={remote} onShare={showShare} /> : <div className="locked-document-preview" aria-hidden="true"><div /><div /><div /><div /></div>
    ) : note ? <NoteEditor key={note.id} note={note} onChange={onChange} saveError={saveError} /> : <p className="editor-empty">Sélectionnez une note ou créez-en une pour commencer à écrire.</p>}
    {locked && !auth && <Modal title="Note protégée" onClose={() => { location.href = '/'; }}>
      <form className="note-unlock-card" onSubmit={unlock} aria-labelledby="unlock-title">
        <LockKeyhole size={32} aria-hidden="true" />
        <h2 id="unlock-title">Cette note est protégée</h2>
        <p>Entrez le code à 8 chiffres fourni par le propriétaire pour ouvrir la note et écrire ensemble.</p>
        <label htmlFor="note-access-code">Code de la note</label>
        <input id="note-access-code" type="password" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} autoComplete="off" required autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
        {error && <p role="alert">{error}</p>}
        <button className="new-note-button" type="submit" disabled={busy || code.length !== 8}>{busy ? 'Vérification…' : 'Ouvrir la note'}</button>
        <button type="button" onClick={() => { setError(''); setAuth(true); }}>Je suis le propriétaire — me connecter</button>
        <a href="/">Retour à mes notes</a>
      </form>
    </Modal>}
    {auth && <Modal title={register ? 'Créer un compte' : 'Connexion'} onClose={() => setAuth(false)}>
      <form className="notes-dialog-form" onSubmit={authenticate}>
        {register && <label>Nom<input name="name" required maxLength={80} autoComplete="name" /></label>}
        <label>Courriel<input name="email" type="email" required autoComplete="email" /></label>
        <label>Mot de passe<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} /></label>
        {error && <p role="alert">{error}</p>}
        <button className="new-note-button" type="submit" disabled={busy}>{busy ? 'Patientez…' : register ? 'Créer mon compte' : 'Me connecter'}</button>
        <button type="button" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'J’ai déjà un compte' : 'Créer un compte'}</button>
      </form>
    </Modal>}
    {share && <Modal title="Partager la note" onClose={() => setShare(null)}>
      <div className="notes-dialog-form">
        <p>Envoyez ce lien et le code aux personnes avec qui vous voulez écrire.</p>
        <label>Lien de partage<input readOnly value={share.url} onFocus={(event) => event.target.select()} /></label>
        <label>Code à 8 chiffres<output className="share-code">{share.code}</output></label>
        <button className="new-note-button" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(`${share.url}\nCode : ${share.code}`); setCopied(true); }
          catch { setError('Copie automatique indisponible. Sélectionnez le lien pour le copier.'); }
        }}>{copied ? 'Lien et code copiés' : 'Copier le lien et le code'}</button>
        {error && <p role="alert">{error}</p>}
      </div>
    </Modal>}
  </>;
}
