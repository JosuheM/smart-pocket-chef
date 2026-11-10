import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useModal } from '../hooks.js';
import GoogleButton from './GoogleButton.jsx';

export default function AuthDialog({ notice, onClose, onAuth }) {
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false); // ya se pidió el enlace de recuperación
  const ref = useRef(null);
  const isForgot = mode === 'forgot';
  const isLogin = mode === 'login';

  useModal(ref, onClose);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const switchTo = (next) => { setMode(next); setError(''); setSent(false); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isForgot) {
        await api.forgotPassword(form.email);
        setSent(true);
        return;
      }
      onAuth(isLogin ? await api.login(form.email, form.password) : await api.register(form), !isLogin);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Google entrega un token firmado; el servidor lo valida y devuelve la sesión propia
  const googleLogin = async (credential) => {
    setBusy(true);
    setError('');
    try {
      const data = await api.google(credential);
      onAuth(data, data.isNew);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (isForgot) {
    return (
      <>
        <div className="backdrop backdrop-top" onClick={onClose} />
        <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <h2 id="auth-title">Recuperar mi cuenta</h2>
          {sent ? (
            <>
              <p role="status">
                Si <strong>{form.email}</strong> tiene una cuenta, te acabamos de enviar un enlace para elegir una contraseña nueva.
                Vence en 1 hora. Revisa también la carpeta de correo no deseado.
              </p>
              <button className="btn" onClick={() => switchTo('login')}>Volver a ingresar</button>
            </>
          ) : (
            <form onSubmit={submit} className="auth-form">
              <p className="muted">Escribe el correo de tu cuenta y te enviamos un enlace para elegir una contraseña nueva. Si entras con Google, también sirve para ponerle una contraseña.</p>
              <label className="field">Correo
                <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required autoFocus />
              </label>
              {error && <p className="alert" role="alert">{error}</p>}
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviarme el enlace'}</button>
            </form>
          )}
          {!sent && <button className="btn-link auth-close" onClick={() => switchTo('login')}>Volver</button>}
        </div>
      </>
    );
  }

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
          {isLogin && <button type="button" className="btn-link forgot-link" onClick={() => switchTo('forgot')}>¿Olvidaste tu contraseña?</button>}
        </form>

        <GoogleButton onCredential={googleLogin} disabled={busy} />

        <p className="auth-switch">
          {isLogin ? '¿Primera vez aquí?' : '¿Ya tienes cuenta?'}{' '}
          <button className="btn-link" onClick={() => switchTo(isLogin ? 'register' : 'login')}>
            {isLogin ? 'Crear una cuenta' : 'Ingresar'}
          </button>
        </p>
        <button className="btn-link auth-close" onClick={onClose}>Ahora no</button>
      </div>
    </>
  );
}
