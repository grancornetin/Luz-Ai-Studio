import React from 'react';

const UploadDisclaimer: React.FC = () => (
  <div className="flex gap-2 md:gap-2.5 px-3 md:px-4 py-2 md:py-3 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl">
    <i className="fa-solid fa-shield-halved text-slate-400 text-[10px] md:text-xs mt-0.5 flex-shrink-0"></i>
    <p className="text-[8.5px] md:text-[9px] font-medium text-slate-400 leading-snug md:leading-relaxed">
      <span className="font-black text-slate-500 uppercase tracking-wide">Contenido del usuario. </span>
      <span className="hidden md:inline">El usuario es responsable total por los derechos, permisos y uso comercial del contenido subido (incluyendo identidades, marcas y cualquier elemento presente). La app procesa únicamente el material proporcionado por el usuario.</span>
      <span className="md:hidden">Sos responsable por los derechos y uso del contenido que subís.</span>
    </p>
  </div>
);

export default UploadDisclaimer;
