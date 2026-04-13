import React, { useState } from 'react';

// ──────────────────────────────────────────
// Descargo de Responsabilidad + Contacto
// Ruta: /descargo (pública, sin login)
// Contacto via mailto — sin backend ni dominio
// ──────────────────────────────────────────

const CONTACT_EMAIL = 'grancornetin@gmail.com';
const FECHA = '26 de marzo de 2026';

const TIPOS = [
  { value: 'bug',     label: '🐛 Error o falla técnica' },
  { value: 'billing', label: '💳 Suscripción o pago' },
  { value: 'credits', label: '⚡ Problema con créditos' },
  { value: 'content', label: '🎨 Problema con generación de imágenes' },
  { value: 'account', label: '👤 Problema con mi cuenta' },
  { value: 'other',   label: '💬 Otra consulta' },
];

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">{title}</h2>
    <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
  </div>
);

const Descargo: React.FC = () => {
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
    <div className="max-w-3xl mx-auto px-5 py-12 space-y-16 animate-in fade-in duration-500">

      {/* ── DESCARGO ── */}
      <div className="space-y-10">
        <header className="space-y-3 pb-8 border-b border-slate-100">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100">
            <i className="fa-solid fa-triangle-exclamation text-white text-lg"></i>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
            Descargo de Responsabilidad
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            LUZ IA — Última actualización: {FECHA}
          </p>
        </header>

        <p className="text-sm text-slate-600 leading-relaxed bg-amber-50 p-5 rounded-2xl border border-amber-100">
          Este descargo complementa los Términos de Uso de <strong>LUZ IA</strong> y establece
          de forma clara las limitaciones del servicio en relación al contenido generado
          mediante inteligencia artificial.
        </p>

        <Section title="1. Naturaleza del contenido generado por IA">
          <p>LUZ IA utiliza modelos de inteligencia artificial de Google (Gemini e Imagen 4)
          para generar imágenes y contenido visual. Por la naturaleza de estos modelos:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Los resultados pueden ser impredecibles o no reflejar exactamente las instrucciones</li>
            <li>La fidelidad de identidad facial, aunque optimizada, no se garantiza al 100%</li>
            <li>LUZ IA no garantiza que el contenido cumpla con políticas de plataformas como Instagram, TikTok o Facebook Ads</li>
            <li>Los resultados no constituyen garantía de efectividad publicitaria</li>
          </ul>
        </Section>

        <Section title="2. Uso de imágenes de personas reales">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="font-bold text-red-800">⚠️ Advertencia legal importante</p>
          </div>
          <p>Al subir fotografías de personas reales como referencia:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>El usuario asume total responsabilidad</strong> por contar con el consentimiento expreso de la persona fotografiada para su uso comercial.</li>
            <li>El uso de imágenes de <strong>celebridades, figuras públicas o cualquier persona reconocible sin consentimiento</strong> puede constituir una violación al derecho de imagen y dar lugar a acciones legales.</li>
            <li>LUZ IA no valida el consentimiento de las personas en las imágenes subidas y no será responsable por el uso indebido de sus usuarios.</li>
          </ul>
        </Section>

        <Section title="3. Contenido publicitario y regulaciones">
          <p>El usuario es responsable de:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Cumplir con las leyes de publicidad y competencia desleal de su país</li>
            <li>No crear publicidad engañosa que induzca a error a los consumidores</li>
            <li>Cumplir con las políticas publicitarias de las plataformas donde difunda el contenido</li>
          </ul>
        </Section>

        <Section title="4. Limitación de garantías">
          <p>LUZ IA se proporciona "tal cual". No garantizamos la idoneidad del contenido
          generado para un propósito comercial específico, la originalidad o ausencia de
          similitud con obras protegidas, ni el rendimiento continuo de la plataforma.</p>
        </Section>

        <Section title="5. Dependencia de servicios de terceros">
          <p>LUZ IA depende de la API de Google Gemini e Imagen 4. Cambios en las políticas
          o precios de Google pueden afectar el funcionamiento de la plataforma sin previo aviso.
          LUZ IA no controla la disponibilidad permanente de estos servicios.</p>
        </Section>
      </div>

      {/* ── FORMULARIO DE CONTACTO ── */}
      <div className="space-y-8 pt-8 border-t border-slate-100">
        <header className="space-y-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <i className="fa-solid fa-envelope text-white text-lg"></i>
          </div>
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
            Contacto y Soporte
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            ¿Tienes un error, consulta sobre tu suscripción o necesitas ayuda? Completa el
            formulario — se abrirá tu app de correo con todo pre-llenado.
          </p>
        </header>

        <form onSubmit={handleMailto} className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm space-y-5">

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Nombre</label>
            <input
              type="text" required placeholder="Tu nombre"
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              autoComplete="name"
              autoCapitalize="words"
              className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all text-base md:text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Tu correo (para responderte)</label>
            <input
              type="email" required placeholder="tu@email.com"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
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
              Al hacer click en "Enviar", se abrirá tu app de correo (Gmail, Outlook, etc.)
              con el mensaje pre-llenado. Solo tienes que enviarlo desde ahí.
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
      </div>

      {/* FOOTER */}
      <div className="pt-4 border-t border-slate-100 text-center">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          © {new Date().getFullYear()} LUZ IA · Todos los derechos reservados
        </p>
      </div>

    </div>
  );
};

export default Descargo;