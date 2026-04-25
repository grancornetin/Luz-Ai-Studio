import React, { useState } from 'react';

const CONTACT_EMAIL = 'grancornetin@gmail.com';

const CONTACT_TYPES = [
  { value: 'bug',     label: '🐛 Error técnico' },
  { value: 'billing', label: '💳 Suscripción o pago' },
  { value: 'credits', label: '⚡ Problema con créditos' },
  { value: 'content', label: '🎨 Problema con generación' },
  { value: 'account', label: '👤 Problema con mi cuenta' },
  { value: 'other',   label: '💬 Otra consulta' },
];

const Section: React.FC<{ title: string; children: React.ReactNode; warning?: boolean }> = ({ title, children, warning = false }) => (
  <section className="space-y-3">
    <h2 className={`text-base font-black uppercase italic tracking-tight ${warning ? 'text-rose-400' : 'text-white/70'}`}>
      {title}
    </h2>
    <div className="text-sm text-white/35 leading-relaxed space-y-2.5">
      {children}
    </div>
  </section>
);

const DarkInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-white/25 uppercase tracking-[0.3em] block">{label}</label>
    <input
      {...props}
      className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/40 focus:bg-white/[0.07] rounded-2xl outline-none transition-all text-sm font-medium text-white/80 placeholder:text-white/20 touch-target"
    />
  </div>
);

const Descargo: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', type: 'bug', message: '' });

  const handleMailto = (e: React.FormEvent) => {
    e.preventDefault();
    const tipo   = CONTACT_TYPES.find(t => t.value === form.type)?.label || form.type;
    const asunto = encodeURIComponent(`LUZ IA — ${tipo} — ${form.name}`);
    const cuerpo = encodeURIComponent(`Nombre: ${form.name}\nCorreo: ${form.email}\nTipo: ${tipo}\n\n${form.message}`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${asunto}&body=${cuerpo}`;
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-2xl mx-auto px-5 md:px-8 py-12 md:py-16 pb-24 space-y-12">

        <div className="space-y-10">
          <header className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-px h-5 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
              <span className="text-2xs font-black text-white/20 uppercase tracking-[0.4em]">Documento Legal</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-xl">⚠️</div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight">Descargo de Responsabilidad</h1>
                <p className="text-xs text-white/25 font-medium mt-1">LUZ IA — Última actualización: 2025</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
          </header>

          <Section title="1. Naturaleza del contenido generado por IA">
            <p>LUZ IA utiliza modelos de inteligencia artificial de Google (Gemini e Imagen 4) para generar imágenes y contenido visual. Por la naturaleza de estos modelos:</p>
            <ul className="list-none space-y-1.5 mt-2">
              {[
                'Los resultados pueden ser impredecibles o no reflejar exactamente las instrucciones',
                'La fidelidad de identidad facial, aunque optimizada, no se garantiza al 100%',
                'LUZ IA no garantiza que el contenido cumpla con políticas de Instagram, TikTok o Facebook Ads',
                'Los resultados no constituyen garantía de efectividad publicitaria',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5">
                  <div className="w-1 h-1 rounded-full bg-amber-400/60 mt-2 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="2. Uso de imágenes de personas reales" warning>
            <div className="bg-rose-500/8 border border-rose-500/15 rounded-2xl p-4 mb-4">
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">⚠️ Advertencia legal importante</p>
            </div>
            <ul className="list-none space-y-2">
              {[
                'El usuario asume total responsabilidad por contar con el consentimiento expreso de la persona fotografiada para su uso comercial.',
                'El uso de imágenes de celebridades, figuras públicas o cualquier persona reconocible sin consentimiento puede constituir una violación al derecho de imagen y dar lugar a acciones legales.',
                'LUZ IA no valida el consentimiento de las personas en las imágenes subidas y no será responsable por el uso indebido de sus usuarios.',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5">
                  <div className="w-1 h-1 rounded-full bg-rose-400/60 mt-2 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="3. Contenido publicitario y regulaciones">
            <p>El usuario es responsable de cumplir con las leyes de publicidad de su país, no crear publicidad engañosa y cumplir con las políticas de las plataformas donde difunda el contenido generado.</p>
          </Section>

          <Section title="4. Limitación de garantías">
            <p>LUZ IA se proporciona "tal cual". No garantizamos la idoneidad del contenido generado para un propósito comercial específico, la originalidad o ausencia de similitud con obras protegidas, ni el rendimiento continuo de la plataforma.</p>
          </Section>

          <Section title="5. Dependencia de servicios de terceros">
            <p>LUZ IA depende de la API de Google Gemini e Imagen 4. Cambios en las políticas o precios de Google pueden afectar el funcionamiento de la plataforma sin previo aviso. LUZ IA no controla la disponibilidad permanente de estos servicios.</p>
          </Section>
        </div>

        <div className="h-px bg-white/[0.04]" />

        <div className="space-y-8">
          <header className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-xl">✉️</div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Contacto y Soporte</h2>
                <p className="text-xs text-white/30 mt-1">Completa el formulario — se abrirá tu app de correo con todo pre-llenado.</p>
              </div>
            </div>
          </header>

          <form onSubmit={handleMailto} className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 md:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DarkInput label="Nombre" type="text" required placeholder="Tu nombre" value={form.name} onChange={set('name')} autoComplete="name" autoCapitalize="words" />
              <DarkInput label="Tu correo (para responderte)" type="email" required placeholder="email@ejemplo.com" value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-white/25 uppercase tracking-[0.3em] block">Tipo de consulta</label>
              <select value={form.type} onChange={set('type')}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/40 rounded-2xl outline-none transition-all text-sm font-medium text-white/70 touch-target"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='rgba(255,255,255,0.2)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px', paddingRight: '40px', appearance: 'none' }}
              >
                {CONTACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-white/25 uppercase tracking-[0.3em] block">Mensaje</label>
              <textarea
                required rows={4} placeholder="Describe tu problema o consulta con el mayor detalle posible..."
                value={form.message} onChange={set('message')}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/40 focus:bg-white/[0.07] rounded-2xl outline-none transition-all text-sm text-white/70 placeholder:text-white/20 resize-none"
              />
            </div>

            <button type="submit"
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-900/40 hover:opacity-90 active:scale-[0.98] transition-all touch-target flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-envelope text-sm" />
              Abrir en mi cliente de correo
            </button>

            <p className="text-center text-[9px] text-white/15 font-medium leading-relaxed">
              Esto abrirá tu app de correo con el mensaje pre-llenado. No compartimos tu información con terceros.
            </p>
          </form>
        </div>

        <footer className="pt-8 border-t border-white/[0.04] text-center">
          <p className="text-2xs font-bold text-white/15 uppercase tracking-widest">© {new Date().getFullYear()} LUZ IA — Todos los derechos reservados</p>
        </footer>
      </div>
    </div>
  );
};

export default Descargo;
