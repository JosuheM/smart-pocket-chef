import { Navigate } from 'react-router-dom';

/**
 * Ruta protegida: solo los administradores ven a sus hijos. Los demás vuelven al inicio ("/").
 * Mientras se comprueba la sesión guardada se espera, para no echar a un admin por recargar la página.
 * Esto solo oculta la pantalla: la seguridad real está en el servidor (verifyAdmin) y cada petición vuelve a comprobarla.
 */
export default function AdminRoute({ user, loading, children }) {
  if (loading) return <p className="drawer-status" role="status">Verificando tu acceso…</p>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace state={{ denied: true }} />;
  return children;
}
