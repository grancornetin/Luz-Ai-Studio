import React, { useState } from 'react';
import LegalPageHeader from '../components/shared/LegalPageHeader';

const CONTACT_EMAIL = 'grancornetin@gmail.com';

const TIPOS = [
  { value: 'bug',     label: '🐛 Error o falla técnica' },
  { value: 'billing', label: '💳 Suscripción o pago' },
  { value: 'credits', label: '⚡ Problema con créditos' },
  { value: 'content', label: '🎨 Problema con generación de imágenes' },
  { value: 'account', label: '👤 Problema con mi cuenta' },
  { value: 'other',   label: '💬 Otra consulta' },
];

const Contacto: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', type: 'bug', message: '' });

  const handleMailto = (e: React.FormEvent) => {
    e.preventDefault();
    const tipo   = TIPOS.find(t => t.value === form.type)?.label || form.type;
    const asunto = encodeURIComponent(`LUZ IA — ${tipo} — ${form.name}`);
    const cuerpo = encodeURIComponent(
      `Nombre: ${form.name}\nCorreo de respuesta: ${form.email}\nTipo: ${tipo}\n\nMensaje:\n${form.message}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${asunto}&body=${cuerpo}`;
  };

  return (
    <div className="min-h-screen bg-white animate-in fade-in duration-500">
    <LegalPageHeader />
    <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">

      <header className="space-y-3">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
          <i className="fa-solid fa-envelope text-white text-lg"></i>
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
          Contacto y Soporte
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          ¿Tienes un error, consulta sobre tu suscripción o necesitas ayuda?
          Completa el formulario — se abrirá tu app de correo con todo pre-llenado.
        </p>
      </header>

      <form onSubmit={handleMailto} className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm space-y-5">

        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Nombre</label>
          <input
            type="text" required placeholder="Tu nombre"
            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            autoComplete="name" autoCapitalize="words"
            className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all text-base md:text-sm font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Tu correo (para responderte)</label>
          <input
            type="email" required placeholder="tu@email.com"
            value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            autoComplete="email" inputMode="email" autoCapitalize="none"
            className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all text-base md:text-sm font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Tipo de consulta</label>
          <select
            value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all text-base md:text-sm font-medium"
          >
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Mensaje</label>
          <textarea
            required rows={5} placeholder="Describe tu consulta con el mayor detalle posible..."
            value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
            className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all text-base md:text-sm font-medium resize-none"
          />
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-blue-700 flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-0.5 flex-shrink-0"></i>
            Al hacer click en "Enviar", se abrirá tu app de correo con el mensaje pre-llenado.
          </p>
        </div>

        <button
          type="submit"
          className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-paper-plane"></i>
          Preparar correo
        </button>

        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          O escríbenos directamente a{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </form>

      <div className="pt-4 border-t border-slate-100 text-center">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          © {new Date().getFullYear()} LUZ IA · Todos los derechos reservados
        </p>
      </div>
    </div>
    </div>
  );
};

export default Contacto;
