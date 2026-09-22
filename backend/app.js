import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import nodemailer from 'nodemailer';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const EMAIL = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/;

function text(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

// Inject dependencies so tests never contact Cloudflare or send real mail.
export function createApp({ env = process.env, verifyFetch = fetch, sendMail } = {}) {
  const app = express();
  const origin = env.CORS_ORIGIN;
  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  const hostnames = new Set((env.TURNSTILE_HOSTNAMES || '').split(',').map(s => s.trim()).filter(Boolean));
  const verificationConfigured = Boolean(siteKey && secret && hostnames.size);
  const mailConfigured = Boolean(env.MAIL_FROM && env.MAIL_TO && (sendMail || env.SMTP_HOST));
  const transport = mailConfigured && !sendMail ? nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  }) : null;
  const deliver = sendMail || (mail => transport.sendMail(mail));

  app.disable('x-powered-by');
  // Backend is private; frontend passes X-Forwarded-For sanitized by the edge proxy.
  app.set('trust proxy', 1);
  app.use(cors({ origin: origin || false }));
  const attempts = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 5,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'too many contact attempts' },
  });
  const deliveries = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 30,
    keyGenerator: () => 'contact-deliveries',
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'contact delivery limit reached' },
  });

  const detailAttempts = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'too many contact detail attempts' },
  });

  function checkRequest(request, response, next) {
    response.set('Cache-Control', 'no-store');
    if ((request.get('Origin') && request.get('Origin') !== origin) || request.get('Sec-Fetch-Site') === 'cross-site') {
      return response.status(403).json({ error: 'request not allowed' });
    }
    if (!request.is('application/json')) return response.status(415).json({ error: 'JSON required' });
    next();
  }

  async function verifyToken(request, response, action) {
    if (!verificationConfigured) {
      response.status(503).json({ error: 'verification unavailable' });
      return false;
    }
    const { turnstileToken } = request.body || {};
    if (!text(turnstileToken, 2048)) {
      response.status(400).json({ error: 'verification required' });
      return false;
    }
    try {
      const verification = await verifyFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, response: turnstileToken, remoteip: request.ip }),
        signal: AbortSignal.timeout(8000),
      });
      if (!verification.ok) throw new Error('verification unavailable');
      const result = await verification.json();
      if (result.success !== true || !hostnames.has(result.hostname) || result.action !== action) {
        response.status(403).json({ error: 'verification failed' });
        return false;
      }
      return true;
    } catch {
      response.status(503).json({ error: 'verification unavailable' });
      return false;
    }
  }

  app.get('/health', (_request, response) => response.json({ ok: true }));
  app.get('/api/contact-data', (_request, response) => {
    response.set({ 'Cache-Control': 'no-store', Allow: 'POST' });
    response.status(405).json({ error: 'verification required' });
  });
  app.post('/api/contact-data', detailAttempts, checkRequest, express.json({ limit: '4kb' }), async (request, response) => {
    const { kind } = request.body || {};
    if (kind !== 'email' && kind !== 'phone') return response.status(400).json({ error: 'invalid contact detail' });
    if (!await verifyToken(request, response, `contact_${kind}`)) return;
    const value = kind === 'email' ? env.CONTACT_EMAIL : env.CONTACT_PHONE;
    if (!value?.trim()) return response.status(503).json({ error: 'contact detail unavailable' });
    response.json({ value });
  });
  app.get('/api/contact-config', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    if (!verificationConfigured) {
      return response.status(503).json({ error: 'contact service unavailable' });
    }
    response.json({ siteKey });
  });

  app.post('/api/contact', attempts, checkRequest, express.json({ limit: '16kb' }), async (request, response, next) => {
    const { name, email, message, website } = request.body || {};
    if (website !== undefined && (typeof website !== 'string' || website !== '')) {
      return response.status(400).json({ error: 'invalid contact request' });
    }
    if (!text(name, 80) || CONTROL_CHARACTERS.test(name) || !text(email, 254) ||
        CONTROL_CHARACTERS.test(email) || !EMAIL.test(email.trim()) || !text(message, 2000) || message.includes('\0')) {
      return response.status(400).json({ error: 'invalid contact fields' });
    }
    // Never send unverified mail if configuration or Cloudflare is unavailable.
    if (!verificationConfigured || !mailConfigured) {
      return response.status(503).json({ error: 'contact service unavailable' });
    }
    if (!await verifyToken(request, response, 'contact')) return;
    response.locals.contact = { name: name.trim(), email: email.trim(), message: message.trim() };
    next();
  }, deliveries, async (_request, response) => {
    const { name, email, message } = response.locals.contact;
    try {
      await deliver({
        from: env.MAIL_FROM, replyTo: { address: email }, to: env.MAIL_TO,
        subject: `Dimundi contact from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      });
      response.status(202).json({ ok: true });
    } catch {
      console.error('Contact mail delivery failed');
      response.status(502).json({ error: 'mail delivery failed' });
    }
  });
  app.use((error, _request, response, _next) => {
    const status = error.type === 'entity.too.large' ? 413 : error.status === 400 ? 400 : 500;
    response.status(status).json({ error: 'invalid request' });
  });
  return app;
}
