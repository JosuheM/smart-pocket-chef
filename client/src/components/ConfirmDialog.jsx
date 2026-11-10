import { useRef } from 'react';
import { useModal } from '../hooks.js';

/** Pide confirmación antes de una acción que no se puede deshacer. El foco empieza en "Cancelar". */
export default function ConfirmDialog({ title, children, confirmLabel, busyLabel, busy, error, onCancel, onConfirm }) {
  const ref = useRef(null);
  useModal(ref, onCancel);
  return (
    <>
      <div className="backdrop backdrop-top" onClick={busy ? undefined : onCancel} />
      <div ref={ref} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-text">{children}</p>
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="admin-confirm">
          <button className="btn" onClick={onCancel} disabled={busy} autoFocus>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
        </div>
      </div>
    </>
  );
}
