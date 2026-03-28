require('dotenv').config();
const { PKPass } = require('passkit-generator');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CERTS_DIR = path.join(__dirname, '../certs');
const TEMPLATE_DIR = path.join(__dirname, '../template');

// Certs come from base64 env vars (Vercel) or PEM files (local dev)
function getCerts() {
  if (process.env.SIGNER_CERT) {
    return {
      wwdr: Buffer.from(process.env.WWDR_CERT, 'base64'),
      signerCert: Buffer.from(process.env.SIGNER_CERT, 'base64'),
      signerKey: Buffer.from(process.env.SIGNER_KEY, 'base64'),
      signerKeyPassphrase: process.env.CERT_PASSPHRASE || ''
    };
  }
  return {
    wwdr: fs.readFileSync(path.join(CERTS_DIR, 'wwdr.pem')),
    signerCert: fs.readFileSync(path.join(CERTS_DIR, 'signerCert.pem')),
    signerKey: fs.readFileSync(path.join(CERTS_DIR, 'signerKey.pem')),
    signerKeyPassphrase: process.env.CERT_PASSPHRASE || ''
  };
}

function isApril6() {
  const now = new Date();
  return now.getMonth() === 3 && now.getDate() === 6; // 0-indexed month
}

async function buildPass() {
  // Read template pass.json and modify dynamically
  const passJson = JSON.parse(
    fs.readFileSync(path.join(TEMPLATE_DIR, 'pass.json'), 'utf8')
  );

  // On April 6, update the status field so the changeMessage fires as a notification
  if (isApril6()) {
    passJson.eventTicket.auxiliaryFields[0].value = "Today is Mohamed's Birthday! 🎉";
  }

  // Write modified pass.json + copy images to /tmp so we can build from there
  const tmpDir = path.join(os.tmpdir(), `birthday-pass-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const files = fs.readdirSync(TEMPLATE_DIR);
  for (const file of files) {
    if (file !== 'pass.json') {
      fs.copyFileSync(path.join(TEMPLATE_DIR, file), path.join(tmpDir, file));
    }
  }
  fs.writeFileSync(path.join(tmpDir, 'pass.json'), JSON.stringify(passJson));

  let buffer;
  try {
    const pass = await PKPass.from(
      { model: tmpDir, certificates: getCerts() },
      {
        passTypeIdentifier: process.env.PASS_TYPE_ID,
        teamIdentifier: process.env.TEAM_ID,
        webServiceURL: process.env.SERVICE_URL + '/passes',
        authenticationToken: process.env.AUTH_TOKEN
      }
    );
    buffer = await pass.getAsBuffer();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return buffer;
}

module.exports = { buildPass };
