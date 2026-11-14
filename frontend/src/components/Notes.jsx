import { useCallback, useState } from "react";
import { FileText, Plus, Users } from "lucide-react";
import "./Notes.css";
import NoteWorkspace from "./NoteWorkspace";
import { api, generateCode, initialSharedState } from './sharing';

const storageKey = "campus-notes";

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.every((note) =>
      note && typeof note.id === "string" && typeof note.title === "string"
    )) return saved;
  } catch {
    return [];
  }
  return [];
}

export default function Notes() {
  const [documents, setDocuments] = useState(loadNotes);
  const [error, setError] = useState("");


  const [selectedId, setSelectedId] = useState(() => documents[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  const selectedNote = documents.find((note) => note.id === selectedId);
  const syncAccountNotes = useCallback((user) => {
    if (!user) return;
    api('/shared-notes').then((notes) => {
      setDocuments((current) => {
        const additions = notes.filter((note) => !current.some((entry) => entry.sharedId === note.id))
          .map((note) => ({ id: note.id, sharedId: note.id, title: note.title }));
        const next = [...current, ...additions];
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* La liste reste récupérable sur le serveur. */ }
        return next;
      });
      setSelectedId((current) => current || notes[0]?.id || null);
    }).catch(() => setError('Impossible de récupérer les notes du compte.'));
  }, []);

  function updateContent(id, content) {
    const nextDocuments = documents.map((note) => note.id === id
      ? { ...note, content, updatedAt: new Date().toISOString() }
      : note);
    setDocuments(nextDocuments);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextDocuments));
      setError("");
    } catch {
      setError("Sauvegarde locale impossible. Gardez cette page ouverte pour conserver vos modifications.");
    }
  }

  async function createNote(event) {
    event.preventDefault();
    if (!title.trim() || creatingNote) return;
    setCreatingNote(true);
    const note = {
      id: crypto.randomUUID(),
      title: title.trim(),
      updatedAt: new Date().toISOString(),
      shareCode: generateCode(),
    };
    const nextDocuments = [note, ...documents];
    try {
      const { user } = await api('/session');
      if (!user) {
        setError('Connectez-vous dans la carte centrale avant de créer une note : votre compte sera son propriétaire.');
        return;
      }
      const published = await api('/shared-notes', { method: 'POST', body: JSON.stringify({ title: note.title, code: note.shareCode, state: initialSharedState() }) });
      note.sharedId = published.id;
      delete note.shareCode;
      localStorage.setItem(storageKey, JSON.stringify(nextDocuments));
    } catch (failure) {
      setError(failure.message || 'Impossible de créer la note. Votre titre est conservé : réessayez.');
      return;
    } finally {
      setCreatingNote(false);
    }
    setDocuments(nextDocuments);
    setSelectedId(note.id);
    setError('');
    setTitle('');
    setCreating(false);
  }
  return (
    <main className="notes-page" aria-labelledby="notes-title">
      <header className="notes-heading">
        <h1 id="notes-title">Notes partagées</h1>
        <button
          className="new-note-button"
          type="button"
          onClick={() => setCreating(true)}
        >
          <Plus size={22} aria-hidden="true" /> Nouvelle note
        </button>
      </header>
      <div className="notes-layout">
        <section
          className="notes-card documents-card"
          aria-labelledby="documents-title"
        >
          <h2 id="documents-title">Mes documents</h2>
          {error && <p role="alert">{error}</p>}

          {!error && documents.length === 0 && <p>Aucune note pour le moment.</p>}

          {creating && (
            <form className="new-note-form" onSubmit={createNote}>
              <label htmlFor="new-note-title">Titre de la note</label>
              <input
                id="new-note-title"
                autoFocus
                required
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Nouvelle note"
              />
              <div className="new-note-actions">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setTitle("");
                  }}
                >
                  Annuler
                </button>
                <button
                  className="new-note-button"
                  type="submit"
                  disabled={!title.trim() || creatingNote}
                >
                  {creatingNote ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          )}
          <ul className="document-list" aria-label="Mes documents">
            {documents.map((document) => (
              <li key={document.id}>
                <button
                  className={`document-item ${selectedId === document.id ? "selected" : ""}`}
                  type="button"
                  aria-pressed={selectedId === document.id}
                  onClick={() => setSelectedId(document.id)}
                >
                  <FileText
                    className="document-icon"
                    size={25}
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                  <span className="document-details">
                    <strong>{document.title}</strong>
                    <span>{document.updatedAt ? `Modifié le ${new Date(document.updatedAt).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}` : document.updated}</span>
                  </span>
                  <Users
                    size={19}
                    strokeWidth={1.7}
                    aria-label="Note partagée"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section
          className="notes-card editor-card"
          aria-label="Éditeur de note"
        >
          <NoteWorkspace onAccountChange={syncAccountNotes} key={new URLSearchParams(location.search).get('note') || selectedNote?.id || 'empty'} note={selectedNote} onChange={updateContent} saveError={Boolean(error)} onPublish={(id, sharedId) => {
            const next = documents.map((note) => note.id === id ? { ...note, sharedId } : note);
            setDocuments(next);
            try { localStorage.setItem(storageKey, JSON.stringify(next)); }
            catch { setError('Le lien partagé n’a pas pu être mémorisé dans ce navigateur. Copiez-le pour le conserver.'); }
          }} />
        </section>
        <section
          className="notes-card comments-card"
          aria-labelledby="comments-title"
        >
          <h2 id="comments-title">Commentaires</h2>
        </section>
      </div>
    </main>
  );
}
