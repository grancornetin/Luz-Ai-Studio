# SeaDream v2 — banco normalizado

- Entradas procesadas: **428**
- Entradas excluidas por instrucción: **48**
- Archivos JSON: **9** (lotes de 50; el último contiene 28)
- Entradas de origen sin bloque de variaciones: **114** (se conservan con `variations: []`)
- Control de calidad: `seadream_normalization_qc.tsv`
- Distribución y verificaciones v2: `quality_report.md`

## Contenido

- `seadream_normalized_batch_01.json`: entradas sd_0001 a sd_0050
- `seadream_normalized_batch_02.json`: entradas sd_0051 a sd_0100
- `seadream_normalized_batch_03.json`: entradas sd_0101 a sd_0150
- `seadream_normalized_batch_04.json`: entradas sd_0151 a sd_0200
- `seadream_normalized_batch_05.json`: entradas sd_0201 a sd_0250
- `seadream_normalized_batch_06.json`: entradas sd_0251 a sd_0300
- `seadream_normalized_batch_07.json`: entradas sd_0301 a sd_0350
- `seadream_normalized_batch_08.json`: entradas sd_0351 a sd_0400
- `seadream_normalized_batch_09.json`: entradas sd_0401 a sd_0428

Cada lote es un array JSON independiente, listo para importación. Los prompts conservan el texto fuente; las menciones de estilo de cámara no se usan como evidencia de un dispositivo en `tech`.
