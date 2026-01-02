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

// [v3.3.6] 보안 강화: 환경 변수 출처 확인 및 우선순위 정립
const ciId = process.env.VITE_AUTH_ID;
const ciPw = process.env.VITE_AUTH_PW;
const localId = getEnvValue('VITE_AUTH_ID');
const localPw = getEnvValue('VITE_AUTH_PW');

const authId = ciId || localId || 'admin';
const authPw = ciPw || localPw || '1234';

const config = {
  idHash: hash(authId),
  pwHash: hash(authPw),
  updatedAt: new Date().toISOString(),
  source: ciId ? 'github-secrets' : (localId ? 'local-env' : 'system-default')
};

const outputPath = path.join(__dirname, '../src/authConfig.json');
fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

console.log(`✅ [SECURITY] Auth source: ${config.source}`);
console.log('✅ [SECURITY] Auth hashes updated successfully in src/authConfig.json');
