
import React from 'react';
import { PromptDNA } from '../types/promptTypes';
import { promptHelpers } from '../utils/promptHelpers';

interface PromptDNAEditorProps {
  dna: PromptDNA;
  onUpdate: (key: keyof PromptDNA, value: string) => void;
}

const PromptDNAEditor: React.FC<PromptDNAEditorProps> = ({ dna, onUpdate }) => {
  const blocks = promptHelpers.getDNABlocks(dna);

  return (
    <div className="space-y-6">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DNA Block Editor</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {blocks.map((block) => (
          <div key={block.key} className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {block.label}
            </label>
            <input
              type="text"
              value={block.value}
              onChange={(e) => onUpdate(block.key, e.target.value)}
              placeholder={`Define ${block.label.toLowerCase()}...`}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptDNAEditor;
