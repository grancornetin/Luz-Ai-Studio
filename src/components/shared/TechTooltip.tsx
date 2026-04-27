import React from 'react';

interface TechTooltipProps {
  children: React.ReactNode;
  technical: string;
}

export const TechTooltip: React.FC<TechTooltipProps> = ({ children, technical }) => (
  <span className="group relative inline-block border-b border-dotted border-slate-300 cursor-help">
    {children}
    <span className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-medium normal-case rounded-md px-2 py-1 whitespace-nowrap z-10 pointer-events-none max-w-[200px]">
      {technical}
    </span>
  </span>
);
