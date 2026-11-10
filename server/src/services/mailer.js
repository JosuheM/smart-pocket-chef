import nodemailer from 'nodemailer';
import { config } from '../config.js';

const { smtp } = config;

/** ¿Hay un servidor de correo configurado (SMTP_HOST, SMTP_USER y SMTP_PASS)? */
export const mailConfigured = Boolean(smtp.host && smtp.user && smtp.pass);

let transport = null;
const getTransport = () => {
  transport ??= nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465, // 465: SSL directo; 587: STARTTLS
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
};

/**
 * Envía un correo. Sin SMTP configurado:
 *  - en desarrollo, imprime el mensaje en la consola (así se puede probar sin servidor de correo);
 *  - en producción, falla con `code: 'MAIL_DISABLED'` para que la ruta avise que la función no está activa.
 */
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured) {
    if (config.isProd) throw Object.assign(new Error('SMTP no configurado'), { code: 'MAIL_DISABLED' });
    console.log(`\n[correo de desarrollo] Para: ${to}\nAsunto: ${subject}\n${text}\n`);
    return;
  }
  await getTransport().sendMail({ from: `"Smart Pocket Chef" <${smtp.from}>`, to, subject, text, html });
}
