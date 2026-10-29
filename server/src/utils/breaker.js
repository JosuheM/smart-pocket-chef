/**
 * Cortacircuitos: cuando un servicio externo no responde (sin internet, caído), se deja de llamarlo unos minutos
 * y la app usa su copia local. Así cada petición no espera el tiempo máximo de espera.
 */
export function createBreaker(name, cooldownMs = 2 * 60 * 1000) {
  let openUntil = 0;
  return {
    get open() { return Date.now() < openUntil; },
    trip(err) {
      const wasOpen = Date.now() < openUntil;
      openUntil = Date.now() + cooldownMs;
      if (!wasOpen) console.warn(`${name}: sin respuesta (${err?.message ?? 'error de red'}). Se usa la copia local ${Math.round(cooldownMs / 60000)} min.`);
    },
    reset() { openUntil = 0; },
  };
}
