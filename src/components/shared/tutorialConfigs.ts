import { TutorialStep } from './ModuleTutorial';

// ──────────────────────────────────────────
// tutorialConfigs
// Punto 3: sceneClone ahora menciona detección de productos/elementos
// Punto 6: textos honestos sobre integración manual de avatares
//          (no hay conexión automática — la integración es manual)
// ──────────────────────────────────────────

export const TUTORIAL_CONFIGS: Record<string, TutorialStep[]> = {

  // ── BIBLIOTECA DE MODELOS ────────────────
  avatarLibrary: [
    {
      icon: 'fa-user-astronaut',
      color: 'bg-indigo-600 text-white',
      title: 'Tu biblioteca de modelos',
      description: 'Aquí se guardan todos los modelos digitales que has creado. Cada modelo tiene un set de imágenes técnicas: vista frontal, trasera, lateral y close-up de rostro.',
    },
    {
      icon: 'fa-camera',
      color: 'bg-purple-600 text-white',
      title: 'Crear modelo desde fotos',
      description: 'Si tienes fotos reales de una persona, el módulo "Crear modelo desde fotos" extrae su identidad digital y genera el set técnico automáticamente.',
      tip: 'Funciona mejor con 2-3 fotos de buena luz, de frente y perfil.',
    },
    {
      icon: 'fa-sliders',
      color: 'bg-violet-600 text-white',
      title: 'Crear modelo desde cero',
      description: 'Si necesitas una identidad completamente nueva, "Crear modelo desde cero" te permite configurar género, etnia, edad, complexión y personalidad para diseñar un modelo propio.',
    },
    {
      // PUNTO 6 FIXED: texto honesto sobre integración manual
      icon: 'fa-arrow-up-right-from-square',
      color: 'bg-emerald-600 text-white',
      title: 'Cómo usar tus modelos en otros módulos',
      description: 'Para usar un modelo en AI Generator, Scene Clone u otros módulos: abre el modelo aquí, descarga o copia la imagen que necesitas, y súbela manualmente como referencia en el módulo destino.',
      tip: 'En AI Generator usa el slot "Persona 1". En Scene Clone usa "Foto de rostro" o "Foto de cuerpo". La conexión es manual para que tú elijas exactamente qué imagen del set usar.',
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
      tip: 'Si tienes un modelo en tu Biblioteca, abre la biblioteca, copia el close-up facial y súbelo aquí.',
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
      title: 'Paso 3 — Elige el enfoque',
      description: 'Selecciona el enfoque del contenido: Avatar (la persona es el protagonista), Producto (el artículo es el héroe visual), Outfit (la ropa domina la escena) o Escena (el lugar cuenta la historia). Cada enfoque define qué referencias son obligatorias.',
      tip: '"Avatar" genera poses expresivas y naturales. "Producto" centra la atención en el artículo con el modelo como soporte. "Outfit" destaca la ropa. "Escena" prioriza el ambiente.',
      tipColor: 'text-violet-200',
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
      title: 'Paso 2 — Render de prendas',
      description: 'Selecciona qué prendas quieres renderizar. La IA genera imágenes con la prenda en volumen 3D, como si la llevara una persona invisible, sobre fondo blanco. Estilo Ghost Mannequin.',
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
      title: 'El proceso de generación',
      description: 'La IA genera primero la vista frontal completa, luego vistas trasera y lateral, y finalmente un close-up facial de alta fidelidad. Todo el proceso tarda 1-2 minutos.',
    },
    {
      // PUNTO 6 FIXED: honesto sobre cómo reusar en otros módulos
      icon: 'fa-save',
      color: 'bg-emerald-600 text-white',
      title: 'Guarda y reutiliza manualmente',
      description: 'Dale un nombre al modelo y guárdalo en tu biblioteca. Para usarlo en otro módulo (AI Generator, Scene Clone), ve a la biblioteca, descarga la imagen que necesitas y súbela como referencia en ese módulo.',
      tip: 'Para identidad facial usa el close-up. Para identidad de cuerpo usa la vista frontal. Tú controlas qué imagen del set usar en cada contexto.',
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
  // PUNTO 3: Ahora incluye paso de detección de elementos (productos, accesorios)
  sceneClone: [
    {
      icon: 'fa-clone',
      color: 'bg-blue-600 text-white',
      title: '¿Qué hace Scene Clone?',
      description: 'Toma una foto existente (la "escena target") y replica exactamente la composición, pose, iluminación y fondo, pero reemplazando la identidad de la persona y/o los productos que elijas.',
    },
    {
      icon: 'fa-image',
      color: 'bg-slate-700 text-white',
      title: 'Paso 1 — Foto target',
      description: 'Sube la foto que quieres clonar. La IA analizará automáticamente los elementos presentes: persona, prendas, productos, accesorios y fondo.',
      tip: 'Funciona mejor con fotos de buena calidad. Evita imágenes muy oscuras o con mucho ruido.',
    },
    {
      icon: 'fa-user',
      color: 'bg-indigo-600 text-white',
      title: 'Paso 2 — Nueva identidad',
      description: 'Sube las referencias de la nueva persona: foto de rostro y foto de cuerpo. Puedes activar el modo "Segundo Sujeto" para reemplazar dos personas en la misma escena.',
      tip: 'Para usar un modelo de tu biblioteca: ábrelo en la Biblioteca, descarga el close-up facial y la vista frontal, y súbelos aquí.',
    },
    {
      // PUNTO 3: Nuevo paso — detección y reemplazo de elementos/productos
      icon: 'fa-box-open',
      color: 'bg-amber-600 text-white',
      title: 'Paso 3 — Reemplaza elementos detectados',
      description: 'La IA detecta los productos y accesorios presentes en la escena (bolsos, calzado, gadgets, etc.). Puedes subir tu propio producto para reemplazar cualquiera de los elementos detectados, igual que funciona el cambio de identidad.',
      tip: 'Sube la foto de tu producto en el slot correspondiente. La IA lo integrará respetando la iluminación y la posición del elemento original.',
    },
    {
      icon: 'fa-mobile-screen-button',
      color: 'bg-emerald-600 text-white',
      title: 'Paso 4 — Estilo de cámara y outfit',
      description: 'Elige el estilo de cámara: iPhone 1x (natural), 0.5x (gran angular) o selfie frontal. También puedes cambiar el outfit del sujeto subiendo una referencia de ropa.',
      tip: 'El modo 0.5x añade una ligera distorsión de ojo de pez realista, perfecta para contenido urbano.',
    },
  ],

  // ── CAMPAIGN MODE ────────────────────────
  campaignMode: [
    {
      icon: 'fa-megaphone',
      color: 'bg-brand-600 text-white',
      title: '¿Qué es Campaign Mode?',
      description: 'Es un director creativo de marketing dentro de la app. No genera imágenes al azar — primero entiende tu campaña (producto, objetivo, audiencia) y luego construye un set coherente de imágenes listas para publicar o usar en anuncios.',
    },
    {
      icon: 'fa-pen-to-square',
      color: 'bg-violet-600 text-white',
      title: 'Paso 1 — Define el brief',
      description: 'Primero escribí el prompt base del sujeto en el compositor de arriba (ej: "mujer sosteniendo una crema hidratante"). Después en Campaign completá: descripción del producto, tipo de campaña, objetivo y audiencia. Esto le da contexto real a la IA.',
      tip: 'Cuanto más específica sea la descripción del producto, más relevantes serán las escenas generadas.',
    },
    {
      icon: 'fa-layer-group',
      color: 'bg-blue-600 text-white',
      title: 'Paso 2 — Elige el tipo de campaña',
      description: 'Hay 4 tipos: Lanzamiento de producto (hero shot + detalle + lifestyle + CTA), Posicionamiento de marca (aspiracional + valores), Contenido para RRSS (optimizado para carrusel y stories), y E-commerce (ángulos de producto + contexto de uso).',
    },
    {
      icon: 'fa-wand-magic-sparkles',
      color: 'bg-emerald-600 text-white',
      title: 'Paso 3 — La IA actúa como directora creativa',
      description: 'Gemini analiza tu brief y genera automáticamente las escenas: define la composición, el ambiente, la luz y el ángulo de cada imagen. Vos no escribís las escenas — la IA las diseña según el tipo de campaña y audiencia.',
      tip: 'Podés generar 3, 4 o 5 imágenes por campaña. Empezá con 3 para probar el resultado antes de hacer el set completo.',
    },
    {
      icon: 'fa-copy',
      color: 'bg-slate-700 text-white',
      title: 'Paso 4 — Resultados listos para publicar',
      description: 'Cada imagen viene con: titular de anuncio listo para copiar, caption para redes sociales, y el prompt técnico que se usó (para reutilizar). Al final podés descargar todo como ZIP.',
      tip: 'Los captions y titulares los genera la IA en español y adaptados al tono de tu audiencia. Podés usarlos directamente o ajustarlos.',
    },
  ],

  // ── PHOTODUMP MODE ────────────────────────
  photodumpMode: [
    {
      icon: 'fa-images',
      color: 'bg-violet-600 text-white',
      title: '¿Qué es Photodump Mode?',
      description: 'Es un creador de sets de imágenes con narrativa visual — como el photodump de un influencer real, no fotos sueltas. Cada set cuenta una historia progresiva: apertura, desarrollo y cierre. Ideal para carruseles de Instagram.',
    },
    {
      icon: 'fa-book-open',
      color: 'bg-indigo-600 text-white',
      title: 'Paso 1 — Elegí la narrativa',
      description: 'Hay 5 tipos de historia: "Un día con el producto" (mañana a noche con el producto), "Viaje o experiencia" (llegada, exploración, cierre), "Mundo de marca" (estética y valores), "El personaje y su mundo" (lifestyle del influencer), o escribís tu propia historia.',
      tip: 'Para productos: "Un día con el producto" funciona muy bien. Para influencers: "El personaje y su mundo". Para viajes y experiencias gastronómicas: "Viaje o experiencia".',
    },
    {
      icon: 'fa-user-circle',
      color: 'bg-emerald-600 text-white',
      title: 'Paso 2 — Elegí el protagonista',
      description: 'Tres opciones: Persona / Influencer (la persona es el centro), Producto / Objeto (el producto es el héroe visual), o Persona + Producto (ambos comparten protagonismo). Esto cambia cómo la IA diseña cada escena del set.',
    },
    {
      icon: 'fa-film',
      color: 'bg-pink-600 text-white',
      title: 'Paso 3 — El arco narrativo',
      description: 'La IA construye un arco real: la primera imagen es el gancho visual (apertura), las del medio desarrollan la historia con ángulos variados (close-up, detalle, ambiental), y la última es el cierre memorable.',
      tip: 'Si subís una referencia de persona en los slots del compositor, la IA preserva la identidad facial en todo el set.',
    },
    {
      icon: 'fa-hashtag',
      color: 'bg-slate-700 text-white',
      title: 'Paso 4 — Set listo con captions',
      description: 'Cada imagen viene con su propio caption y hashtags adaptados al momento narrativo. También se muestra el orden sugerido para el carrusel. Descargás todo como ZIP.',
      tip: 'Los captions son cortos y conversacionales — están pensados para sonar naturales, no como copy de empresa.',
    },
  ],

  // ── PROYECTOS + COPILOTO ──────────────────
  projectCopilot: [
    {
      icon: 'fa-folder-open',
      color: 'bg-indigo-600 text-white',
      title: '¿Qué es un Proyecto?',
      description: 'Un proyecto es tu espacio de trabajo para una campaña, producto o idea específica. Agrupa tus imágenes de referencia, tus generaciones, tu plan de contenido y las conversaciones con el copiloto — todo en un solo lugar.',
    },
    {
      icon: 'fa-robot',
      color: 'bg-violet-600 text-white',
      title: 'El Copiloto estratégico',
      description: 'El copiloto no es un chatbot genérico — es tu directora creativa y estratega de marketing. Analizá tus imágenes, hace preguntas clave, propone planes concretos y te lleva directo al módulo correcto con todo pre-configurado.',
      tip: 'Subí una foto de tu producto en el chat. El copiloto la analiza y propone qué hacer con ella antes de que vos lo preguntes.',
    },
    {
      icon: 'fa-arrow-right',
      color: 'bg-emerald-600 text-white',
      title: 'Acciones directas con un clic',
      description: 'Cuando el copiloto propone un plan, aparecen botones de acción. Al hacer clic, te lleva al módulo correspondiente (Campaign, Photodump, UGC Studio) con toda la configuración ya cargada. Solo presionás Generar.',
      tip: 'El banner "Configurado por tu copiloto" que aparece en el módulo confirma que el preset llegó correctamente.',
    },
    {
      icon: 'fa-list-check',
      color: 'bg-amber-600 text-white',
      title: 'Plan de contenido y Calendario',
      description: 'El copiloto puede generar un plan de contenido (checklist de qué crear) y un calendario semanal. Ambos se guardan en el proyecto. Marcás cada tarea como hecha y el sistema registra tu racha de días consecutivos.',
      tip: 'Pedile al copiloto: "Crea un calendario de contenido para esta semana" y va a generar entre 5 y 7 entradas con módulo y prompt sugerido para cada día.',
    },
    {
      icon: 'fa-pen-nib',
      color: 'bg-pink-600 text-white',
      title: 'Captions y textos listos',
      description: 'Cuando ya tenés imágenes generadas, el copiloto puede crear los textos para publicar: caption para Instagram, versión para TikTok, descripción para tu tienda online y hashtags por nicho. Todo copiable con un clic.',
      tip: 'El copiloto recuerda tu proyecto entre sesiones: la próxima vez que lo abras, ya sabe de qué producto es y cuál es tu objetivo.',
    },
  ],

  // ── AI GENERATOR (PROMPT STUDIO) ─────────
  aiGenerator: [
    {
      icon: 'fa-wand-magic-sparkles',
      color: 'bg-indigo-600 text-white',
      title: '¿Qué es AI Generator?',
      description: 'El centro de creación de la plataforma. Tiene tres modos: Standard para generación individual, Campaign para crear sets de imágenes coherentes, y Photodump para un set de escenas tipo lifestyle.',
    },
    {
      icon: 'fa-palette',
      color: 'bg-purple-600 text-white',
      title: 'Modo Standard — Una imagen',
      description: 'Construye tu prompt con el DNA visual: persona, producto, estilo, iluminación, fondo y composición. Sube referencias en los slots para anclar identidad y productos.',
      tip: 'Para usar un modelo de tu Biblioteca: descárgalo desde allí y súbelo en el slot "Persona 1".',
    },
    {
      icon: 'fa-megaphone',
      color: 'bg-blue-600 text-white',
      title: 'Modo Campaign — Campaña de marketing',
      description: 'Definís el brief (producto, objetivo, audiencia) y la IA actúa como directora creativa: diseña las escenas, genera las imágenes y entrega captions y titulares de anuncio listos para copiar. Tiene su propio tutorial dentro del modo.',
      tip: 'Pulsá "¿Cómo funciona?" dentro del modo Campaign para ver el tutorial detallado.',
    },
    {
      icon: 'fa-images',
      color: 'bg-violet-600 text-white',
      title: 'Modo Photodump — Historia visual',
      description: 'Elegís una narrativa (un día con el producto, viaje, mundo de marca...) y la IA construye un set de imágenes con arco narrativo real: apertura, desarrollo y cierre. Cada imagen trae su propio caption. Tiene su propio tutorial dentro del modo.',
      tip: 'Pulsá "¿Cómo funciona?" dentro del modo Photodump para ver el tutorial detallado.',
    },
    {
      icon: 'fa-users',
      color: 'bg-emerald-600 text-white',
      title: 'Galería comunitaria',
      description: 'Explora los prompts publicados por la comunidad, guárdalos en tus tableros y publica los tuyos para inspirar a otros creadores.',
    },
  ],

};