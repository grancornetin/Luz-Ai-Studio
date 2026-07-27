import React, { useState } from 'react';

interface TraceSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const TraceSection: React.FC<TraceSectionProps> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg mb-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-semibold bg-slate-50 hover:bg-slate-100"
      >
        <span>{title}</span>
        <span className="text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="p-4 text-sm">{children}</div>}
    </div>
  );
};

export default TraceSection;
