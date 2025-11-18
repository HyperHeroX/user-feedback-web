import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'feedback.db');

const db = new Database(dbPath);

// Insert initial settings with autoReplyTimerSeconds
const result = db.prepare(`
  INSERT INTO ai_settings (api_url, model, api_key, system_prompt, temperature, max_tokens, auto_reply_timer_seconds)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  'https://generativelanguage.googleapis.com/v1beta',
  'gemini-2.0-flash-exp',
  'ENCRYPTED_KEY_PLACEHOLDER',
  'You are a helpful AI assistant.',
  0.7,
  1000,
  100  // Set to 100 as user tested
);

console.log('Inserted new record, ID:', result.lastInsertRowid);

// Verify
const row = db.prepare('SELECT id, auto_reply_timer_seconds FROM ai_settings ORDER BY id DESC LIMIT 1').get();
console.log('Verification - Latest auto_reply_timer_seconds:', row);

db.close();
