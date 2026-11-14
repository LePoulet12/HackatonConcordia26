import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc } from "y-prosemirror";
import * as Y from "yjs";
import { editorExtensions } from "./editorExtensions";

export async function api(path, options = {}) {
  const headers = new Headers(options.headers);

  headers.set("Content-Type", "application/json");

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
      "Le serveur de partage est indisponible."
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export function generateCode() {
  const bytes = new Uint32Array(1);

  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= 4200000000);

  return String(bytes[0] % 100000000).padStart(8, "0");
}

export function initialSharedState(content) {
  const doc = prosemirrorJSONToYDoc(
    getSchema(editorExtensions()),
    content || {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    "default"
  );

  try {
    const bytes = Y.encodeStateAsUpdate(doc);

    let binary = "";

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary);
  } finally {
    doc.destroy();
  }
}