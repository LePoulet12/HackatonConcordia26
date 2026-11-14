import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import NoteEditor from './NoteEditor';

export default function LiveNote({ note, onShare }) {
  const [doc] = useState(() => new Y.Doc());
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Connexion…');
  const [count, setCount] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer;
    let socket;
    let pending = 0;
    function connect() {
      let synced = false;
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live/${note.id}`);
      socket.binaryType = 'arraybuffer';
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const message = JSON.parse(event.data);
          if (message.type === 'presence') setCount(message.count);
          if (message.type === 'saved') {
            pending = Math.max(0, pending - 1);
            if (!pending) setStatus('Toutes les modifications enregistrées');
          }
          return;
        }
        Y.applyUpdate(doc, new Uint8Array(event.data), 'server');
        if (!synced) {
          synced = true;
          pending = 1;
          socket.send(Y.encodeStateAsUpdate(doc));
          setReady(true);
          setStatus('Synchronisation…');
        }
      };
      socket.onclose = (event) => {
        setStatus(event.code === 1008 ? 'Session expirée. Rechargez la page pour vous reconnecter.' : 'Hors ligne — reconnexion en cours, gardez cette page ouverte.');
        if (!stopped && event.code !== 1008) timer = setTimeout(connect, 2000);
      };
      socket.onerror = () => {};
    }
    const update = (bytes, origin) => {
      if (origin === 'server') return;
      if (socket?.readyState === WebSocket.OPEN) {
        pending++;
        socket.send(bytes);
        setStatus('Enregistrement…');
      } else setStatus('Hors ligne — modifications en attente, gardez cette page ouverte.');
    };
    doc.on('update', update);
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      doc.off('update', update);
      socket.onclose = null;
      socket.close();
    };
  }, [doc, note.id]);
  return <>
    <div className="live-note-actions"><span role="status">{count} en ligne</span>{note.owner && <button type="button" className="share-button" onClick={onShare}>Partager</button>}</div>
    {ready ? <NoteEditor note={note} collaborationDoc={doc} syncStatus={status} /> : <p role="status">{status}</p>}
  </>;
}
