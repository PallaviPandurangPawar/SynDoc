const dns = require('dns');
const path = require('path');
const dotenv = require('dotenv');

// Ensure reliable DNS resolution for MongoDB Atlas SRV records on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Login tokens are signed with JWT_SECRET. If it is missing, short, or a value
// that was published in the project files, anyone could forge a login token,
// so the server refuses to start instead of silently using a weak default.
const MIN_SECRET_LENGTH = 32;
const PUBLISHED_SECRETS = ['syncdoc_super_secret_jwt_key_2024'];

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < MIN_SECRET_LENGTH || PUBLISHED_SECRETS.includes(secret)) {
  console.error('❌ JWT_SECRET is missing, too short (under 32 characters), or a known example value.');
  console.error('👉 Generate one with:');
  console.error('   node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  console.error('👉 Then put it in backend/.env as JWT_SECRET=<the generated value>');
  process.exit(1);
}