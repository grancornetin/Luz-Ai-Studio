import React from 'react';
import { X } from 'lucide-react';
export function AreaSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[950] bg-slate-950/40 sm:flex sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}><div className="h-full overflow-y-auto bg-white p-5 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:rounded-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100"><X/></button></div>{children}</div></div>;
}
