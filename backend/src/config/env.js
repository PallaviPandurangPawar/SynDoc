const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'syncdoc_super_secret_jwt_key_2024';
}

