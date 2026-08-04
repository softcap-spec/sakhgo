"use client";

import dynamic from "next/dynamic";

// react-quill-new needs browser APIs — must be client-only
const ReactQuill = dynamic(
  () => import("react-quill-new").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[160px] border rounded-lg bg-muted/10 flex items-center justify-center text-muted-foreground text-sm">
        Загрузка редактора…
      </div>
    ),
  }
);

// Import styles only on client
const QuillStylesheet = dynamic(
  () => import("./quill-styles"),
  { ssr: false }
);

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  className?: string;
}

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["clean"],
];

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  return (
    <>
      <QuillStylesheet />
      <div className={className}>
        <ReactQuill
          value={value}
          onChange={(html) => {
            const div = document.createElement("div");
            div.innerHTML = html;
            onChange(html, div.textContent || "");
          }}
          placeholder={placeholder || "Опишите объявление..."}
          modules={{ toolbar: TOOLBAR_OPTIONS }}
          theme="snow"
        />
      </div>
    </>
  );
}
