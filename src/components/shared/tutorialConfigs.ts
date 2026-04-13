import { TutorialStep } from './ModuleTutorial';

// ──────────────────────────────────────────
// tutorialConfigs
// Contenido de los tutoriales de cada módulo.
// Editar aquí para cambiar textos sin tocar
// los componentes de UI.
// ──────────────────────────────────────────

export const TUTORIAL_CONFIGS: Record<string, TutorialStep[]> = {

  // ── BIBLIOTECA DE MODELOS ────────────────
  avatarLibrary: [
    {
      icon: 'fa-user-astronaut',
      color: 'bg-indigo-600 text-white',
      title: 'Tu biblioteca de modelos',
      description: 'Aquí se guardan todos los modelos digitales que has creado. Cada modelo tiene un set de imágenes técnicas: vista frontal, trasera, lateral y close-up de rostro.',
      tip: 'Los modelos guardados aquí se pueden usar en todos los demás módulos como referencia de identidad.',
    },
    {
      icon: 'fa-camera',
      color: 'bg-purple-600 text-white',
      title: 'Model DNA · From Photos',
      description: 'Si tienes fotos reales de una persona, el módulo "Model DNA · Fotos" extrae su ADN biométrico digital y genera el set técnico automáticamente.',
      tip: 'Funciona mejor con 2-3 fotos de buena luz, de frente y perfil.',
    },
    {
      icon: 'fa-sliders',
      color: 'bg-violet-600 text-white',
      title: 'Model DNA · From Scratch',
      description: 'Si necesitas una identidad completamente nueva, "Model DNA · Manual" te permite configurar género, etnia, edad, complexión y personalidad para crear un avatar desde cero.',
    },
    {
      icon: 'fa-wand-magic-sparkles',
      color: 'bg-emerald-600 text-white',
      title: 'Usa tus modelos en otros módulos',
      description: 'Una vez creados, tus modelos son la base para: AI Generator (con referencias), Scene Clone, Content Studio y más.',
      tip: 'Cuantos más modelos tengas, más variedad de contenido puedes producir sin perder consistencia de identidad.',
    },
  ],

  // ── CONTENT STUDIO (UGC) ─────────────────
  contentStudio: [
    {
      icon: 'fa-mobile-screen-button',
      color: 'bg-emerald-600 text-white',
      title: '¿Qué es Content Studio?',
      description: 'Genera contenido tipo UGC (User Generated Content): fotos con estilo iPhone, luz natural y sensación auténtica. Perfecto para ads de redes sociales que no parecen publicidad.',
    },
    {
      icon: 'fa-dna',
      color: 'bg-indigo-600 text-white',
      title: 'Paso 1 — Rostro Maestro',
      description: 'Sube una foto clara del rostro de la persona que protagonizará el contenido. Esta imagen es el ADN de identidad — el modelo la usará como ancla facial en todas las generaciones.',
      tip: 'Una sola foto de buena calidad es suficiente. Mejor con fondo limpio y luz natural.',
    },
    {
      icon: 'fa-gem',
      color: 'bg-blue-600 text-white',
      title: 'Paso 2 — Referencias opcionales',
      description: 'Puedes agregar una imagen de producto, outfit o escena como referencia. Estas son opcionales — si no subes nada, la IA crea el contexto automáticamente.',
    },
    {
      icon: 'fa-sliders',
      color: 'bg-violet-600 text-white',
      title: 'Paso 3 — Enfoque y shots',
      description: 'Elige si el foco del contenido es la persona, el producto, o una combinación. Luego define cuántos shots quieres y la IA genera un set coherente de imágenes.',
      tip: 'El modo "Avatar Focus" genera poses más expresivas. "Product Focus" centra la atención en el artículo.',
    },
  ],

  // ── OUTFIT KIT ───────────────────────────
  outfitKit: [
    {
      icon: 'fa-shirt',
      color: 'bg-purple-600 text-white',
      title: '¿Qué es Outfit Kit?',
      description: 'Sube una foto con ropa y la IA detecta automáticamente cada prenda: vestido, pantalón, zapatillas, accesorios. Cada elemento queda separado visualmente.',
    },
    {
      icon: 'fa-magnifying-glass',
      color: 'bg-indigo-600 text-white',
      title: 'Paso 1 — Escaneo del outfit',
      description: 'La IA analiza la imagen y lista cada prenda con nombre, categoría y descripción visual detallada. Puedes ver los resultados antes de generar renders.',
      tip: 'Funciona mejor con fotos de cuerpo completo donde las prendas sean claramente visibles.',
    },
    {
      icon: 'fa-ghost',
      color: 'bg-slate-700 text-white',
      title: 'Paso 2 — Ghost Mannequin',
      description: 'Selecciona qué prendas quieres renderizar. La IA genera imágenes tipo "ghost mannequin": la prenda aparece llena de forma 3D, como si la llevara una persona invisible, sobre fondo blanco.',
      tip: 'Este estilo es el estándar en e-commerce. Ideal para catálogos y fichas de producto.',
    },
    {
      icon: 'fa-images',
      color: 'bg-emerald-600 text-white',
      title: 'Paso 3 — Kit final',
      description: 'Puedes generar una composición final de todas las prendas juntas, o descargar cada render por separado. Todo queda guardado en tu historial de kits.',
    },
  ],

  // ── CATÁLOGO ─────────────────────────────
  catalog: [
    {
      icon: 'fa-gem',
      color: 'bg-slate-800 text-white',
      title: '¿Qué es el Catálogo?',
      description: 'Sube fotos de tus productos y la IA los analiza, nombra y categoriza automáticamente. Luego puedes generar fotografía comercial profesional sin necesidad de sesión de fotos.',
    },
    {
      icon: 'fa-camera-retro',
      color: 'bg-indigo-600 text-white',
      title: 'Fotografía de producto IA',
      description: 'A partir de una foto simple de tu producto (incluso en fondo blanco o sobre una mesa), la IA genera imágenes con fondos, iluminación y composición profesional.',
      tip: 'Útil para marketplaces, sitios web, redes sociales y presentaciones de cliente.',
    },
    {
      icon: 'fa-folder-open',
      color: 'bg-emerald-600 text-white',
      title: 'Biblioteca de productos',
      description: 'Todos tus productos quedan guardados en el catálogo. Puedes reutilizarlos como referencia en otros módulos como AI Generator o Content Studio.',
    },
  ],

  // ── MODEL DNA · FROM PHOTOS ──────────────
  modelDnaPhotos: [
    {
      icon: 'fa-camera',
      color: 'bg-indigo-600 text-white',
      title: '¿Qué hace este módulo?',
      description: 'Crea un modelo digital a partir de fotos reales de una persona. La IA extrae el ADN biométrico — proporciones faciales, tono de piel, rasgos únicos — y construye un set técnico completo.',
    },
    {
      icon: 'fa-images',
      color: 'bg-purple-600 text-white',
      title: 'Sube las fotos de referencia',
      description: 'Necesitas entre 1 y 3 fotos de la persona. Lo ideal: una de frente, una de perfil, con buena luz. Evita fotos oscuras, borrosas o con oclusiones.',
      tip: 'Más fotos no siempre es mejor. 2-3 fotos de calidad superan a 6 fotos mediocres.',
    },
    {
      icon: 'fa-dna',
      color: 'bg-indigo-600 text-white',
      title: 'El proceso de clonación',
      description: 'La IA genera primero un "Bodymaster" (vista frontal completa), luego vistas trasera y lateral, y finalmente un close-up facial de alta fidelidad. Todo el proceso tarda 1-2 minutos.',
    },
    {
      icon: 'fa-save',
      color: 'bg-emerald-600 text-white',
      title: 'Guarda y reutiliza',
      description: 'Dale un nombre al modelo y guárdalo en tu biblioteca. Desde ahí estará disponible como referencia de identidad en AI Generator, Content Studio, Scene Clone y más.',
      tip: 'Puedes regenerar el FaceMaster si el close-up no quedó a tu gusto sin repetir todo el proceso.',
    },
  ],

  // ── MODEL DNA · FROM SCRATCH ─────────────
  modelDnaManual: [
    {
      icon: 'fa-sliders',
      color: 'bg-violet-600 text-white',
      title: '¿Qué hace este módulo?',
      description: 'Crea una identidad digital completamente nueva desde cero. Configuras los parámetros de la persona (género, etnia, edad, complexión, personalidad) y la IA la genera.',
    },
    {
      icon: 'fa-person',
      color: 'bg-indigo-600 text-white',
      title: 'Configura los rasgos',
      description: 'Combina los atributos disponibles: género, rango de edad, etnia, complexión física, tipo de personalidad y expresión base. Cada combinación produce una identidad única.',
      tip: 'La personalidad y expresión afectan la pose y el gesto, no solo el rostro.',
    },
    {
      icon: 'fa-wand-magic-sparkles',
      color: 'bg-emerald-600 text-white',
      title: 'Set técnico completo',
      description: 'El módulo genera automáticamente el set de 4 vistas técnicas: frontal, trasera, lateral y close-up. El modelo lleva un bodysuit neutro para garantizar consistencia.',
    },
    {
      icon: 'fa-folder-plus',
      color: 'bg-purple-600 text-white',
      title: 'Guarda y explora variaciones',
      description: 'Guarda el modelo en tu biblioteca con un nombre descriptivo. Si quieres variaciones, simplemente ajusta los parámetros y genera otra vez.',
      tip: 'Crear varios modelos con distintas etnias y edades te da flexibilidad para campañas diversas.',
    },
  ],

  // ── SCENE CLONE ──────────────────────────
  sceneClone: [
    {
      icon: 'fa-clone',
      color: 'bg-blue-600 text-white',
      title: '¿Qué hace Scene Clone?',
      description: 'Toma una foto existente (la "escena target") y replica exactamente la composición, pose, iluminación y fondo, pero reemplazando la identidad de la persona con la que tú elijas.',
    },
    {
      icon: 'fa-image',
      color: 'bg-slate-700 text-white',
      title: 'Paso 1 — Foto target',
      description: 'Sube la foto que quieres clonar. Esta será la referencia de escena: la IA copiará fielmente el encuadre, la iluminación y el fondo.',
      tip: 'Funciona mejor con fotos de buena calidad. Evita imágenes muy oscuras o con mucho ruido.',
    },
    {
      icon: 'fa-user',
      color: 'bg-indigo-600 text-white',
      title: 'Paso 2 — Identidad nueva',
      description: 'Sube las referencias de la nueva persona: foto de rostro y foto de cuerpo. Puedes activar el modo "Segundo Sujeto" para reemplazar dos personas en la misma escena.',
    },
    {
      icon: 'fa-mobile-screen-button',
      color: 'bg-emerald-600 text-white',
      title: 'Paso 3 — Estilo de cámara',
      description: 'Elige el estilo de cámara: iPhone 1x (natural), 0.5x (gran angular) o selfie frontal. También puedes cambiar el outfit del sujeto subiendo una referencia de ropa.',
      tip: 'El modo 0.5x añade una ligera distorsión de ojo de pez realista, perfecta para contenido urbano.',
    },
  ],

  // ── AI GENERATOR (PROMPT STUDIO) ─────────
  aiGenerator: [
    {
      icon: 'fa-wand-magic-sparkles',
      color: 'bg-indigo-600 text-white',
      title: '¿Qué es AI Generator?',
      description: 'El centro de creación de la plataforma. Tiene tres modos: Standard para generación individual, Campaign para crear sets de imágenes coherentes, y Photodump para variaciones masivas rápidas.',
    },
    {
      icon: 'fa-palette',
      color: 'bg-purple-600 text-white',
      title: 'Modo Standard — Una imagen',
      description: 'Construye tu prompt con el DNA visual: persona, producto, estilo, iluminación, fondo y composición. Puedes subir referencias de persona y producto para anclar la identidad.',
      tip: 'Los slots de DNA son opcionales. Cuantos más rellenes, más control tienes sobre el resultado.',
    },
    {
      icon: 'fa-film',
      color: 'bg-blue-600 text-white',
      title: 'Modo Campaign — Set coherente',
      description: 'Define el concepto de la campaña y describe cada escena por separado. La IA genera todas las imágenes manteniendo coherencia de identidad y estilo entre ellas.',
    },
    {
      icon: 'fa-bolt',
      color: 'bg-amber-600 text-white',
      title: 'Modo Photodump — Volumen rápido',
      description: 'Genera múltiples variaciones de un mismo concepto a máxima velocidad. Ideal para crear contenido en cantidad para A/B testing o redes sociales.',
      tip: 'Photodump usa Imagen 4 Fast — el modelo más rápido y económico, perfecto para variaciones sin persona.',
    },
    {
      icon: 'fa-users',
      color: 'bg-emerald-600 text-white',
      title: 'Galería comunitaria',
      description: 'Explora los prompts publicados por la comunidad, guarda los que te gusten como base y publica los tuyos para que otros puedan inspirarse.',
    },
  ],

};
