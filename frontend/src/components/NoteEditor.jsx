import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Collaboration from '@tiptap/extension-collaboration';
import { editorExtensions } from './editorExtensions';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Undo2,
  Redo2,
  Check,
  ListTodo,
  Code,
  SquareCode,
  Highlighter,
} from "lucide-react";

export default function NoteEditor({ note, onChange, saveError, collaborationDoc, syncStatus }) {
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [...editorExtensions(Boolean(collaborationDoc)), ...(collaborationDoc ? [Collaboration.configure({ document: collaborationDoc })] : [])],
    ...(!collaborationDoc ? { content: note.content || "" } : {}),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: "note-content",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Contenu de la note",
      },
    },
    onUpdate: ({ editor: current }) => onChange?.(note.id, current.getJSON()),
  });

  if (!editor) return null;

  function editLink() {
    const value = window.prompt(
      "Adresse du lien (vide pour supprimer)",
      editor.getAttributes("link").href || "https://",
    );
    if (value === null) return;
    if (!value.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkError("");
      return;
    }
    try {
      const url = new URL(value.trim());
      if (!["https:", "http:", "mailto:"].includes(url.protocol))
        throw new Error();
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url.href })
        .run();
      setLinkError("");
    } catch {
      setLinkError("Saisissez un lien http, https ou mailto valide.");
    }
  }

  const tools = [
    ["Gras", Bold, "bold", () => editor.chain().focus().toggleBold().run()],
    [
      "Italique",
      Italic,
      "italic",
      () => editor.chain().focus().toggleItalic().run(),
    ],
    [
      "Souligné",
      Underline,
      "underline",
      () => editor.chain().focus().toggleUnderline().run(),
    ],
    [
      "Liste à puces",
      List,
      "bulletList",
      () => editor.chain().focus().toggleBulletList().run(),
    ],
    [
      "Liste numérotée",
      ListOrdered,
      "orderedList",
      () => editor.chain().focus().toggleOrderedList().run(),
    ],
    [
      "Liste de tâches",
      ListTodo,
      "taskList",
      () => editor.chain().focus().toggleTaskList().run(),
    ],
    ["Code", Code, "code", () => editor.chain().focus().toggleCode().run()],
    [
      "Bloc de code",
      SquareCode,
      "codeBlock",
      () => editor.chain().focus().toggleCodeBlock().run(),
    ],
    [
      "Surligner",
      Highlighter,
      "highlight",
      () => editor.chain().focus().toggleHighlight().run(),
    ],
    ["Lien", Link, "link", editLink],
  ];

  return (
    <>
      <header className="editor-heading">
        <h2>{note.title}</h2>
        <p
          className={`editor-save-status ${saveError ? "save-failed" : ""}`}
          role="status"
        >
          {!saveError && (!syncStatus || syncStatus === 'Toutes les modifications enregistrées') && <Check size={17} aria-hidden="true" />}
          {syncStatus || (saveError
            ? "Modifications non sauvegardées"
            : "Toutes les modifications enregistrées")}
        </p>
      </header>
      <div
        className="editor-toolbar"
        role="group"
        aria-label="Mise en forme du document"
      >
        <label>
          <span className="notes-sr-only">Style du paragraphe</span>
          <select
            value={
              editor.isActive("heading")
                ? String(editor.getAttributes("heading").level)
                : "paragraph"
            }
            onChange={(event) => {
              const value = event.target.value;
              if (value === "paragraph")
                editor.chain().focus().setParagraph().run();
              else
                editor
                  .chain()
                  .focus()
                  .setHeading({ level: Number(value) })
                  .run();
            }}
          >
            <option value="paragraph">Texte normal</option>
            <option value="1">Titre 1</option>
            <option value="2">Titre 2</option>
            <option value="3">Titre 3</option>
          </select>
        </label>
        {tools.map(([label, Icon, name, action]) => (
          <button
            key={name}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={editor.isActive(name)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={action}
          >
            <Icon size={19} aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          title="Annuler"
          aria-label="Annuler la modification"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Rétablir"
          aria-label="Rétablir la modification"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={19} aria-hidden="true" />
        </button>
      </div>
      {linkError && <p role="alert">{linkError}</p>}
      <EditorContent editor={editor} />
      {editor.isEmpty && (
        <p className="editor-hint">Écrivez dans le document pour commencer.</p>
      )}
    </>
  );
}
