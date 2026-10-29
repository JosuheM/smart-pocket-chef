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

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error(
      typeof navigator !== 'undefined' && !navigator.onLine
        ? 'Sin conexión a internet. Verifica tu red; las recetas que ya abriste y tu lista de compras siguen disponibles.'
        : 'No se pudo conectar con el servidor. Revisa que el backend esté encendido.',
    );
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && auth) onUnauthorized();
    throw Object.assign(new Error(data.error || 'Ocurrió un error inesperado.'), { status: res.status });
  }
  return data;
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
