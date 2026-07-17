# Fashion Mother
Version 1.0

## 1. Propósito

Fashion es el lenguaje visual para comunicar prendas y looks a través de identidad, autopresentación y vida social.

No es un único `outfit_check`. Debe servir como base para múltiples recetas especializadas.

## 2. Qué vende Fashion

Fashion rara vez vende solamente cobertura corporal o material.

Vende:

- confianza;
- atracción;
- pertenencia;
- estatus;
- individualidad;
- transformación;
- control de la propia imagen;
- preparación para una experiencia.

## 3. Impulsos principales

1. Atracción y autopresentación.
2. Estatus y control.
3. Pertenencia.
4. Exploración y placer.
5. Facilidad, cuando el look promete versatilidad o comodidad.

## 4. Entidades

### Garment

Una pieza individual.

### Outfit

Combinación coordinada de prendas y, opcionalmente, accesorios.

### Base Look

Ropa funcional no comercial que permite interacción antes de ponerse el producto.

### Active Look

Outfit asignado al shot.

### Supporting Accessory

Elemento secundario que completa, pero no sustituye, el active look.

### Identity Clothing

Ropa visible en referencia de rostro o cuerpo. Se considera contaminación potencial y nunca producto.

## 5. Fidelity Contract

Preservar:

- color;
- patrón;
- corte;
- largo;
- ajuste;
- material;
- transparencia real;
- escote;
- mangas;
- cintura;
- cierres;
- capas;
- calzado;
- accesorios incluidos.

No “mejorar” ni reemplazar una pieza.

## 6. Body Contract

La ropa debe adaptarse al cuerpo sin modificarlo para hacer que la prenda funcione.

Evitar:

- adelgazar;
- aumentar curvas;
- alargar piernas;
- cambiar altura;
- borrar volumen;
- convertir ropa holgada en cuerpo;
- tratar tela como anatomía.

## 7. Wear States

- `displayed`
- `held_for_preview`
- `putting_on`
- `adjusting`
- `fully_worn`
- `partially_removed`
- `resting_after_use`

Un shot debe declarar un estado único y físicamente posible.

## 8. Capture Motivations Fashion

- “Me vi al espejo y el look funcionó.”
- “Quería registrar cómo quedó antes de salir.”
- “Mi amiga dijo que me veía bien.”
- “La combinación con el entorno era demasiado buena.”
- “Quería recordar este outfit en esta experiencia.”
- “El detalle de la prenda se veía especialmente bien con esta luz.”
- “No había nadie y me tomé un POV.”

## 9. Primitives de Fashion

### `full_body_mirror_check`

Autocaptura. Teléfono visible. Geometría real. Outfit legible.

### `friend_pov_full_body`

Foto tomada por una persona cercana. Puede ser intencional, pero no catálogo.

### `self_pov_outfit`

Perspectiva desde ojos/pecho hacia piernas y outfit. Sin cuerpo completo imposible.

### `styling_adjustment`

Manos ajustando, cerrando, doblando, metiendo o alisando.

### `garment_presentation`

Outfit sostenido, en cama o silla, con señal “esto me pondré”.

### `social_outfit_moment`

El outfit participa en una experiencia social.

### `walking_or_motion`

Movimiento real, no blur artificial.

### `seated_everyday`

Banca, café, auto o casa. El cuerpo y la prenda deben seguir legibles.

### `material_detail_in_context`

Detalle motivado por interacción o luz, no macro e-commerce.

### `end_of_event_closure`

Señales de tiempo, relajación o satisfacción.

## 10. Awareness Modes

- `unaware_candid`
- `aware_friend_photo`
- `intentional_selfie`
- `intentional_outfit_record`
- `playful_social`

No toda foto debe fingir que la persona no vio la cámara. La falsa espontaneidad repetida también parece publicidad.

## 11. Mundos

Fashion puede usar:

- prep room;
- mirror/bathroom;
- doorway;
- street;
- café;
- restaurant;
- venue;
- office;
- transit;
- nature;
- home.

La receta decide cuáles y por qué.

## 12. Reglas de organicidad

- La pose nace de una intención.
- El lugar tiene relación con el outfit.
- El producto no ocupa automáticamente 80% del frame.
- Alternar autocaptura y tercera persona.
- Conservar imperfecciones funcionales.
- Mostrar estado temporal.
- La persona puede verse consciente de que luce bien.

## 13. Subrecetas propuestas

### Núcleo inicial

- `outfit_reveal_basic`
- `outfit_night_out`
- `outfit_day_out`
- `outfit_workday`
- `clothing_try_on`
- `clothing_haul`
- `weekly_outfits`
- `single_garment_lifestyle`

### Futuras

- `event_outfit`
- `travel_outfit`
- `date_outfit`
- `seasonal_rotation`
- `one_piece_three_ways`

## 14. Qué ocurre con el antiguo outfit_check

Debe dejar de intentar cubrir ópera, oficina, playa, restaurante, viaje y noche dentro de una única receta monolítica.

Destino y ocasión pueden ser variantes solo cuando no cambian el arco. Cuando cambian la psicología, inputs y shots, son recetas distintas.

## 15. Recipe Selection Logic

```text
¿Una pieza o look?
├── una pieza → single_garment_lifestyle / try_on
└── look completo
    ├── solo mostrar resultado → outfit_reveal_basic
    ├── contar una salida → outfit_night_out / day_out
    ├── múltiples looks → haul / weekly_outfits
    └── contexto profesional → outfit_workday
```

## 16. Errores críticos

- outfit inventado;
- ropa de avatar contaminando active look;
- mirror selfie sin teléfono;
- cuerpo completo desde perspectiva imposible;
- misma pose en todo el set;
- cambio de silueta;
- outfit incompleto;
- acompañante clonada;
- destino artificial;
- editorialización excesiva;
- accesorios multiplicados;
- tacones o botas con geometría alterada.

## 17. Prueba Fashion

Una imagen aprueba cuando:

1. el look es fiel;
2. la silueta se conserva;
3. la acción es plausible;
4. la cámara tiene origen;
5. existe motivo de captura;
6. proyecta identidad;
7. despierta deseo por sensación o experiencia;
8. sigue pareciendo contenido social.
