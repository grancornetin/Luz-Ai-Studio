
import React from 'react';
import { PromptDNA } from '../types/promptTypes';
import { promptHelpers } from '../utils/promptHelpers';

interface PromptDNAAnalyzerProps {
  dna: PromptDNA;
}

const PromptDNAAnalyzer: React.FC<PromptDNAAnalyzerProps> = ({ dna }) => {
  const blocks = promptHelpers.getDNABlocks(dna).filter(b => b.value);

  if (blocks.length === 0) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prompt DNA Structure</h3>
      <div className="flex flex-wrap gap-2">
        {blocks.map((block) => (
          <div 
            key={block.key}
            className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm flex flex-col gap-1"
          >
            <span className="text-[8px] font-black text-brand-500 uppercase tracking-tighter">{block.label}</span>
            <span className="text-xs font-bold text-slate-700">{block.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptDNAAnalyzer;
