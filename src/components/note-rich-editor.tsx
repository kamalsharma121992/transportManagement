'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Highlighter, List, ListOrdered } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { noteHtmlIsEmpty, plainTextToNoteHtml, sanitizeNoteHtml } from '@/lib/note-html';
import { cn } from '@/lib/utils';

export { noteHtmlIsEmpty, plainTextToNoteHtml, sanitizeNoteHtml } from '@/lib/note-html';

export function NoteHtmlView({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const safe = sanitizeNoteHtml(plainTextToNoteHtml(html));
  if (noteHtmlIsEmpty(safe)) {
    return <p className={cn('text-sm text-gray-400', className)}>Empty note</p>;
  }
  return (
    <div
      className={cn(
        'note-html text-sm leading-relaxed text-gray-900',
        '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4',
        '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4',
        '[&_li]:my-0.5',
        '[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_mark]:rounded-sm [&_mark]:bg-yellow-200 [&_mark]:px-0.5',
        '[&_strong]:font-semibold',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'rounded p-1 text-gray-600 hover:bg-black/5',
        active && 'bg-black/10 text-gray-900',
      )}
    >
      {children}
    </button>
  );
}

export function NoteRichEditor({
  value,
  onChange,
  placeholder = 'Write note…',
  className,
  minHeightClass = 'min-h-[100px]',
  autofocus = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
  autofocus?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
      }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: plainTextToNoteHtml(value) || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none px-2.5 py-2 outline-none',
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4',
          '[&_li]:my-0.5',
          '[&_p]:my-1',
          '[&_mark]:rounded-sm [&_mark]:bg-yellow-200 [&_mark]:px-0.5',
          minHeightClass,
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = plainTextToNoteHtml(value) || '';
    if (sanitizeNoteHtml(current) !== sanitizeNoteHtml(next) && !editor.isFocused) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (autofocus && editor) {
      editor.commands.focus('end');
    }
  }, [autofocus, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn('overflow-hidden rounded-md border border-amber-200 bg-white/80', className)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-amber-100 bg-white/60 px-1.5 py-1">
        <ToolbarButton
          title="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Highlight task"
          active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
