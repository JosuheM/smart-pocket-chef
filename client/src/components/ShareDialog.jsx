import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useModal } from '../hooks.js';

/** QR generado en el propio navegador: plan B si QuickChart no responde o no hay internet. */
async function localQr(text) {
  const { toDataURL } = await import('qrcode');
  return toDataURL(text, { width: 480, margin: 2, errorCorrectionLevel: 'M' });
}

/** Compartir una receta: enlace exacto de la app, QR (QuickChart), WhatsApp, Telegram, Facebook, correo y el menú del celular. */
export default function ShareDialog({ recipe, onClose, notify }) {
  const url = `${location.origin}${location.pathname}?r=${recipe.id}`;
  const [qrUrl, setQrUrl] = useState(null);
  const [local, setLocal] = useState(null);
  const ref = useRef(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const message = `Mira esta receta: ${recipe.name}`;

  useModal(ref, onClose);

  useEffect(() => {
    let alive = true;
    const fallback = () => localQr(url).then((d) => alive && setLocal(d)).catch(() => {});
    if (!navigator.onLine) { fallback(); return () => { alive = false; }; }
    api.shareQr(url).then((d) => alive && setQrUrl(d.qrUrl)).catch(fallback);
    return () => { alive = false; };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify('Enlace de la receta copiado.');
    } catch {
      notify('Tu navegador no permitió copiar. Selecciona el enlace y cópialo a mano.', 'error');
    }
  };

  const nativeShare = async () => {
    try { await navigator.share({ title: recipe.name, text: message, url }); } catch { /* cancelado */ }
  };

  const download = async () => {
    try {
      const href = local ?? URL.createObjectURL(await (await fetch(qrUrl)).blob());
      Object.assign(document.createElement('a'), { href, download: `qr-${recipe.name.slice(0, 30)}.png` }).click();
      if (!local) URL.revokeObjectURL(href);
    } catch {
      Object.assign(document.createElement('a'), { href: local ?? (await localQr(url)), download: 'qr-receta.png' }).click();
    }
  };

  const text = encodeURIComponent(`${message} ${url}`);
  return (
    <>
      <div className="backdrop backdrop-top" onClick={onClose} />
      <div ref={ref} className="dialog share" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Compartir receta</h2>
        <p className="muted">{recipe.name}</p>

        <div className="share-qr">
          {qrUrl || local ? (
            <img
              src={local ?? qrUrl}
              alt={`Código QR con el enlace de ${recipe.name}`}
              width="200"
              height="200"
              onError={() => { if (!local) localQr(url).then(setLocal).catch(() => {}); }}
            />
          ) : (
            <div className="share-qr-wait" role="status">Generando QR…</div>
          )}
          <p className="muted">Escanéalo con la cámara del celular para abrir la receta.</p>
        </div>

        <label className="field">Enlace
          <input value={url} readOnly onFocus={(e) => e.target.select()} />
        </label>

        <div className="share-actions">
          <button className="btn btn-primary" onClick={copy}>Copiar enlace</button>
          <a className="btn" href={`https://wa.me/?text=${text}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="btn" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Telegram</a>
          <a className="btn" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">Facebook</a>
          <a className="btn" href={`mailto:?subject=${encodeURIComponent(recipe.name)}&body=${text}`}>Correo</a>
          {canShare && <button className="btn" onClick={nativeShare}>Más opciones…</button>}
          <button className="btn" onClick={download} disabled={!qrUrl && !local}>Descargar QR</button>
        </div>
        <button className="btn-link auth-close" onClick={onClose}>Cerrar</button>
      </div>
    </>
  );
}
