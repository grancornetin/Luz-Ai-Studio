// Lee y parsea la cuenta de servicio de Vertex AI para el cliente de imagen
// (core/image-generator.js). Copia mínima y local de la misma lógica de
// resolución de ruta que ya usa ../../vertex-client.js — no se importa desde
// ahí porque ese archivo no exporta esta función.

const fs = require('fs');
const path = require('path');

function credentialPath() {
  const configured = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()
    .replace(/^"(.*)"$/, '$1');
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(__dirname, '..', '..', configured);
  }
  return path.join(__dirname, '..', '..', 'Luz IA secrets', 'vertex-service-account.json');
}

function readServiceAccount() {
  const file = credentialPath();
  if (!fs.existsSync(file)) {
    throw new Error(
      'No se encontró la cuenta de servicio para Pose Library. Coloca vertex-service-account.json en "' +
      path.join('Luz IA secrets', 'vertex-service-account.json') +
      '" o define GOOGLE_APPLICATION_CREDENTIALS con una ruta válida. Ruta revisada: ' + file
    );
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error('No se pudo leer la cuenta de servicio: ' + err.message);
  }
  if (serviceAccount.type !== 'service_account' || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('El JSON de credenciales no corresponde a una cuenta de servicio válida.');
  }
  return serviceAccount;
}

module.exports = { readServiceAccount };
