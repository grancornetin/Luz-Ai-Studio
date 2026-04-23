import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';

const LegalPageHeader: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(user ? '/' : '/');
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-[11px] font-black uppercase tracking-widest transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center">
            <i className="fa-solid fa-bolt text-white text-[10px]" />
          </div>
          <span className="text-xs font-black text-slate-700 uppercase italic tracking-tighter">LUZ IA</span>
        </div>
      </div>
    </div>
  );
};

export default LegalPageHeader;
