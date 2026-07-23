function isRetryableError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const message = String((error as Error)?.message ?? "");
  const cause = (error as { cause?: { code?: string } })?.cause;
  if (status === 429 || message.includes("RESOURCE_EXHAUSTED") || message.includes("429")) return true;
  // Cortes de red transitorios (visto en vivo: ConnectTimeoutError al hablar
  // con aiplatform.googleapis.com) — también vale la pena reintentar, no son
  // un problema de la petición en sí.
  if (message.includes("fetch failed") || cause?.code === "UND_ERR_CONNECT_TIMEOUT") return true;
  return false;
}

/**
 * Reintenta con espera creciente si Gemini responde 429 (cuota agotada) o si
 * hay un corte de red transitorio — una corrida completa no debería abortar
 * por un pico pasajero. No reintenta otros tipos de error (esos sí deben
 * cortar y avisar, ej. errores de formato de la petición).
 */
export async function withRetryOn429<T>(fn: () => Promise<T>, opts: { maxRetries?: number; baseDelayMs?: number } = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 30_000;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxRetries) throw error;
      const waitMs = baseDelayMs * (attempt + 1);
      console.log(`[QA]   ⏳ Error transitorio (${(error as Error).message?.slice(0, 60)}), reintentando en ${Math.round(waitMs / 1000)}s (intento ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}
