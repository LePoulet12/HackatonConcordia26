import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';

export function editorExtensions(collaborative = false) {
  return [StarterKit.configure({
    heading: { levels: [1, 2, 3] }, link: { openOnClick: false },
    ...(collaborative ? { undoRedo: false } : {}),
  }), TaskList, TaskItem.configure({ nested: true }), Highlight];
}
