import React, { useState } from 'react';

const TAGS = [
  'pose plana', 'locomoción falsa', 'pose editorial', 'HPI desaprovechado', 'gesto contaminó pose',
  'identidad incorrecta', 'cuerpo incorrecto', 'outfit incorrecto', 'producto incorrecto',
  'mecanismo de captura incorrecto', 'encuadre repetido', 'escena poco creíble', 'iluminación poco creíble',
  'flash excesivo', 'piel blanqueada', 'bokeh profesional', 'demasiado comercial', 'demasiado perfecto',
  'anatomía/IA', 'prompt correcto, generador no obedeció', 'buen momento narrativo', 'publicación creíble'
];

const EvaluationPanel: React.FC<{
  onSubmit: (data: { status: string; score: number; notes: string; tags: string[] }) => Promise<unknown>;
}> = ({ onSubmit }) => {
  const [status, setStatus] = useState('partial');
  const [score, setScore] = useState(3);
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const tags = customTag ? [...selectedTags, customTag] : selectedTags;
      await onSubmit({ status, score, notes, tags });
      setNotes(''); setSelectedTags([]); setCustomTag('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {['approved', 'partial', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-2 py-1 rounded border ${status === s ? 'bg-slate-900 text-white' : 'bg-white'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Puntuación (1-5)</label>
        <input type="range" min={1} max={5} value={score} onChange={e => setScore(Number(e.target.value))} />
        <span className="ml-2 text-sm">{score}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`text-xs px-2 py-0.5 rounded-full border ${selectedTags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-white'}`}
          >
            {tag}
          </button>
        ))}
      </div>
      <input
        className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
        placeholder="Etiqueta personalizada"
        value={customTag}
        onChange={e => setCustomTag(e.target.value)}
      />
      <textarea
        className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
        rows={3}
        placeholder="Notas libres"
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      <button onClick={handleSubmit} disabled={busy} className="text-sm px-3 py-1.5 bg-slate-900 text-white rounded disabled:opacity-40">
        Guardar evaluación
      </button>
    </div>
  );
};

export default EvaluationPanel;
