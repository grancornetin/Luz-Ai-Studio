import React from 'react';
import { PROMPT_TEMPLATES } from '../services/promptTemplates';
import { PromptDNA } from '../types/promptTypes';

interface Props {
  onApply: (dna: PromptDNA) => void;
}

const PromptTemplateSelector: React.FC<Props> = ({ onApply }) => {

  return (
    <div className="space-y-4">

      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Prompt Templates
      </h3>

      <div className="grid grid-cols-2 gap-3">

        {PROMPT_TEMPLATES.map(template => (

          <button
            key={template.id}
            onClick={() => onApply(template.dna)}
            className="p-4 bg-white border border-slate-100 rounded-2xl hover:border-brand-400 hover:bg-brand-50 transition-all text-left"
          >

            <div className="text-xs font-black text-slate-800">
              {template.label}
            </div>

            <div className="text-[10px] text-slate-400 mt-1">
              {template.description}
            </div>

          </button>

        ))}

      </div>

    </div>
  );

};

export default PromptTemplateSelector;