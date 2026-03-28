require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pushBirthdayNotification } = require('../src/pushService');

async function main() {
  console.log('Triggering birthday push to all registered devices...');
  const result = await pushBirthdayNotification();
  console.log('Done:', result);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
