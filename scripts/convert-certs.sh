#!/bin/bash
# Run from birthday-pass/ root after downloading the .cer from Apple Developer
# Usage: ./scripts/convert-certs.sh ~/Downloads/pass.cer
#
# The private key was already generated at certs/private.key
# You only need to upload certs/request.certSigningRequest to Apple and download the .cer

set -e

CER=$1
if [ -z "$CER" ]; then
  echo "Usage: $0 ~/Downloads/pass.cer"
  exit 1
fi

echo "Converting certificate..."

# Convert Apple's .cer to PEM (signerCert)
openssl x509 -inform DER -outform PEM -in "$CER" -out certs/signerCert.pem

# The signerKey.pem is already at certs/private.key — just copy it
cp certs/private.key certs/signerKey.pem

# Download Apple WWDR G4 certificate
echo "Downloading Apple WWDR G4..."
curl -s "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" -o certs/AppleWWDRCAG4.cer
openssl x509 -inform DER -outform PEM -in certs/AppleWWDRCAG4.cer -out certs/wwdr.pem

echo ""
echo "Certificates ready ✓"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Run these commands to add to Vercel:"
echo "═══════════════════════════════════════════════════"
echo ""
echo "cd $(pwd)"
echo ""

SIGNER_CERT_B64=$(base64 -i certs/signerCert.pem | tr -d '\n')
SIGNER_KEY_B64=$(base64 -i certs/signerKey.pem | tr -d '\n')
WWDR_B64=$(base64 -i certs/wwdr.pem | tr -d '\n')

echo "vercel env add SIGNER_CERT production << 'EOF'"
echo "$SIGNER_CERT_B64"
echo "EOF"
echo ""
echo "vercel env add SIGNER_KEY production << 'EOF'"
echo "$SIGNER_KEY_B64"
echo "EOF"
echo ""
echo "vercel env add WWDR_CERT production << 'EOF'"
echo "$WWDR_B64"
echo "EOF"
echo ""
echo "vercel --prod"
echo ""
echo "Then share: https://birthday-pass.vercel.app"
