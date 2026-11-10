import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

/** Página a la que lleva el enlace del correo de recuperación: /restablecer?token=… */
export default function ResetPassword({ onDone }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== again) { setError('Las dos contraseñas no coinciden.'); return; }
    setBusy(true);
    try {
      onDone(await api.resetPassword(token, password));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="contenido">
      <section className="reset">
        <h2 className="section-title">Elige tu contraseña nueva</h2>
        {!token ? (
          <>
            <p className="alert" role="alert">Este enlace está incompleto. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.</p>
            <p><Link className="btn" to="/">Volver al inicio</Link></p>
          </>
        ) : (
          <form className="auth-form reset-form" onSubmit={submit}>
            <label className="field">Contraseña nueva
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} maxLength={72} autoFocus />
              <small className="muted">Mínimo 8 caracteres.</small>
            </label>
            <label className="field">Repite la contraseña
              <input type={show ? 'text' : 'password'} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required minLength={8} maxLength={72} />
            </label>
            <label className="check">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Mostrar contraseña
            </label>
            {error && <p className="alert" role="alert">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y entrar'}</button>
            <p className="muted">Si el enlace venció o ya lo usaste, <Link to="/" className="btn-link">vuelve al inicio</Link> y pide otro.</p>
          </form>
        )}
      </section>
    </main>
  );
}
