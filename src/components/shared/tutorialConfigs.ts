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
      title: '¿Qué puedes crear aquí?',
      description: 'Prepara una campaña completa a partir de tu producto, objetivo y audiencia. Recibirás una serie de imágenes coherentes para publicar o usar en anuncios.',
    },
    {
      icon: 'fa-pen-to-square',
      color: 'bg-violet-600 text-white',
      title: 'Paso 1 — Cuéntanos sobre la campaña',
      description: 'Describe el producto y elige el tipo de campaña, el objetivo y la audiencia. También puedes añadir imágenes de referencia.',
      tip: 'Una descripción concreta del producto ayuda a crear escenas más relevantes.',
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
      title: 'Paso 4 — Revisa y descarga',
      description: 'Revisa las imágenes y sus textos sugeridos. Puedes copiarlos, ajustarlos y descargar el resultado completo.',
      tip: 'Antes de publicar, adapta los textos a la voz de tu marca.',
    },
  ],

  // ── PHOTODUMP MODE ────────────────────────
  photodumpMode: [
    {
      icon: 'fa-images',
      color: 'bg-violet-600 text-white',
      title: '¿Qué es una historia en fotos?',
      description: 'Es una serie de imágenes conectadas que cuenta una historia con inicio, desarrollo y cierre. Es ideal para carruseles de Instagram.',
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
      title: 'Paso 4 — Revisa el orden sugerido',
      description: 'Recibirás las imágenes en el orden recomendado para contar la historia. Revisa el resultado y descarga la serie completa.',
      tip: 'Puedes cambiar el orden antes de publicar si otra secuencia funciona mejor para tu historia.',
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

  // ── PROMPT DNA ───────────────────────────
  promptDNA: [
    {
      icon: 'fa-dna',
      color: 'bg-brand-600 text-white',
      title: '¿Qué es el Prompt DNA?',
      description: 'El DNA descompone tu prompt en partes separadas: estilo, persona, producto, luz, fondo, composición y detalles. Te permite ver de un vistazo qué dice cada parte y cambiarlo sin tener que reescribir todo el prompt.',
    },
    {
      icon: 'fa-hand-pointer',
      color: 'bg-indigo-600 text-white',
      title: 'Clic para editar cualquier bloque',
      description: 'Cada bloque de colores representa una parte del prompt. Hacé clic en cualquiera para editarlo directamente. Confirmá con Enter o cancelá con Escape. El prompt se actualiza automáticamente.',
      tip: 'Cada color tiene un significado: violeta = estilo, azul = persona, verde = producto, ámbar = luz, gris = fondo, rosa = composición, naranja = detalles.',
    },
    {
      icon: 'fa-plus',
      color: 'bg-emerald-600 text-white',
      title: 'Agregar bloques vacíos',
      description: 'Al final aparecen los bloques que el prompt no tiene todavía. Podés hacer clic en ellos para agregar esa dimensión al prompt — por ejemplo agregar una descripción de luz si el prompt no la tiene.',
    },
    {
      icon: 'fa-lightbulb',
      color: 'bg-amber-600 text-white',
      title: '¿Cuándo usar el DNA?',
      description: 'Cuando generaste una imagen que está "casi bien" pero algo no cierra. En lugar de reescribir todo, identificás qué bloque es el problema (ej: la composición) y cambiás solo eso. Mucho más rápido y preciso.',
      tip: 'El bloque "Detalles" es el más flexible — ahí van los elementos técnicos específicos. Si algo sobra, borralo directamente del bloque.',
    },
  ],

  // ── PLANTILLAS ────────────────────────────
  promptTemplates: [
    {
      icon: 'fa-layer-group',
      color: 'bg-slate-700 text-white',
      title: '¿Qué son las plantillas?',
      description: 'Las plantillas son puntos de partida profesionales para distintos tipos de fotografía. Cada plantilla trae un DNA pre-configurado con estilo, iluminación, composición y detalles listos para usar.',
    },
    {
      icon: 'fa-eye',
      color: 'bg-indigo-600 text-white',
      title: 'Previsualizá antes de aplicar',
      description: 'Al hacer clic en una plantilla se abre un modal con cada bloque del DNA visible. Podés leer qué trae la plantilla, entender si se adapta a lo que necesitás, y editarlo antes de aplicarlo.',
      tip: 'No todas las plantillas van a encajar perfectamente. El paso de preview existe para que puedas ajustar — por ejemplo cambiar "front camera perspective" por "rear camera" si querés un look diferente.',
    },
    {
      icon: 'fa-pencil',
      color: 'bg-violet-600 text-white',
      title: 'Editá lo que no aplica',
      description: 'Hacé clic en cualquier bloque del modal para editarlo. El bloque "Detalles" suele tener referencias técnicas muy específicas (como "front camera wide angle") que a veces no aplican a tu caso — simplemente borrá o cambiá lo que no querés.',
      tip: 'También podés vaciar un bloque si no lo necesitás. Por ejemplo si la plantilla tiene "portrait model" pero vos no estás incluyendo persona en el prompt.',
    },
  ],

  // ── AI GENERATOR (PROMPT STUDIO) ─────────
  aiGenerator: [
    {
      icon: 'fa-wand-magic-sparkles',
      color: 'bg-indigo-600 text-white',
      title: '¿Qué puedes crear aquí?',
      description: 'Crea una imagen a partir de una descripción. Puedes añadir fotos de personas, productos o estilos cuando necesites un resultado más específico.',
    },
    {
      icon: 'fa-palette',
      color: 'bg-purple-600 text-white',
      title: 'Describe la imagen',
      description: 'Escribe qué quieres ver e incluye detalles sobre la persona, el producto, el estilo, la luz o el fondo cuando sean importantes.',
      tip: 'Una descripción sencilla es suficiente para comenzar.',
    },
    {
      icon: 'fa-megaphone',
      color: 'bg-blue-600 text-white',
      title: 'Usa imágenes de referencia',
      description: 'Añade una foto cuando quieras conservar una persona, mostrar un producto concreto o seguir un estilo visual.',
      tip: 'Menciona en tu descripción la referencia que quieres usar.',
    },
    {
      icon: 'fa-images',
      color: 'bg-violet-600 text-white',
      title: 'Para crear una serie',
      description: 'Si necesitas varias piezas relacionadas, abre Campañas publicitarias o Historias en fotos desde el menú de creación.',
      tip: 'Cada herramienta tiene una guía breve antes de comenzar.',
    },
    {
      icon: 'fa-users',
      color: 'bg-emerald-600 text-white',
      title: 'Galería comunitaria',
      description: 'Explora los prompts publicados por la comunidad, guárdalos en tus tableros y publica los tuyos para inspirar a otros creadores.',
    },
  ],

};
