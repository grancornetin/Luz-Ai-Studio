
import React from 'react';
import { PromptDNA } from '../types/promptTypes';
import { promptHelpers } from '../utils/promptHelpers';

interface PromptDNAViewerProps {
  dna: PromptDNA;
}

const PromptDNAViewer: React.FC<PromptDNAViewerProps> = ({ dna }) => {
  const blocks = promptHelpers.getDNABlocks(dna).filter(b => b.value);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {blocks.map((block) => (
        <div 
          key={block.key}
          className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 shadow-sm flex flex-col gap-1"
        >
          <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest">{block.label}</span>
          <span className="text-sm font-bold text-slate-700 leading-relaxed">{block.value}</span>
        </div>
      ))}
    </div>
  );
};

export default PromptDNAViewer;
