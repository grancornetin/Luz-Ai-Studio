# Experimental Findings 001
Estado: Validado
Fuente: Validación manual en Higgsfield
Fecha: 2026-07

Estos hallazgos no nacen de teoría. Nacen de experimentos comparativos hechos a mano durante la validación manual de recetas (ver `09_session_log_outfit_night_out_validation.md`). Cada uno cambia una parte concreta de la arquitectura descrita en `03_photodump_recipe_architecture.md` — los cambios ya están aplicados ahí; este documento es el registro del experimento que los originó.

---

## Finding 001
### El razonamiento del Director no debe pasarse verbatim al modelo de imagen.

**Hipótesis inicial**

El razonamiento creativo completo producido por el Director podía inyectarse directo en el prompt final: intención emocional, historia, motivaciones, contexto narrativo, por qué existe la imagen.

**Experimento**

Se compararon tres estilos de prompt, manteniendo idénticos personaje, outfit, pose, escena y encuadre:

- A. Prompt narrativo (razonamiento completo trasladado a texto).
- B. Dirección fotográfica pura, sin narrativa.
- C. Descripción visual en lenguaje natural, compacta.

**Observación**

El lenguaje narrativo no produjo una mejora medible sobre las instrucciones visuales compactas. El estilo visual dominante fue prácticamente idéntico entre variantes. El razonamiento en sí no mejoró la calidad de imagen.

**Conclusión**

El Director debe razonar extensamente hacia adentro. Lo que se exporta hacia el Prompt Composer son decisiones visuales ya destiladas, no el razonamiento que las produjo.

```
Brief
  ↓
Razonamiento del Director (interno)
  ↓
Decisiones visuales (lo que se exporta)
  ↓
Prompt Composer
  ↓
Prompt final
```

El prompt es lenguaje de ejecución. El razonamiento del Director es de uso interno únicamente.

Estado: Validado.

---

## Finding 002
### El render fotográfico influye más que la redacción narrativa.

**Experimento**

Misma escena, misma pose, mismo outfit, mismo prompt base. Solo se modificó el bloque de render fotográfico. Variantes probadas:

- "Instagram iPhone" genérico.
- Lenguaje técnico de iPhone (artefactos observables de cámara de celular).
- Lenguaje de Camera Roll (foto casual sin editar).

**Observación**

Cambiar únicamente el lenguaje de render cambió por completo la apariencia visual del resultado. El acabado editorial desapareció. La escena se volvió creíble como una captura real de celular.

**Conclusión**

El render fotográfico es una capa independiente. No debe mezclarse con historia, psicología o descripción de escena dentro del mismo bloque de prompt.

```
Prompt (decisiones visuales)
  ↓
Photographic Render Profile (capa independiente)
```

Perfiles de ejemplo: iPhone, DSLR, Editorial, CCTV, Security Camera, Vintage Camera.

Estado: Validado.

---

## Finding 003
### Nombrar el dispositivo ("shot on iPhone") no alcanza.

La frase "Photographed on an iPhone" no fue suficiente por sí sola — la imagen resultante seguía viéndose editorial.

Describir los artefactos visibles de una foto de celular real produjo resultados mucho más fuertes. Ejemplos: encuadre casual, exposición imperfecta, calidad de camera roll, sin acabado editorial, calidad de smartphone cotidiano.

**Conclusión**

Hay que describir las características fotográficas observables, no nombrar el dispositivo. El modelo no traduce el nombre del dispositivo en sus artefactos visuales; hay que describir esos artefactos directamente.

Estado: Validado.

---

## Finding 004
### El lenguaje de Camera Roll es hoy el que mejor rinde.

Redacción con mejor desempeño hasta ahora:

- camera roll
- unedited photo
- casual handheld
- everyday smartphone
- no catalogue finish
- no beauty retouching

**Resultado**

Apariencia consistente de foto de iPhone real, preservando fidelidad de identidad y de outfit.

Este es el lenguaje base del perfil `iphone_camera_roll` en la Photographic Rendering Layer (`03_photodump_recipe_architecture.md`, sección 19).

Estado: Validado.
