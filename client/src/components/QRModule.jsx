import { useEffect, useState } from 'react';

/** QR generado en el propio navegador (sin QuickChart): plan B cuando no hay internet o el servicio no responde. */
async function localQr(text) {
  const { toDataURL } = await import('qrcode');
  return toDataURL(text, { width: 480, margin: 2, errorCorrectionLevel: 'M' });
}

export default function QRModule({ qr, loggedIn, notify }) {
  const [local, setLocal] = useState(null); // data URL del QR local
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const makeLocal = () => localQr(qr.text).then(setLocal).catch(() => setLocal(null));

  // Sin internet no se intenta QuickChart: se genera el QR de una vez
  useEffect(() => {
    setLocal(null);
    if (typeof navigator !== 'undefined' && !navigator.onLine) makeLocal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr.text]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(qr.text);
      notify?.('Lista copiada al portapapeles.');
    } catch {
      notify?.('Tu navegador no permitió copiar. Selecciona el texto y cópialo a mano.', 'error');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: 'Lista de compras', text: qr.text });
    } catch { /* el usuario canceló */ }
  };

  const download = async () => {
    try {
      const href = local ?? URL.createObjectURL(await (await fetch(qr.qrUrl)).blob());
      const link = Object.assign(document.createElement('a'), { href, download: 'lista-de-compras.png' });
      link.click();
      if (!local) URL.revokeObjectURL(href);
    } catch {
      // QuickChart no respondió: se baja el QR generado aquí
      const href = local ?? (await localQr(qr.text));
      Object.assign(document.createElement('a'), { href, download: 'lista-de-compras.png' }).click();
    }
  };

  return (
    <div className="qr">
      <div>
        <img
          src={local ?? qr.qrUrl}
          alt="Código QR con tu lista de compras"
          width="240"
          height="240"
          onError={() => { if (!local) makeLocal(); }}
        />
        {local && <p className="muted qr-local">QR generado en tu dispositivo (sin QuickChart).</p>}
      </div>
      <div className="qr-side">
        <p className="qr-lead">Escanéalo con la cámara de tu celular para llevarte la lista.</p>
        {qr.omitted > 0 && (
          <p className="notice" role="status">
            La lista era muy larga para un solo QR: quedaron fuera {qr.omitted} {qr.omitted === 1 ? 'ingrediente' : 'ingredientes'}. Genera otro QR con ellos o usa “Copiar lista”.
          </p>
        )}
        <pre className="qr-text">{qr.text}</pre>
        <div className="qr-actions">
          <button className="btn" onClick={copy}>Copiar lista</button>
          <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(qr.text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          {canShare && <button className="btn" onClick={share}>Compartir</button>}
          <button className="btn" onClick={download}>Descargar QR</button>
        </div>
        <p className="muted">
          {qr.saved
            ? 'Guardada en tu historial de compras.'
            : loggedIn
              ? 'No pudimos guardarla en tu historial.'
              : 'Ingresa para guardar tus listas en el historial.'}
        </p>
      </div>
    </div>
  );
}
