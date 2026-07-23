/**
 * Limitador secuencial: una sola llamada a Gemini a la vez, con una espera
 * fija entre cada una. Se pasó de un esquema de "3 en paralelo + esperar el
 * resto del minuto" a este porque en vivo seguía chocando con 429
 * (RESOURCE_EXHAUSTED) incluso respetando 3/minuto — la cuota real de una
 * cuenta de servicio nueva en Vertex AI parece tolerar ráfagas muy chicas
 * antes de cortar. Uno por vez con pausa larga es más lento pero confiable.
 */
export class RateLimiter {
  constructor(private readonly delayBetweenCallsMs = 25_000) {}

  async runAll<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += 1) {
      results.push(await fn(items[i], i));
      const isLast = i === items.length - 1;
      if (!isLast) await new Promise(resolve => setTimeout(resolve, this.delayBetweenCallsMs));
    }
    return results;
  }
}
