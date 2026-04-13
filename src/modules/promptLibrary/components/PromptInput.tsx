import React, { useRef, useEffect, useState } from 'react';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const MAX_HEIGHT = 260;

const suggestions = [
  "person1",
  "person2",
  "person3",
  "person4",
  "product1",
  "product2",
  "product3",
  "product4"
];

const PromptInput: React.FC<PromptInputProps> = ({ value, onChange, placeholder }) => {

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [cursorPos, setCursorPos] = useState(0);

  useEffect(() => {

    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;

    textarea.style.overflowY =
      textarea.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";

  }, [value]);

  const handleChange = (text: string) => {

    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    setCursorPos(pos);

    onChange(text);

    const beforeCursor = text.slice(0, pos);
    const match = beforeCursor.match(/@(\w*)$/);

    if (match) {

      const query = match[1].toLowerCase();

      const results = suggestions.filter(s =>
        s.toLowerCase().startsWith(query)
      );

      setFiltered(results);
      setShowMenu(true);

    } else {

      setShowMenu(false);

    }

  };

  const insertSuggestion = (suggestion: string) => {

    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = value;

    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);

    const newBefore = before.replace(/@\w*$/, `@${suggestion}`);

    const newText = newBefore + after;

    onChange(newText);

    setShowMenu(false);

    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  return (

    <div className="relative group">

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder || "Escribe tu prompt aquí... usa @ para sugerencias"}
        className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 text-slate-700 font-medium focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none min-h-[140px] resize-none leading-relaxed"
        style={{ maxHeight: `${MAX_HEIGHT}px` }}
      />

      {showMenu && filtered.length > 0 && (

        <div className="absolute left-6 bottom-16 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-20">

          {filtered.map(s => (

            <div
              key={s}
              onClick={() => insertSuggestion(s)}
              className="px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-brand-50 rounded-lg cursor-pointer"
            >
              @{s}
            </div>

          ))}

        </div>

      )}

      <div className="absolute bottom-4 right-6 flex items-center gap-2 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity">

        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          DNA Analysis Active
        </span>

        <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse"></div>

      </div>

    </div>
  );
};

export default PromptInput;