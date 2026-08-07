# Cómo actualizar el banco de Photodump

Este documento es para pedirle a un chat de Claude que actualice el banco compilado, sin tener que explicar nada técnico cada vez.

## Qué decirle al chat

> "Actualizame el banco de Photodump que está en `src/data/photodump-bank/`, siguiendo los pasos de `COMO_ACTUALIZAR_EL_BANCO.md`."

## Qué hace el chat cuando le pedís esto

1. Corre el comando `node scripts/compileBankSnapshot.js` desde la raíz del proyecto.
2. Ese script junta automáticamente todas las fotos que ya aprobaste en el entrenador de Photodump (carpeta `C:\Users\Nico Trabajo\Downloads\contenido de prueba\photodump`) en un solo archivo: `src/data/photodump-bank/bank-snapshot.json`.
3. Al terminar, el chat te va a decir cuántas fotos aprobadas se incluyeron y confirma que el archivo quedó actualizado.

## Cuándo pedirlo

Cada vez que hayas aprobado o rechazado fotos nuevas en el entrenador y quieras que esos cambios estén disponibles para el Director Creativo — el banco compilado no se actualiza solo, hay que pedirlo explícitamente después de cada tanda de revisión.

## Qué NO hace

- No borra ni modifica tus fotos originales ni tus análisis — solo lee y copia lo aprobado a un archivo nuevo.
- No incluye fotos que estén "pendientes" de tu revisión — solo las que ya marcaste como aprobadas.
- No sube nada a internet ni a producción — solo actualiza el archivo local del repo. Subirlo a producción es un paso aparte que se define en otro momento.
