import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');

// Simple .env parser to avoid extra dependencies
const getEnvValue = (key) => {
  if (!fs.existsSync(envPath)) return null;
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const [k, ...v] = line.split('=');
    if (k.trim() === key) {
      return v.join('=').trim().replace(/['"]/g, '');
    }
  }
  return null;
};

const hash = (str) => crypto.createHash('sha256').update(str).digest('hex');

const authId = getEnvValue('VITE_AUTH_ID') || 'admin';
const authPw = getEnvValue('VITE_AUTH_PW') || '1234';

const config = {
  idHash: hash(authId),
  pwHash: hash(authPw),
  updatedAt: new Date().toISOString()
};

const outputPath = path.join(__dirname, '../src/authConfig.json');
fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

console.log('✅ [SECURITY] Auth hashes updated successfully in src/authConfig.json');
