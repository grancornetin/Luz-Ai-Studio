import React from 'react';
import LegalPageHeader from '../components/shared/LegalPageHeader';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">{title}</h2>
    <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
  </div>
);

const PoliticaPrivacidad: React.FC = () => {
  const fecha = '26 de marzo de 2026';

  return (
    <div className="min-h-screen bg-white animate-in fade-in duration-500">
    <LegalPageHeader />
    <div className="max-w-3xl mx-auto px-5 py-12 space-y-10">

      {/* HEADER */}
      <header className="space-y-3 pb-8 border-b border-slate-100">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
          <i className="fa-solid fa-shield-halved text-white text-lg"></i>
        </div>
        <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
          Política de Privacidad
        </h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          LUZ IA — Última actualización: {fecha}
        </p>
      </header>

      {/* INTRO */}
      <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-100">
        En <strong>LUZ IA</strong> ("nosotros", "nuestro" o "la plataforma") nos comprometemos a proteger
        la privacidad de nuestros usuarios. Esta Política de Privacidad describe cómo recopilamos,
        usamos y protegemos tu información personal cuando utilizas nuestra plataforma de creación
        de contenido publicitario con inteligencia artificial.
      </p>

      <Section title="1. Información que recopilamos">
        <p><strong>Información de cuenta:</strong> Al registrarte, recopilamos tu nombre, dirección de
        correo electrónico y, opcionalmente, tu foto de perfil a través de Google Sign-In.</p>
        <p><strong>Información de uso:</strong> Registramos las generaciones de imágenes realizadas,
        los módulos utilizados, el historial de generaciones y el consumo de créditos.</p>
        <p><strong>Imágenes subidas:</strong> Las imágenes que subes como referencia (fotos de personas,
        productos, outfits) se procesan a través de la API de Google Gemini y no se almacenan
        permanentemente en nuestros servidores. Se procesan en tiempo real para la generación
        de contenido.</p>
        <p><strong>Información de pago:</strong> Los pagos son procesados por Lemon Squeezy, nuestro
        procesador de pagos. LUZ IA no almacena datos de tarjetas de crédito ni información
        bancaria. Consulta la política de privacidad de Lemon Squeezy para más detalles.</p>
        <p><strong>Datos técnicos:</strong> Podemos recopilar información sobre tu dispositivo,
        navegador, dirección IP y patrones de uso para mejorar el servicio.</p>
      </Section>

      <Section title="2. Cómo usamos tu información">
        <p>Usamos la información recopilada para:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Proveer y mejorar los servicios de LUZ IA</li>
          <li>Gestionar tu cuenta, créditos y suscripción</li>
          <li>Procesar las generaciones de imágenes con IA</li>
          <li>Comunicarnos contigo sobre actualizaciones y soporte</li>
          <li>Prevenir fraudes y garantizar la seguridad de la plataforma</li>
          <li>Cumplir con obligaciones legales aplicables</li>
        </ul>
      </Section>

      <Section title="3. Compartir información con terceros">
        <p>No vendemos ni alquilamos tu información personal a terceros. Compartimos datos
        únicamente con:</p>
        <p><strong>Google (Firebase y Gemini API):</strong> Para autenticación, almacenamiento de
        datos y procesamiento de imágenes. Google tiene sus propias políticas de privacidad
        disponibles en policies.google.com.</p>
        <p><strong>Lemon Squeezy:</strong> Para procesar pagos y gestionar suscripciones.
        Solo compartimos el correo electrónico y el ID de usuario necesarios para la
        transacción.</p>
        <p>En caso de requerimiento legal o judicial, podemos divulgar información a las
        autoridades competentes.</p>
      </Section>

      <Section title="4. Almacenamiento y seguridad de datos">
        <p>Tus datos se almacenan en los servidores de Google Firebase, ubicados principalmente
        en Estados Unidos. Utilizamos medidas de seguridad estándar de la industria incluyendo
        encriptación en tránsito (HTTPS) y en reposo.</p>
        <p>Tu historial de generaciones se limita a las últimas 50 imágenes. Las imágenes de
        referencia que subes no se almacenan permanentemente — se procesan y descartan.</p>
      </Section>

      <Section title="5. Tus derechos">
        <p>Tienes derecho a:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Acceder a la información personal que tenemos sobre ti</li>
          <li>Solicitar la corrección de datos incorrectos</li>
          <li>Solicitar la eliminación de tu cuenta y datos asociados</li>
          <li>Exportar tu historial de generaciones</li>
        </ul>
        <p>Para ejercer estos derechos, contáctanos en{' '}
          <a href="mailto:grancornetin@gmail.com" className="text-indigo-600 font-bold hover:underline">
            grancornetin@gmail.com
          </a>.
        </p>
      </Section>

      <Section title="6. Cookies y tecnologías de seguimiento">
        <p>LUZ IA utiliza cookies esenciales para mantener tu sesión iniciada y preferencias
        de usuario. No utilizamos cookies de publicidad o rastreo de terceros.</p>
        <p>Utilizamos Firebase Analytics para recopilar datos de uso anónimos y mejorar
        la experiencia de la plataforma.</p>
      </Section>

      <Section title="7. Menores de edad">
        <p>LUZ IA no está dirigida a menores de 18 años. No recopilamos conscientemente
        información de menores. Si eres padre/madre y crees que tu hijo ha proporcionado
        información personal, contáctanos para eliminarla.</p>
      </Section>

      <Section title="8. Cambios a esta política">
        <p>Podemos actualizar esta Política de Privacidad ocasionalmente. Te notificaremos
        de cambios significativos por correo electrónico o mediante un aviso en la plataforma.
        El uso continuado de LUZ IA después de los cambios constituye la aceptación de la
        nueva política.</p>
      </Section>

      <Section title="9. Contacto">
        <p>Si tienes preguntas o inquietudes sobre esta Política de Privacidad, contáctanos:</p>
        <p>
          <strong>LUZ IA</strong><br />
          Correo: <a href="mailto:grancornetin@gmail.com" className="text-indigo-600 font-bold hover:underline">
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
    </div>
  );
};

export default PoliticaPrivacidad;