# 05 - Anuncios y video publico de joyeria (Chile)
Fecha de observacion: 2026-10-22. Investigador: frente 05.
Etiquetas: OBSERVADO / INFERIDO / HIPOTESIS. No hay metricas de rendimiento (la Ad Library no las muestra).

## 1. Lo mas importante
1. Silene tiene ~14 anuncios activos (frase exacta "Silene.cl"), 11 de ellos en video. OBSERVADO.
2. Los videos propios de Silene son cortos y de ambiente (6, 7, 12, 14, 20 s) y un video largo de 55 s. El texto es poetico (detalle, armonia, naturalidad), casi sin oferta en el video. Las ofertas van en anuncios de imagen/ficha con cupon. OBSERVADO (duracion y texto); los planos son INFERIDOS.
3. Silene complementa con anuncios de creadoras y clientas (7 s a 1:43), uno con codigo de 15%. OBSERVADO.
4. La competencia chilena de plata 925 compite con ofertas (3x2, 2x1, hasta 60%), garantia, material (vermeil vs bano), significado/causa y, en una parte grande, venta a revendedoras. OBSERVADO.
5. Para una emprendedora sin seguidores: el formato mas reproducible con IA es el video corto de producto (loop de brillo, flat lay, oferta con fotos). Lo que NO se debe generar con IA: creadoras/clientas, ASMR de empaque.

## 2. Silene (OBSERVADO)
- Instagram @silenejoyas: cuenta verificada, ~102 mil seguidores, bio con plata 925 y bano de oro, envios a todo Chile, DM/WhatsApp, link a silene.cl; destacados "Clientes"; feed con predominio de reels. Fuente: https://www.instagram.com/silenejoyas/ (WebFetch 2026-10-22, lectura resumida, cifra aproximada).
- Sitio silene.cl: plata 925 y joyas banadas 18K, colecciones (Amuletos, Petit, Zodiac, etc.), precios entre ~$11.990 y ~$58.900, descuentos de 20-32% en algunos productos, envio gratis sobre $70.000, tono de regalo con intencion, sin video en la portada. Fuente: https://silene.cl (WebFetch 2026-10-22).
- Meta Ad Library (Chile): https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=CL&q=Silene.cl&search_type=keyword_exact_phrase&media_type=all

Tabla de los 14 anuncios activos (detalle en src/data/jewelry-market/ads-observed.json):
| Tipo | Cantidad | Duracion | Mensaje |
|---|---|---|---|
| Video propio de ambiente | 6 | 6, 7, 12, 14, 20 y 55 s | Detalle, uso cotidiano, mezclar piezas, novedades; CTA "Ver mas/Comprar" |
| Video de creadora o clienta | 5 | 7 s a 1:43 | "Me encanto", haul, codigo 15% (1 caso) |
| Imagen/ficha de producto | 3 | - | Cupon de descuento; "3 razones para usar joyas" + garantia de satisfaccion; perlas atemporales |
Fechas de inicio visibles: 30 jun, 2 ago (varios), 30 ago, 15 sep, 21-23 sep y 28 sep 2026. Los anuncios de ambiente llevan desde agosto activos: INFERIDO que a la marca le siguen sirviendo (no hay datos de resultados).

## 3. Otras marcas chilenas (OBSERVADO, muestra de ~25 anuncios; no es censo)
Busqueda "joyas plata 925" dio ~1.600 anuncios activos en Chile.
- Silverice.cl: 3x2 "solo esta semana" (video 33 s), dato "+12 mil clientes", otro video 27 s con "91% se siente mas seguro" (cifra del anunciante).
- Mis Joyas: Black "hasta 60% off, +1.500 productos" (video 10 s, desde 13 oct 2026).
- Karat Joyas: educa material (oro vermeil vs bano), cuotas sin interes y envio gratis (imagen).
- Boaz Joyas: compra con causa (video 22 s); set Zodiac edicion limitada (imagen).
- Bettina Joyas: embajadora figura publica explica por que elige (32 s).
- Isabel recomienda: pulsera 13 amuletos con 2x1 (37 s).
- Beyond the Origin: ear cuffs sin perforar, resistentes a ducha (43 s).
- Revendedoras (competencia indirecta y segmento): Distribuidora de Joyas (kit de inicio y garantia de 30 dias), Joyeria Ramas (desde $50.000), mait.joyas (maletines $100-130 mil). Muchas anunciando directo a WhatsApp.
- Otros: LUI JOYAS (cadenas hombre), La Merced (artesanal, Rancagua), Cuentos de Novia (catalogo), Bendito Amor (significado), joyas_sky_ y joyas_arevalo_ (parejas con precio en el texto), Icelump (VVS, desde $129.990).
Lectura INFERIDA: una marca sin seguidores no compite en descuentos contra Mis Joyas o Silverice; lo que la distingue es significado, material explicado, o un nicho (hombre, parejas, ear cuffs, artesanal).

## 4. Estructuras de video repetidas (resumen)
Detalle completo, con plano a plano, en src/data/jewelry-market/video-structures.json (9 estructuras).
| # | Estructura | Duracion | IA imagen a video | Riesgo de infidelidad | Evidencia |
|---|---|---|---|---|---|
| 1 | Loop de brillo macro | 6-8 s | Si, un clip | Bajo-medio | OBSERVADO duraciones + INFERIDO planos |
| 2 | Me lo puse / uso cotidiano | 8-12 s | Parcial (clips de 3-4 s) | Medio-alto | OBSERVADO (12 s) + INFERIDO |
| 3 | Unboxing / packaging | 10-20 s | Parcial | Alto (manos, logos) | OBSERVADO anuncio + blog |
| 4 | ASMR empaque | 10-25 s | No, se graba | Muy alto | Blog + INFERIDO |
| 5 | 3 formas / 3 razones | 15-25 s | Parcial | Medio-alto | OBSERVADO lista + blog |
| 6 | Escala con mano | 6-10 s | Parcial | Alto | HIPOTESIS |
| 7 | Oferta con urgencia | 10-33 s | Si (fotos + texto) | Bajo | OBSERVADO |
| 8 | Significado / historia | 20-40 s | Parcial | Medio | OBSERVADO |
| 9 | Creadora + codigo | 20-100 s | No | No aplica | OBSERVADO |
Extra: transicion flat lay (8-15 s, montaje de fotos, bajo riesgo).

### Receta abstracta recomendada para la app (6-8 s, la mas segura)
Objetivo: parar el scroll y mostrar calidad. Entrada: 1 foto limpia del producto + fondo neutro.
- 0-2 s: macro de la pieza brillando (gancho visual sin introduccion).
- 2-5 s: reflejo de luz o camara lenta recorre la pieza.
- 5-7 s: plano abierto, pieza completa; texto corto (material) y nombre de la tienda.
- Cierre igual al inicio para loop.
Control de calidad obligatorio: comparar con la foto original (forma, numero de piedras, cierre, grabado). Si falla, repetir o usar solo la foto con movimiento de camara.

## 5. Fuentes secundarias (descripciones de estructuras, no son datos de rendimiento)
- https://branvas.com/blogs/news/instagram-reels-ideas-jewelry-brand: 15 ideas de reels con secuencia (unboxing, 3 formas de estilizar, flat lay, ASMR, countdown de lanzamiento, guia de regalos), recomienda gancho en 3 s, audio en tendencia para atraer y audio original para convertir.
- https://news.centurionjewelry.com/jewelry-ecomm-tech/detail/the-best-tiktok-hooks-for-jewelers-50-openers-that-stop-the-scroll: patrones de gancho (revelacion anticipada, antes/despues, "error comun", "mira esto", POV).
- Busqueda general sobre unboxing/ASMR de joyeria (TikTok/Smartly/National Jeweler): sugieren mostrar llegada, packaging y ajuste; sonidos de materiales.

## 6. Limites (ver huecos-05.md)
- No se vio ningun video cuadro a cuadro, ni TikTok/YouTube/Pinterest directamente (WebFetch no entrega video y el navegador se congela con videos de la Ad Library). Los planos son INFERIDOS de descripcion, duracion y texto.
- La Ad Library no da gasto ni impresiones: no se sabe que anuncio funciona.
- Muestra de ~39 anuncios, no un censo.
