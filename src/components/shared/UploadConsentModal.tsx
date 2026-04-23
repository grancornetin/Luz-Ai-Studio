import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

interface UploadConsentModalProps {
  onAccept: () => void;
  onCancel: () => void;
}

const UploadConsentModal: React.FC<UploadConsentModalProps> = ({ onAccept, onCancel }) => (
  <div
    className="fixed inset-0 z-[9000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5"
    onClick={onCancel}
  >
    <div
      className="bg-white rounded-[32px] max-w-md w-full shadow-2xl p-8 space-y-6 animate-in zoom-in duration-200"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">
          Responsabilidad de contenido
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Al subir imágenes, confirmas que tienes todos los derechos, permisos y
          autorizaciones necesarias sobre el contenido (incluyendo identidades,
          marcas y elementos presentes), y aceptas nuestros{' '}
          <Link to="/terminos" className="text-indigo-600 underline font-bold" target="_blank">
            Términos de uso
          </Link>{' '}
          y{' '}
          <Link to="/descargo" className="text-indigo-600 underline font-bold" target="_blank">
            Descargo de responsabilidad
          </Link>.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
          ⚠️ El uso de imágenes de personas reales sin su consentimiento puede
          constituir una violación legal. LUZ IA no se responsabiliza por el uso
          indebido del contenido generado.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={onAccept}
          className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Acepto y continúo
        </button>
      </div>
    </div>
  </div>
);

export default UploadConsentModal;
