import React from 'react';

// ──────────────────────────────────────────
// TerminosUso
// Ruta: /terminos
// ──────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">{title}</h2>
    <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
  </div>
);

const TerminosUso: React.FC = () => {
  const fecha = '26 de marzo de 2026';

  return (
    <div className="max-w-3xl mx-auto px-5 py-12 space-y-10 animate-in fade-in duration-500">

      {/* HEADER */}
      <header className="space-y-3 pb-8 border-b border-slate-100">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
          <i className="fa-solid fa-file-contract text-white text-lg"></i>
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
          Términos de Uso
        </h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          LUZ IA — Última actualización: {fecha}
        </p>
      </header>

      {/* INTRO */}
      <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-100">
        Al acceder y utilizar <strong>LUZ IA</strong> ("la plataforma"), aceptas estos Términos de Uso
        en su totalidad. Si no estás de acuerdo con alguno de estos términos, no utilices la plataforma.
        LUZ IA es una herramienta de creación de contenido publicitario con inteligencia artificial
        dirigida a emprendedores y profesionales de marketing en Latinoamérica.
      </p>

      <Section title="1. Descripción del servicio">
        <p>LUZ IA es una plataforma SaaS (Software como Servicio) que permite a los usuarios
        generar imágenes, campañas publicitarias y contenido visual mediante inteligencia
        artificial. Los servicios incluyen, entre otros:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Generación de imágenes con modelos de IA de Google</li>
          <li>Creación de modelos digitales (avatares) a partir de fotos o parámetros</li>
          <li>Generación de campañas publicitarias y contenido UGC</li>
          <li>Extracción y renderización de prendas de vestir</li>
          <li>Fotografía de productos generada con IA</li>
        </ul>
      </Section>

      <Section title="2. Registro y cuenta de usuario">
        <p>Para acceder a LUZ IA debes crear una cuenta utilizando un correo electrónico válido
        o tu cuenta de Google. Eres responsable de mantener la confidencialidad de tus
        credenciales de acceso.</p>
        <p>Debes tener al menos 18 años para utilizar la plataforma. Al registrarte, declaras
        que la información proporcionada es veraz y actualizada.</p>
        <p>Nos reservamos el derecho de suspender o eliminar cuentas que violen estos términos.</p>
      </Section>

      <Section title="3. Sistema de créditos y suscripciones">
        <p>El acceso a las funciones de generación de imágenes requiere créditos. Los créditos
        se obtienen mediante suscripción mensual o pack inicial gratuito.</p>
        <p><strong>Plan Free:</strong> 20 créditos únicos al registrarse, no se renuevan.</p>
        <p><strong>Planes de suscripción:</strong> Los créditos se renuevan mensualmente según
        el plan contratado. Los créditos no utilizados no se acumulan al siguiente mes.</p>
        <p>Los pagos son procesados por <strong>Lemon Squeezy</strong> como merchant of record.
        Las suscripciones se renuevan automáticamente hasta que sean canceladas. Puedes
        cancelar en cualquier momento desde tu portal de cliente.</p>
        <p><strong>No realizamos reembolsos</strong> por créditos ya consumidos o por el período
        de suscripción en curso. En casos excepcionales, evaluamos solicitudes de reembolso
        a nuestra discreción.</p>
      </Section>

      <Section title="4. Uso aceptable">
        <p>Al utilizar LUZ IA, te comprometes a:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Usar la plataforma únicamente con fines legales y legítimos</li>
          <li>No generar contenido que infrinja derechos de autor o propiedad intelectual de terceros</li>
          <li>No crear contenido difamatorio, discriminatorio, violento o de carácter sexual explícito</li>
          <li>No intentar eludir las medidas de seguridad o límites de uso de la plataforma</li>
          <li>No revender, redistribuir o sublicenciar el acceso a la plataforma</li>
          <li>No utilizar la plataforma para generar contenido destinado a engañar o defraudar a terceros</li>
        </ul>
      </Section>

      <Section title="5. Contenido generado por el usuario — Responsabilidad">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="font-bold text-amber-800">⚠️ Responsabilidad del usuario sobre el contenido generado</p>
        </div>
        <p>El contenido generado en LUZ IA — incluyendo imágenes, campañas y material publicitario —
        es <strong>responsabilidad exclusiva del usuario</strong> que lo crea.</p>
        <p>En particular:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Si utilizas imágenes, rostros o likeness de personas públicas, celebridades,
          figuras políticas u otras personas reconocibles, <strong>asumes total responsabilidad legal</strong> por
          el uso de dicho contenido.</li>
          <li>El uso de imágenes de terceros sin consentimiento puede constituir una violación
          al derecho de imagen, privacidad o a las leyes de propiedad intelectual de tu país.</li>
          <li>LUZ IA no valida, monitorea ni aprueba el contenido generado por sus usuarios.</li>
          <li>LUZ IA no será responsable por demandas, reclamaciones, sanciones o daños derivados
          del uso indebido del contenido generado.</li>
        </ul>
        <p>Al utilizar la plataforma, liberas a LUZ IA de cualquier responsabilidad asociada
        al contenido que generas y te comprometes a indemnizarnos frente a cualquier reclamación
        de terceros derivada de tu uso de la plataforma.</p>
      </Section>

      <Section title="6. Propiedad intelectual">
        <p><strong>Contenido de la plataforma:</strong> El diseño, código, marca, logos y materiales
        de LUZ IA son propiedad de sus creadores y están protegidos por leyes de propiedad intelectual.</p>
        <p><strong>Contenido generado:</strong> Las imágenes generadas por los usuarios a través
        de LUZ IA pueden ser utilizadas por el usuario para los fines que estime conveniente,
        dentro de los límites legales aplicables. LUZ IA no reclama propiedad sobre el contenido
        generado por sus usuarios.</p>
        <p><strong>Modelos de IA:</strong> Las imágenes son generadas por modelos de Google
        (Gemini e Imagen 4). El uso del contenido generado está sujeto también a las políticas
        de uso aceptable de Google.</p>
      </Section>

      <Section title="7. Disponibilidad y modificaciones del servicio">
        <p>LUZ IA se esfuerza por mantener la plataforma disponible las 24 horas. Sin embargo,
        no garantizamos disponibilidad ininterrumpida. Pueden ocurrir interrupciones por
        mantenimiento, actualizaciones o factores fuera de nuestro control.</p>
        <p>Nos reservamos el derecho de modificar, suspender o discontinuar cualquier función
        de la plataforma en cualquier momento, con o sin previo aviso.</p>
        <p>Los precios de los planes pueden cambiar. Los cambios de precio serán comunicados
        con al menos 30 días de anticipación y no afectarán el período de suscripción en curso.</p>
      </Section>

      <Section title="8. Limitación de responsabilidad">
        <p>En la medida máxima permitida por la ley aplicable, LUZ IA y sus creadores no serán
        responsables por:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Daños directos, indirectos, incidentales o consecuentes derivados del uso
          o imposibilidad de uso de la plataforma</li>
          <li>La calidad, precisión o adecuación del contenido generado por IA para
          un propósito específico</li>
          <li>Pérdida de datos, créditos o contenido generado</li>
          <li>Accesos no autorizados a tu cuenta por causas ajenas a nuestra negligencia</li>
        </ul>
        <p>La responsabilidad total de LUZ IA frente a cualquier reclamación no excederá
        el monto pagado por el usuario en los 3 meses previos al evento que da origen
        a la reclamación.</p>
      </Section>

      <Section title="9. Ley aplicable y resolución de disputas">
        <p>Estos Términos se rigen por las leyes de la República de Chile. Cualquier disputa
        que no pueda resolverse amigablemente será sometida a los tribunales competentes
        de la ciudad de Santiago de Chile.</p>
      </Section>

      <Section title="10. Cambios a los términos">
        <p>Podemos actualizar estos Términos ocasionalmente. Los cambios serán publicados
        en esta página con la fecha de actualización. El uso continuado de la plataforma
        tras la publicación de cambios constituye la aceptación de los nuevos términos.</p>
      </Section>

      <Section title="11. Contacto">
        <p>Para consultas sobre estos Términos de Uso:</p>
        <p>
          <strong>LUZ IA</strong><br />
          Correo:{' '}
          <a href="mailto:grancornetin@gmail.com" className="text-indigo-600 font-bold hover:underline">
            grancornetin@gmail.com
          </a>
        </p>
      </Section>

      {/* FOOTER */}
      <div className="pt-8 border-t border-slate-100 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          © {new Date().getFullYear()} LUZ IA · Todos los derechos reservados
        </p>
      </div>

    </div>
  );
};

export default TerminosUso;