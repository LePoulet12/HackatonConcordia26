import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSchema } from '@tiptap/core';
import { prosemirrorJSONToYDoc, yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import { editorExtensions } from './editorExtensions.js';

test('Une note locale conserve son texte et ses marques lors du partage', () => {
  const content = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Texte partagé', marks: [{ type: 'bold' }, { type: 'underline' }] },
  ] }] };
  const schema = getSchema(editorExtensions());
  const doc = prosemirrorJSONToYDoc(schema, content, 'default');
  const restored = schema.nodeFromJSON(yXmlFragmentToProsemirrorJSON(doc.getXmlFragment('default')));
  assert.deepEqual(restored.toJSON(), schema.nodeFromJSON(content).toJSON());
  doc.destroy();
});
