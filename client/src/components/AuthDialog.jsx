import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useModal } from '../hooks.js';

export default function AuthDialog({ notice, onClose, onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const ref = useRef(null);
  const isLogin = mode === 'login';

  useModal(ref, onClose);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onAuth(isLogin ? await api.login(form.email, form.password) : await api.register(form), !isLogin);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="backdrop backdrop-top" onClick={onClose} />
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h2 id="auth-title">{isLogin ? 'Ingresar' : 'Crear cuenta'}</h2>
        {notice && <p className="muted">{notice}</p>}

        <form onSubmit={submit} className="auth-form">
          {!isLogin && (
            <label className="field">Nombre
              <input value={form.name} onChange={set('name')} autoComplete="name" required minLength={2} maxLength={80} autoFocus />
            </label>
          )}
          <label className="field">Correo
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required autoFocus={isLogin} />
          </label>
          <label className="field">Contraseña
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={isLogin ? undefined : 8}
              maxLength={72}
            />
            {!isLogin && <small className="muted">Mínimo 8 caracteres.</small>}
          </label>
          <label className="check">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Mostrar contraseña
          </label>

          {error && <p className="alert" role="alert">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Un momento…' : isLogin ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? '¿Primera vez aquí?' : '¿Ya tienes cuenta?'}{' '}
          <button className="btn-link" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}>
            {isLogin ? 'Crear una cuenta' : 'Ingresar'}
          </button>
        </p>
        <button className="btn-link auth-close" onClick={onClose}>Ahora no</button>
      </div>
    </>
  );
}
