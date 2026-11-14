import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { createCollaborationServer } from './collaboration.js';

test('Compte, contrôle du code, propriétaire, fusion simultanée et persistance', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'campus-collab-'));
  const dataFile = join(directory, 'data.json');
  let instance = createCollaborationServer({ dataFile });
  const clients = [];
  async function start() {
    instance.server.listen(0, '127.0.0.1');
    await once(instance.server, 'listening');
    return `http://127.0.0.1:${instance.server.address().port}`;
  }
  let base = await start();
  async function request(path, cookie, body) {
    return fetch(base + '/api' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function closeServer() {
    for (const ws of clients) ws.terminate();
    instance.wss.close();
    await new Promise((resolve) => instance.server.close(resolve));
  }
  try {
    const registered = await request('/auth/register', null, { name: 'Owner', email: 'owner@example.com', password: 'password123' });
    assert.equal(registered.status, 200);
    const ownerCookie = registered.headers.get('set-cookie').split(';')[0];
    const initial = new Y.Doc();
    initial.getText('test').insert(0, 'Bonjour');
    const created = await request('/shared-notes', ownerCookie, { title: 'Test secret', code: '01234567', state: Buffer.from(Y.encodeStateAsUpdate(initial)).toString('base64') });
    assert.equal(created.status, 201);
    const { id } = await created.json();
    const locked = await request(`/shared-notes/${id}`);
    assert.equal(locked.status, 403);
    assert.deepEqual(await locked.json(), { locked: true });
    const guestSession = await request('/session');
    const guestCookie = guestSession.headers.get('set-cookie').split(';')[0];
    assert.equal((await request(`/shared-notes/${id}/unlock`, guestCookie, { code: '99999999' })).status, 403);
    assert.equal((await request(`/shared-notes/${id}/unlock`, guestCookie, { code: '01234567' })).status, 200);
    const guestNote = await (await request(`/shared-notes/${id}`, guestCookie)).json();
    assert.equal(guestNote.owner, false);
    assert.equal(guestNote.code, undefined);
    assert.equal((await request(`/shared-notes/${id}/share`, guestCookie)).status, 403);
    assert.equal((await (await request(`/shared-notes/${id}/share`, ownerCookie)).json()).code, '01234567');
    assert.equal((await (await request(`/shared-notes/${id}`, ownerCookie)).json()).owner, true);
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(base.replace('http', 'ws') + `/api/live/${id}`);
      ws.on('open', () => reject(new Error('Accès non autorisé accepté')));
      ws.on('unexpected-response', (req, res) => { assert.equal(res.statusCode, 403); ws.terminate(); resolve(); });
      ws.on('error', () => {});
    });
    async function connect(cookie) {
      const doc = new Y.Doc();
      const ws = new WebSocket(base.replace('http', 'ws') + `/api/live/${id}`, { headers: { Cookie: cookie } });
      clients.push(ws);
      await new Promise((resolve, reject) => {
        ws.on('error', reject);
        ws.on('message', (bytes, binary) => {
          if (binary) { Y.applyUpdate(doc, bytes, 'remote'); resolve(); }
        });
      });
      return { doc, ws };
    }
    const owner = await connect(ownerCookie);
    const guest = await connect(guestCookie);
    // Deux modifications indépendantes avant de recevoir celle de l’autre.
    owner.doc.getText('test').insert(0, 'A');
    guest.doc.getText('test').insert(0, 'B');
    async function sendAndWait(client) {
      const saved = new Promise((resolve) => {
        function message(bytes, binary) {
          if (!binary && JSON.parse(bytes.toString()).type === 'saved') {
            client.ws.off('message', message); resolve();
          }
        }
        client.ws.on('message', message);
      });
      client.ws.send(Y.encodeStateAsUpdate(client.doc));
      await saved;
    }
    await Promise.all([sendAndWait(owner), sendAndWait(guest)]);
    // Reconnexion : récupère l’état fusionné et sauvegardé.
    const merged = await connect(ownerCookie);
    assert.match(merged.doc.getText('test').toString(), /^(AB|BA)Bonjour$/);
    await closeServer();
    instance = createCollaborationServer({ dataFile });
    base = await start();
    const logged = await request('/auth/login', null, { email: 'owner@example.com', password: 'password123' });
    const restoredCookie = logged.headers.get('set-cookie').split(';')[0];
    const restored = await connect(restoredCookie);
    assert.match(restored.doc.getText('test').toString(), /^(AB|BA)Bonjour$/);
  } finally {
    await closeServer();
    rmSync(directory, { recursive: true, force: true });
  }
});
