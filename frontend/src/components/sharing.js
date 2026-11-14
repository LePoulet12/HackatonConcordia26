import { getSchema } from '@tiptap/core';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';
import * as Y from 'yjs';
import { editorExtensions } from './editorExtensions';

export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Le serveur de partage est indisponible.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function generateCode() {
  const bytes = new Uint32Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= 4200000000);
  return String(bytes[0] % 100000000).padStart(8, '0');
}

export function initialSharedState(content) {
  const doc = prosemirrorJSONToYDoc(getSchema(editorExtensions()), content || { type: 'doc', content: [{ type: 'paragraph' }] }, 'default');
  const bytes = Y.encodeStateAsUpdate(doc);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  doc.destroy();
  return btoa(binary);
}
