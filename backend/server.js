import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import nodemailer from 'nodemailer';

const app = express();
const port = Number(process.env.PORT || 3000);
const recipient = process.env.MAIL_TO;
const phoneNumber = process.env.CONTACT_PHONE || '';
const email = process.env.CONTACT_EMAIL || '';

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '16kb' }));

function requiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createTransport() {
  if (!process.env.SMTP_HOST || !recipient) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
      : undefined,
  });
}

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/contact-data', (_request, response) => {
  if (!phoneNumber.trim() || !email.trim()) {
    response.status(503).json({ error: 'unable to load contact data' });
    return;
  }

  response.json({
    email: email,
    tel: phoneNumber
  });
});

app.post('/api/contact', async (request, response) => {
  const { name, email, message } = request.body || {};

  if (!requiredString(name) || !requiredString(email)) {
    response.status(400).json({ error: 'name and email are required' });
    return;
  }

  if (!isEmail(email)) {
    response.status(400).json({ error: 'enter a valid email' });
    return;
  }

  const transport = createTransport();
  if (!transport) {
    response.status(503).json({ error: 'mail service is not configured' });
    return;
  }

  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || email,
      replyTo: email,
      to: recipient,
      subject: `Dimundi contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message || 'No message provided.'}`,
    });

    response.status(202).json({ ok: true });
  } catch (error) {
    console.error('Mail delivery failed:', error);
    response.status(502).json({ error: 'mail delivery failed' });
  }
});

app.listen(port, () => {
  console.log(`Dimundi contact API listening on ${port}`);
});
