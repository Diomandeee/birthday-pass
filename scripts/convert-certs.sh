#!/bin/bash
# Run from the birthday-pass/ root directory
# Usage: ./scripts/convert-certs.sh path/to/pass.p12

set -e

P12=$1
if [ -z "$P12" ]; then
  echo "Usage: $0 path/to/pass.p12"
  exit 1
fi

echo "Enter the passphrase you used when exporting from Keychain:"
read -s PASSPHRASE
echo ""

mkdir -p certs

# Extract signer cert
openssl pkcs12 -in "$P12" -clcerts -nokeys -out certs/signerCert.pem \
  -passin "pass:$PASSPHRASE" -legacy 2>/dev/null || \
openssl pkcs12 -in "$P12" -clcerts -nokeys -out certs/signerCert.pem \
  -passin "pass:$PASSPHRASE"

# Extract signer key (no passphrase on output — stored in .env)
openssl pkcs12 -in "$P12" -nocerts -nodes -out certs/signerKey.pem \
  -passin "pass:$PASSPHRASE" -legacy 2>/dev/null || \
openssl pkcs12 -in "$P12" -nocerts -nodes -out certs/signerKey.pem \
  -passin "pass:$PASSPHRASE"

# Download Apple WWDR G4 cert
echo "Downloading Apple WWDR G4 certificate..."
curl -s "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" -o certs/AppleWWDRCAG4.cer
openssl x509 -inform DER -outform PEM -in certs/AppleWWDRCAG4.cer -out certs/wwdr.pem

echo ""
echo "PEM files written to certs/  ✓"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Copy these into your Vercel environment variables:"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "SIGNER_CERT="
base64 -i certs/signerCert.pem | tr -d '\n'
echo ""
echo ""
echo "SIGNER_KEY="
base64 -i certs/signerKey.pem | tr -d '\n'
echo ""
echo ""
echo "WWDR_CERT="
base64 -i certs/wwdr.pem | tr -d '\n'
echo ""
echo ""
echo "CERT_PASSPHRASE= (leave blank — key has no passphrase)"
echo ""
