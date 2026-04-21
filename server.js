const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);
const MAIL_FROM = process.env.MAIL_FROM || 'TUNIFIX <no-reply@tunifix.tn>';
const MAIL_REQUIRED = String(process.env.MAIL_REQUIRED || 'false').toLowerCase() === 'true';
const DEFAULT_TECH_ID = 'tech-ali-ben-salah';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(PUBLIC_DIR));

function nowIso() {
  return new Date().toISOString();
}
function uid(prefix) {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
function safeString(value) {
  return String(value || '').trim();
}
function parseBool(value, defaultValue = false) {
  if (value == null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}
function getAllUsers(db) {
  return [...db.clients, ...db.technicians];
}
function sessionPayload(user) {
  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    city: user.city,
    specialty: user.specialty,
    experience: user.experience,
    profileImage: user.profileImage || '',
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000).toISOString()
  };
}
function publicTechnician(tech, db) {
  const reviews = db.reviews.filter((r) => r.technicianId === tech.id);
  const averageRating = reviews.length ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length : 0;
  return {
    id: tech.id,
    role: 'technician',
    fullName: tech.fullName,
    email: tech.email,
    phone: tech.phone,
    city: tech.city,
    specialty: tech.specialty,
    experience: tech.experience,
    profileImage: tech.profileImage || '',
    averageRating,
    reviewCount: reviews.length,
    createdAt: tech.createdAt
  };
}
function recalculateTechnicians(db) {
  db.technicians = db.technicians.map((tech) => {
    const reviews = db.reviews.filter((r) => r.technicianId === tech.id);
    tech.averageRating = reviews.length ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length : 0;
    tech.reviewCount = reviews.length;
    return tech;
  });
}
function pushNotification(db, { userId = null, email = '', subject = '', message = '' }) {
  const item = { id: uid('notif'), userId, email, subject, message, createdAt: nowIso() };
  db.notifications.unshift(item);
  return item;
}
function cleanupExpired(db) {
  const now = Date.now();
  for (const [token, session] of Object.entries(db.sessions || {})) {
    if (!session || !session.expiresAt || new Date(session.expiresAt).getTime() < now) {
      delete db.sessions[token];
    }
  }
  for (const [token, reset] of Object.entries(db.passwordResets || {})) {
    if (!reset || !reset.expiresAt || new Date(reset.expiresAt).getTime() < now || reset.usedAt) {
      if (reset?.usedAt || new Date(reset?.expiresAt || 0).getTime() < now) delete db.passwordResets[token];
    }
  }
}
function findCurrentUser(req, db) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const session = db.sessions[token];
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    delete db.sessions[token];
    writeDb(db);
    return null;
  }
  return getAllUsers(db).find((u) => u.id === session.userId) || null;
}
function createSession(db, user) {
  const token = uid('token');
  db.sessions[token] = {
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000).toISOString()
  };
  return { token, user: sessionPayload(user), session: sessionPayload(user) };
}

let transporterPromise;
async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = parseBool(process.env.SMTP_SECURE, port === 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) return null;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
    await transporter.verify();
    return transporter;
  })();
  return transporterPromise;
}
async function sendMail({ to, subject, text, html }) {
  const transporter = await getTransporter();
  if (!transporter) {
    if (MAIL_REQUIRED) throw new Error('SMTP is not configured');
    console.log('[MAIL SKIPPED] No SMTP configuration. To:', to, 'Subject:', subject);
    return { skipped: true };
  }
  return transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
}
async function notifyAndEmail(db, payload) {
  pushNotification(db, payload);
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#103c3b">
      <h2 style="margin:0 0 12px;color:#083d3c">TUNIFIX</h2>
      <p style="white-space:pre-line">${escapeHtml(payload.message)}</p>
    </div>`;
  const text = payload.message;
  try {
    await sendMail({ to: payload.email, subject: payload.subject, text, html });
  } catch (error) {
    console.error('Mail error:', error.message);
    if (MAIL_REQUIRED) throw error;
  }
}
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function requireUser(req, res, db) {
  const user = findCurrentUser(req, db);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) return;
  const now = nowIso();
  const db = {
    version: 1,
    clients: [
      { id: 'client-demo', role: 'client', fullName: 'Client Demo', email: 'client@tunifix.tn', phone: '20111222', city: 'Monastir', password: 'Client@123', createdAt: now }
    ],
    technicians: [
      { id: DEFAULT_TECH_ID, role: 'technician', fullName: 'Ali Ben Salah', email: 'ali@tunifix.tn', phone: '22111222', city: 'Monastir', specialty: 'Électricité', experience: '5 ans d’expérience', password: 'Tech@123', createdAt: now },
      { id: 'tech-sami-jlassi', role: 'technician', fullName: 'Sami Jlassi', email: 'sami@tunifix.tn', phone: '25111222', city: 'Sousse', specialty: 'Plomberie', experience: '7 ans d’expérience', password: 'Tech@123', createdAt: now },
      { id: 'tech-mariem-trabelsi', role: 'technician', fullName: 'Mariem Trabelsi', email: 'mariem@tunifix.tn', phone: '27111222', city: 'Tunis', specialty: 'Climatisation', experience: '6 ans d’expérience', password: 'Tech@123', createdAt: now }
    ],
    reviews: [
      { id: uid('review'), technicianId: DEFAULT_TECH_ID, clientId: 'seed-a', requestId: 'request-seed-reviewed', name: 'Nadia', rating: 5, comment: 'Service rapide et professionnel.', createdAt: now },
      { id: uid('review'), technicianId: 'tech-sami-jlassi', clientId: 'seed-b', requestId: 'request-seed-2', name: 'Maher', rating: 4, comment: 'Très bon travail, ponctuel.', createdAt: now },
      { id: uid('review'), technicianId: 'tech-mariem-trabelsi', clientId: 'seed-c', requestId: 'request-seed-3', name: 'Sarra', rating: 5, comment: 'Excellente technicienne.', createdAt: now }
    ],
    requests: [
      { id: 'request-seed-reviewed', clientId: 'client-demo', fullName: 'Client Demo', email: 'client@tunifix.tn', phone: '20111222', city: 'Monastir', service: 'Électricité', urgency: 'Normale', title: 'Prise murale en panne', description: 'La prise ne fonctionne plus dans le salon.', images: [], status: 'completed', assignedTechnicianId: DEFAULT_TECH_ID, assignedTechnicianName: 'Ali Ben Salah', reviewByClientId: 'client-demo', createdAt: now },
      { id: 'request-seed-pending-review', clientId: 'client-demo', fullName: 'Client Demo', email: 'client@tunifix.tn', phone: '20111222', city: 'Monastir', service: 'Plomberie', urgency: 'Urgente', title: 'Fuite sous évier', description: 'J’ai une fuite sous l’évier de la cuisine.', images: [], status: 'completed', assignedTechnicianId: 'tech-sami-jlassi', assignedTechnicianName: 'Sami Jlassi', reviewByClientId: null, createdAt: now },
      { id: 'request-seed-open', clientId: 'client-demo', fullName: 'Client Demo', email: 'client@tunifix.tn', phone: '20111222', city: 'Monastir', service: 'Climatisation', urgency: 'Normale', title: 'Climatiseur à vérifier', description: 'Besoin d’un diagnostic pour la clim.', images: [], status: 'open', assignedTechnicianId: null, assignedTechnicianName: null, reviewByClientId: null, createdAt: now }
    ],
    notifications: [],
    sessions: {},
    passwordResets: {}
  };
  recalculateTechnicians(db);
  writeDb(db);
}

app.get('/api/health', async (req, res) => {
  try {
    const transporter = await getTransporter();
    res.json({ ok: true, smtpConfigured: Boolean(transporter) });
  } catch (error) {
    res.json({ ok: true, smtpConfigured: false, smtpError: error.message });
  }
});

app.get('/api/me', (req, res) => {
  const db = readDb();
  cleanupExpired(db);
  const user = requireUser(req, res, db);
  if (!user) return;
  writeDb(db);
  res.json({ session: sessionPayload(user) });
});

app.post('/api/logout', (req, res) => {
  const db = readDb();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token && db.sessions[token]) delete db.sessions[token];
  writeDb(db);
  res.json({ ok: true });
});

// Public auth routes: no session required
app.post('/api/register/client', async (req, res) => {
  const db = readDb();
  const email = normalizeEmail(req.body.email);
  if (getAllUsers(db).some((u) => u.email.toLowerCase() === email)) return res.status(400).json({ error: 'Email already exists' });
  const user = {
    id: uid('client'), role: 'client', fullName: safeString(req.body.fullName), email,
    phone: safeString(req.body.phone), city: safeString(req.body.city), password: String(req.body.password || ''), createdAt: nowIso()
  };
  db.clients.push(user);
  const payload = createSession(db, user);
  await notifyAndEmail(db, { userId: user.id, email: user.email, subject: 'Bienvenue sur TUNIFIX', message: `Bonjour ${user.fullName}, votre compte client a été créé avec succès.` });
  writeDb(db);
  res.json(payload);
});

app.post('/api/register/technician', async (req, res) => {
  const db = readDb();
  const email = normalizeEmail(req.body.email);
  if (getAllUsers(db).some((u) => u.email.toLowerCase() === email)) return res.status(400).json({ error: 'Email already exists' });
  const user = {
    id: uid('tech'), role: 'technician', fullName: safeString(req.body.fullName), email,
    phone: safeString(req.body.phone), city: safeString(req.body.city), specialty: safeString(req.body.specialty),
    experience: safeString(req.body.experience), profileImage: safeString(req.body.profileImage), password: String(req.body.password || ''), createdAt: nowIso()
  };
  db.technicians.push(user);
  recalculateTechnicians(db);
  const payload = createSession(db, user);
  await notifyAndEmail(db, { userId: user.id, email: user.email, subject: 'Bienvenue sur TUNIFIX', message: `Bonjour ${user.fullName}, votre compte technicien a été créé avec succès.` });
  writeDb(db);
  res.json(payload);
});

app.post('/api/login/client', async (req, res) => {
  await handleLogin(req, res, 'client');
});
app.post('/api/login/technician', async (req, res) => {
  await handleLogin(req, res, 'technician');
});
async function handleLogin(req, res, role) {
  const db = readDb();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const pool = role === 'client' ? db.clients : db.technicians;
  const user = pool.find((u) => u.email.toLowerCase() === email && String(u.password || '') === password);
  if (!user) return res.status(400).json({ error: 'Incorrect email or password' });
  const payload = createSession(db, user);
  await notifyAndEmail(db, { userId: user.id, email: user.email, subject: 'Nouvelle connexion', message: `Une connexion a été détectée sur votre compte ${user.fullName}.` });
  writeDb(db);
  res.json(payload);
}

app.post('/api/password/forgot', async (req, res) => {
  const db = readDb();
  const email = normalizeEmail(req.body.email);
  const user = getAllUsers(db).find((u) => u.email.toLowerCase() === email);
  if (user) {
    const token = uid('reset');
    db.passwordResets[token] = {
      token,
      userId: user.id,
      email,
      role: user.role,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      createdAt: nowIso(),
      usedAt: null
    };
    const resetLink = `${APP_BASE_URL}/reset-password.html?token=${encodeURIComponent(token)}`;
    const message = `Bonjour ${user.fullName},\n\nUn lien de réinitialisation du mot de passe a été demandé pour votre compte TUNIFIX.\n\nLien : ${resetLink}\n\nCe lien expire dans 1 heure.`;
    await notifyAndEmail(db, { userId: user.id, email: user.email, subject: 'Réinitialisation du mot de passe', message });
    writeDb(db);
  }
  res.json({ ok: true });
});

app.post('/api/password/reset', (req, res) => {
  const db = readDb();
  cleanupExpired(db);
  const token = safeString(req.body.token);
  const password = String(req.body.password || '');
  const record = db.passwordResets[token];
  if (!record || record.usedAt || new Date(record.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }
  const user = getAllUsers(db).find((u) => u.id === record.userId);
  if (!user) return res.status(400).json({ error: 'User not found' });
  user.password = password;
  record.usedAt = nowIso();
  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/technicians', (req, res) => {
  const db = readDb();
  cleanupExpired(db);
  recalculateTechnicians(db);
  writeDb(db);
  const technicians = [...db.technicians]
    .map((t) => publicTechnician(t, db))
    .sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0) || Number(b.reviewCount || 0) - Number(a.reviewCount || 0));
  res.json({ technicians });
});
app.get('/api/technicians/top', (req, res) => {
  const db = readDb();
  cleanupExpired(db);
  recalculateTechnicians(db);
  writeDb(db);
  const technicians = [...db.technicians]
    .map((t) => publicTechnician(t, db))
    .sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0) || Number(b.reviewCount || 0) - Number(a.reviewCount || 0));
  res.json({ technicians });
});
app.get('/api/technicians/:id', (req, res) => {
  const db = readDb();
  const tech = db.technicians.find((t) => t.id === req.params.id);
  if (!tech) return res.status(404).json({ error: 'Technician not found' });
  recalculateTechnicians(db);
  writeDb(db);
  res.json({ technician: publicTechnician(tech, db) });
});
app.get('/api/technicians/:id/reviews', (req, res) => {
  const db = readDb();
  const reviews = db.reviews.filter((r) => r.technicianId === req.params.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ reviews });
});
app.post('/api/technicians/:id/reviews', async (req, res) => {
  const db = readDb();
  const user = requireUser(req, res, db);
  if (!user) return;
  if (user.role !== 'client') return res.status(403).json({ error: 'common.clientLoginRequired' });
  const requestId = safeString(req.body.requestId);
  const request = db.requests.find((r) => r.id === requestId);
  if (!request || request.clientId !== user.id || request.status !== 'completed' || request.assignedTechnicianId !== req.params.id) {
    return res.status(400).json({ error: 'Completed request required before rating' });
  }
  if (request.reviewByClientId) return res.status(400).json({ error: 'Review already submitted' });
  const review = {
    id: uid('review'), technicianId: req.params.id, clientId: user.id, requestId: request.id,
    name: safeString(req.body.name), rating: Number(req.body.rating || 0), comment: safeString(req.body.comment), createdAt: nowIso()
  };
  db.reviews.push(review);
  request.reviewByClientId = user.id;
  recalculateTechnicians(db);
  const tech = db.technicians.find((t) => t.id === req.params.id);
  await notifyAndEmail(db, { userId: user.id, email: user.email, subject: 'Avis publié', message: `Votre avis pour ${tech?.fullName || 'le technicien'} a été enregistré.` });
  if (tech) await notifyAndEmail(db, { userId: tech.id, email: tech.email, subject: 'Nouveau avis client', message: `${user.fullName} a laissé une note de ${review.rating}/5 sur TUNIFIX.` });
  writeDb(db);
  res.json({ ok: true, review, technician: tech ? publicTechnician(tech, db) : null });
});

app.get('/api/requests', (req, res) => {
  const db = readDb();
  const user = requireUser(req, res, db);
  if (!user) return;
  const requests = user.role === 'client'
    ? db.requests.filter((r) => r.clientId === user.id)
    : [...db.requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ requests });
});
app.post('/api/requests', async (req, res) => {
  const db = readDb();
  const user = requireUser(req, res, db);
  if (!user) return;
  if (user.role !== 'client') return res.status(403).json({ error: 'common.clientLoginRequired' });
  const request = {
    id: uid('request'), clientId: user.id,
    fullName: safeString(req.body.fullName || user.fullName), email: normalizeEmail(req.body.email || user.email),
    phone: safeString(req.body.phone || user.phone), city: safeString(req.body.city || user.city),
    service: safeString(req.body.service), urgency: safeString(req.body.urgency), title: safeString(req.body.title),
    description: safeString(req.body.description), images: Array.isArray(req.body.images) ? req.body.images : [],
    status: 'open', assignedTechnicianId: null, assignedTechnicianName: null, reviewByClientId: null, createdAt: nowIso()
  };
  db.requests.unshift(request);
  await notifyAndEmail(db, { userId: user.id, email: user.email, subject: 'Demande créée', message: `Votre demande "${request.title}" a été publiée.` });
  writeDb(db);
  res.json({ request });
});
app.put('/api/requests/:id', async (req, res) => {
  const db = readDb();
  const user = requireUser(req, res, db);
  if (!user) return;
  if (user.role !== 'client') return res.status(403).json({ error: 'common.clientLoginRequired' });
  const request = db.requests.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.clientId !== user.id) return res.status(400).json({ error: 'You can only edit your own requests' });
  if (request.status !== 'open') return res.status(400).json({ error: 'Only open requests can be edited' });
  Object.assign(request, {
    fullName: safeString(req.body.fullName || request.fullName),
    email: normalizeEmail(req.body.email || request.email),
    phone: safeString(req.body.phone || request.phone),
    city: safeString(req.body.city || request.city),
    service: safeString(req.body.service || request.service),
    urgency: safeString(req.body.urgency || request.urgency),
    title: safeString(req.body.title || request.title),
    description: safeString(req.body.description || request.description),
    images: Array.isArray(req.body.images) ? req.body.images : request.images
  });
  await notifyAndEmail(db, { userId: user.id, email: user.email, subject: 'Demande mise à jour', message: `Votre demande "${request.title}" a été modifiée.` });
  writeDb(db);
  res.json({ request });
});
app.delete('/api/requests/:id', (req, res) => {
  const db = readDb();
  const user = requireUser(req, res, db);
  if (!user) return;
  if (user.role !== 'client') return res.status(403).json({ error: 'common.clientLoginRequired' });
  const index = db.requests.findIndex((r) => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Request not found' });
  const request = db.requests[index];
  if (request.clientId !== user.id) return res.status(400).json({ error: 'You can only delete your own requests' });
  if (request.status !== 'open') return res.status(400).json({ error: 'Only open requests can be deleted' });
  db.requests.splice(index, 1);
  writeDb(db);
  res.json({ ok: true });
});
app.post('/api/requests/:id/accept', async (req, res) => {
  const db = readDb();
  const user = requireUser(req, res, db);
  if (!user) return;
  if (user.role !== 'technician') return res.status(403).json({ error: 'common.techLoginRequired' });
  const request = db.requests.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'open') return res.status(400).json({ error: 'Already assigned' });
  request.status = 'assigned';
  request.assignedTechnicianId = user.id;
  request.assignedTechnicianName = user.fullName;
  const client = db.clients.find((c) => c.id === request.clientId);
  await notifyAndEmail(db, { userId: user.id, email: user.email, subject: 'Mission acceptée', message: `Vous avez accepté la mission "${request.title}".` });
  if (client) await notifyAndEmail(db, { userId: client.id, email: client.email, subject: 'Un technicien a accepté votre demande', message: `${user.fullName} a accepté votre demande "${request.title}".` });
  writeDb(db);
  res.json({ request });
});
app.post('/api/requests/:id/complete', async (req, res) => {
  const db = readDb();
  const user = requireUser(req, res, db);
  if (!user) return;
  if (user.role !== 'technician') return res.status(403).json({ error: 'common.techLoginRequired' });
  const request = db.requests.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.assignedTechnicianId !== user.id) return res.status(400).json({ error: 'Only assigned technician can complete' });
  request.status = 'completed';
  const client = db.clients.find((c) => c.id === request.clientId);
  if (client) await notifyAndEmail(db, { userId: client.id, email: client.email, subject: 'Mission terminée', message: `La mission "${request.title}" est marquée comme terminée. Vous pouvez maintenant noter le technicien depuis votre tableau de bord.` });
  await notifyAndEmail(db, { userId: user.id, email: user.email, subject: 'Mission terminée', message: `Vous avez marqué la mission "${request.title}" comme terminée.` });
  writeDb(db);
  res.json({ request });
});
app.get('/api/notifications', (req, res) => {
  const db = readDb();
  const user = requireUser(req, res, db);
  if (!user) return;
  const notifications = db.notifications.filter((n) => n.userId === user.id || normalizeEmail(n.email) === normalizeEmail(user.email));
  res.json({ notifications });
});

app.get('*', (req, res) => {
  const requested = req.path === '/' ? 'index.html' : req.path.slice(1);
  const filePath = path.join(PUBLIC_DIR, requested);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return res.sendFile(filePath);
  return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`TUNIFIX server running on ${APP_BASE_URL}`);
});
