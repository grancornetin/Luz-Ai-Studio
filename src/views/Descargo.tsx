import React from 'react';
import LegalPageHeader from '../components/shared/LegalPageHeader';

const FECHA = '26 de marzo de 2026';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">{title}</h2>
    <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
  </div>
);

const Descargo: React.FC = () => {
  return (
    <div className="min-h-screen bg-white animate-in fade-in duration-500">
    <LegalPageHeader />
    <div className="max-w-3xl mx-auto px-5 py-12 space-y-16">

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

      <div className="pt-4 border-t border-slate-100 text-center">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          © {new Date().getFullYear()} LUZ IA · Todos los derechos reservados
        </p>
      </div>

    </div>
    </div>
  );
};

export default Descargo;