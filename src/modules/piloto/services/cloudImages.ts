// Subida de imágenes del Piloto a Cloudinary (cuenta gratuita del proyecto).
// El bucket de Firebase Storage quedó bloqueado por cuota y exige plan de pago;
// el historial de generaciones ya usa esta misma cuenta (ver generationCloudStorage.ts).
// El preset es "unsigned": se sube directo desde el navegador sin exponer secretos.

const CLOUD_NAME = 'tge5qj6e';
const UPLOAD_PRESET = 'luz_ia_studio';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

/** `path` es el public_id: sirve de identificador estable de la imagen. */
export async function uploadImageBlob(blob: Blob, publicId: string): Promise<{ url: string; path: string }> {
  const form = new FormData();
  form.append('file', blob, 'img.jpg');
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('public_id', publicId);
  const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloudinary ${res.status} ${text.slice(0, 160)}`);
  }
  const data = await res.json();
  return { url: data.secure_url as string, path: (data.public_id as string) || publicId };
}
