require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const passBuilder = require('./passBuilder');
const { pushBirthdayNotification } = require('./pushService');
const { db } = require('./db');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3333;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// ── Landing page (dynamic — injects VIDEO_URL) ────────────────────────────────
app.get('/', (req, res) => {
  let html = fs.readFileSync(
    path.join(__dirname, '../public/index.html'),
    'utf8'
  );
  html = html.replace('__VIDEO_URL__', process.env.VIDEO_URL || '');
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Static assets (CSS, images, etc.) — served AFTER the root route above
app.use(express.static(path.join(__dirname, '../public')));

// ── Auth middleware (Apple sends this on all web service calls) ───────────────
function verifyAppleAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || auth !== `ApplePass ${AUTH_TOKEN}`) {
    return res.status(401).send();
  }
  next();
}

// ── Pass download (public — this is the URL you share) ───────────────────────
app.get('/passes/pass.pkpass', async (req, res) => {
  try {
    const buffer = await passBuilder.buildPass();
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': 'attachment; filename=birthday.pkpass',
      'Last-Modified': new Date().toUTCString()
    });
    res.send(buffer);
  } catch (err) {
    console.error('Pass build error:', err);
    res.status(500).json({ error: 'Failed to generate pass' });
  }
});

// ── Apple: register device ────────────────────────────────────────────────────
app.post(
  '/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber',
  verifyAppleAuth,
  async (req, res) => {
    const { deviceId, passTypeId, serialNumber } = req.params;
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).send();

    const { data: existing } = await db
      .from('birthday_pass_registrations')
      .select('id')
      .eq('device_library_identifier', deviceId)
      .eq('serial_number', serialNumber)
      .maybeSingle();

    if (existing) return res.status(200).send();

    await db.from('birthday_pass_registrations').insert({
      device_library_identifier: deviceId,
      push_token: pushToken,
      pass_type_identifier: passTypeId,
      serial_number: serialNumber
    });

    console.log(`New registration: ${deviceId.slice(0, 8)}...`);
    res.status(201).send();
  }
);

// ── Apple: unregister device ──────────────────────────────────────────────────
app.delete(
  '/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber',
  verifyAppleAuth,
  async (req, res) => {
    const { deviceId, serialNumber } = req.params;
    await db
      .from('birthday_pass_registrations')
      .delete()
      .eq('device_library_identifier', deviceId)
      .eq('serial_number', serialNumber);
    res.status(200).send();
  }
);

// ── Apple: list passes for device ─────────────────────────────────────────────
app.get('/v1/devices/:deviceId/registrations/:passTypeId', async (req, res) => {
  const { deviceId, passTypeId } = req.params;
  const since = req.query.passesUpdatedSince;

  let query = db
    .from('birthday_pass_registrations')
    .select('serial_number, updated_at')
    .eq('device_library_identifier', deviceId)
    .eq('pass_type_identifier', passTypeId);

  if (since) {
    query = query.gt(
      'updated_at',
      new Date(parseInt(since) * 1000).toISOString()
    );
  }

  const { data } = await query;
  if (!data?.length) return res.status(204).send();

  res.json({
    serialNumbers: data.map(r => r.serial_number),
    lastUpdated: String(Math.floor(Date.now() / 1000))
  });
});

// ── Apple: return updated pass ────────────────────────────────────────────────
app.get('/v1/passes/:passTypeId/:serialNumber', verifyAppleAuth, async (req, res) => {
  try {
    const buffer = await passBuilder.buildPass();
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Last-Modified': new Date().toUTCString()
    });
    res.send(buffer);
  } catch (err) {
    res.status(500).send();
  }
});

// ── Apple: error logs ─────────────────────────────────────────────────────────
app.post('/v1/log', (req, res) => {
  console.log('[Apple Pass Log]', JSON.stringify(req.body));
  res.status(200).send();
});

// ── Vercel cron: fires April 6 at 9am ET ─────────────────────────────────────
// Vercel sends Authorization: Bearer {CRON_SECRET} to cron endpoints
app.post('/admin/cron-push', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).send();
  }
  console.log('Cron triggered: sending birthday push...');
  const result = await pushBirthdayNotification();
  res.json(result);
});

// ── Admin: manual push trigger ────────────────────────────────────────────────
app.post('/admin/push', async (req, res) => {
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).send();
  }
  const result = await pushBirthdayNotification();
  res.json(result);
});

// ── Admin: count registrations ────────────────────────────────────────────────
app.get('/admin/registrations', async (req, res) => {
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).send();
  }
  const { data, count } = await db
    .from('birthday_pass_registrations')
    .select('*', { count: 'exact' });
  res.json({ count, registrations: data });
});

app.listen(PORT, () => {
  console.log(`Birthday pass server :${PORT}`);
  console.log(`Pass URL: ${process.env.SERVICE_URL}/passes/pass.pkpass`);
});

module.exports = app; // needed for Vercel
