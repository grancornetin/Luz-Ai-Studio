import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WandSparkles } from 'lucide-react';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onAutoFormat?: () => void;
  placeholder?: string;
}

const MAX_HEIGHT = 260;

const SLOT_SUGGESTIONS = [
  'person1', 'person2', 'person3', 'person4',
  'outfit1', 'outfit2', 'outfit3', 'outfit4',
  'product1', 'product2', 'product3', 'product4',
  'scene1',
];

const PromptInput: React.FC<PromptInputProps> = ({ value, onChange, onAutoFormat, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef   = useRef<HTMLDivElement>(null);
  const [showMenu,   setShowMenu]   = useState(false);
  const [filtered,   setFiltered]   = useState<string[]>([]);
  const [cursorPos,  setCursorPos]  = useState(0);
  const [isFocused,  setIsFocused]  = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  // Sync mirror scroll with textarea scroll
  const syncScroll = useCallback(() => {
    if (textareaRef.current && mirrorRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const handleChange = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    setCursorPos(pos);
    onChange(text);
    const beforeCursor = text.slice(0, pos);
    const match = beforeCursor.match(/@(\w*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      setFiltered(SLOT_SUGGESTIONS.filter(s => s.toLowerCase().startsWith(query)));
      setShowMenu(true);
    } else {
      setShowMenu(false);
    }
  };

  const insertSuggestion = (suggestion: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const before = value.slice(0, cursorPos).replace(/@\w*$/, `@${suggestion}`);
    onChange(before + value.slice(cursorPos));
    setShowMenu(false);
    setTimeout(() => el.focus(), 0);
  };

  // Render text with @token highlights as HTML for the mirror layer
  const renderHighlighted = (text: string) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(@\w+)/g, '<mark style="background:transparent;color:var(--brand-600,#FF748B);font-weight:600;">$1</mark>')
      .replace(/\n/g, '<br>');
  };

  const tokenCount = (value.match(/@\w+/g) || []).length;

  return (
    <div className="relative">
      <div
        className={`relative rounded-3xl border-2 transition-all duration-200 overflow-hidden ${
          isFocused
            ? 'border-brand-400 shadow-[0_0_0_4px_rgba(255,116,139,0.12)] bg-white'
            : 'border-slate-100 bg-slate-50'
        }`}
      >
        {/* Real textarea — text is transparent so the mirror layer paints it */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => { setIsFocused(false); setShowMenu(false); }}
          onScroll={syncScroll}
          placeholder={placeholder || 'Escribe tu visión. Usa @ para invocar referencias, o aplica una plantilla arriba para empezar.'}
          className="relative w-full bg-transparent outline-none resize-none font-medium placeholder:text-slate-400 placeholder:font-normal"
          style={{
            padding: '24px 24px 64px',
            fontSize: 14,
            lineHeight: 1.625,
            minHeight: 140,
            maxHeight: MAX_HEIGHT,
            caretColor: 'var(--brand-600, #FF748B)',
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
            position: 'relative',
            zIndex: 2,
          }}
        />

        {/* Mirror layer — behind textarea, paints text + highlights @tokens */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none select-none overflow-hidden"
          style={{
            padding: '24px 24px 64px',
            fontSize: 14,
            lineHeight: 1.625,
            fontFamily: 'inherit',
            fontWeight: 500,
            color: '#1e293b',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            overflowY: 'scroll',
            scrollbarWidth: 'none',
            zIndex: 1,
          }}
          dangerouslySetInnerHTML={{ __html: renderHighlighted(value) || '' }}
        />

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white/80 backdrop-blur-sm" style={{ zIndex: 3 }}>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {value.length} car.
            </span>
            {tokenCount > 0 && (
              <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">
                · {tokenCount} token{tokenCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {value.trim() && onAutoFormat && (
            <button
              type="button"
              onClick={onAutoFormat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 bg-white border border-slate-100 hover:border-brand-200 rounded-full shadow-sm transition-all active:scale-95"
            >
              <WandSparkles className="w-3 h-3" />
              Auto-format
            </button>
          )}
        </div>
      </div>

      {/* @mention dropdown */}
      {showMenu && filtered.length > 0 && (
        <div className="absolute left-4 z-30 mt-1 bg-white border border-slate-200 shadow-xl rounded-2xl p-2 min-w-[160px]">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertSuggestion(s); }}
              className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-700 rounded-xl transition-colors"
            >
              @{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PromptInput;
