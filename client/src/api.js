const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'spc_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* sin almacenamiento */ }
};

// App registra aquí qué hacer cuando el servidor dice que la sesión venció.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const RETRY_DELAYS = [600, 1500]; // milisegundos de espera antes de cada reintento
const RETRY_STATUS = [502, 503, 504]; // respuestas del hosting cuando la app no está lista
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  // Las consultas que solo leen datos (GET) se repiten solas hasta 2 veces si la red o el hosting fallan un instante
  // (por ejemplo, cuando una copia de la app se está reiniciando). Las que escriben datos no se repiten.
  const canRetry = method === 'GET';
  const offline = () => typeof navigator !== 'undefined' && !navigator.onLine;
  let res;
  for (let attempt = 0; ; attempt += 1) {
    try {
      res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (canRetry && RETRY_STATUS.includes(res.status) && attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      break;
    } catch {
      if (canRetry && !offline() && attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw new Error(
        offline()
          ? 'Sin conexión a internet. Verifica tu red; las recetas que ya abriste y tu lista de compras siguen disponibles.'
          : 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo en unos minutos.',
      );
    }
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && auth) onUnauthorized();
    // Una respuesta que no viene de nuestra API (por ejemplo, el 503 del hosting si la app está caída) no trae JSON
    const fallback = res.status >= 500
      ? 'El servidor no está disponible en este momento. Inténtalo de nuevo en unos minutos.'
      : 'Ocurrió un error inesperado.';
    throw Object.assign(new Error(data?.error || fallback), { status: res.status });
  }
  return data ?? {};
}

const csv = (list) => encodeURIComponent(list.join(','));

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v === true ? '1' : v);
  return p.toString();
}

export const api = {
  search: ({ ingredients, mode, sort, category, pantry, offset = 0, limit = 12 }) =>
    request(`/recipes/search?${qs({ ingredients: ingredients.join(','), mode, sort, category, pantry, offset, limit })}`),
  explore: ({ q, category, area, offset = 0, limit = 12 }) =>
    request(`/recipes/explore?${qs({ q, category, area, offset, limit })}`),
  recipe: (id, have, pantry) => request(`/recipes/${id}?have=${csv(have)}${pantry ? '&pantry=1' : ''}`),
  suggest: (q) => request(`/recipes/ingredients?q=${encodeURIComponent(q)}`),
  meta: () => request('/recipes/meta'),
  status: (fresh) => request(`/status${fresh ? '?fresh=1' : ''}`),
  random: () => request('/recipes/random'),
  hero: () => request('/recipes/hero'),
  register: (form) => request('/auth/register', { method: 'POST', body: form, auth: false }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => request('/auth/me', { auth: false }),
  favorites: () => request('/favorites'),
  addFavorite: (recipe) => request('/favorites', { method: 'POST', body: recipe }),
  removeFavorite: (mealId) => request(`/favorites/${mealId}`, { method: 'DELETE' }),
  createQr: (payload) => request('/shopping/qr', { method: 'POST', body: payload }),
  history: () => request('/shopping/history'),
  deleteHistory: (id) => request(`/shopping/history/${id}`, { method: 'DELETE' }),
};
