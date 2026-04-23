import React from 'react';

const UploadDisclaimer: React.FC = () => (
  <div className="flex gap-2.5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
    <i className="fa-solid fa-shield-halved text-slate-400 text-xs mt-0.5 flex-shrink-0"></i>
    <p className="text-[9px] font-medium text-slate-400 leading-relaxed">
      <span className="font-black text-slate-500 uppercase tracking-wide">Contenido del usuario. </span>
      El usuario es responsable total por los derechos, permisos y uso comercial del contenido subido (incluyendo identidades, marcas y cualquier elemento presente). La app procesa únicamente el material proporcionado por el usuario.
    </p>
  </div>
);

export default UploadDisclaimer;
