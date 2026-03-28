require('dotenv').config();
const apn = require('@parse/node-apn');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const CERTS_DIR = path.join(__dirname, '../certs');

async function pushBirthdayNotification() {
  const { data: registrations, error } = await db
    .from('birthday_pass_registrations')
    .select('push_token');

  if (error) {
    console.error('DB error:', error);
    return { sent: 0, failed: 0, error: error.message };
  }

  if (!registrations?.length) {
    console.log('No registrations found.');
    return { sent: 0, failed: 0 };
  }

  console.log(`Pushing to ${registrations.length} devices...`);

  const provider = new apn.Provider({
    cert: fs.readFileSync(path.join(CERTS_DIR, 'signerCert.pem')),
    key: fs.readFileSync(path.join(CERTS_DIR, 'signerKey.pem')),
    passphrase: process.env.CERT_PASSPHRASE || '',
    production: true
  });

  // Empty payload is correct for Wallet passes — tells the device to fetch
  // the updated pass from the server. The changeMessage in pass.json controls
  // what text appears on the lock screen notification.
  const notification = new apn.Notification();
  notification.topic = process.env.PASS_TYPE_ID;
  notification.payload = {};

  const tokens = registrations.map(r => r.push_token);
  const result = await provider.send(notification, tokens);

  provider.shutdown();

  console.log(`Sent: ${result.sent.length}, Failed: ${result.failed.length}`);
  if (result.failed.length) console.error('Failures:', result.failed);

  return {
    sent: result.sent.length,
    failed: result.failed.length,
    errors: result.failed
  };
}

module.exports = { pushBirthdayNotification };
