import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'feedback.db');
console.log('Database path:', dbPath);

const db = new Database(dbPath);

// Check schema
const cols = db.prepare('PRAGMA table_info(ai_settings)').all();
console.log('\nColumns in ai_settings:');
cols.forEach(c => {
  console.log(`  ${c.name} (${c.type})`);
});

// Check current value
try {
  const row = db.prepare('SELECT id, auto_reply_timer_seconds FROM ai_settings ORDER BY id DESC LIMIT 1').get();
  console.log('\nLatest auto_reply_timer_seconds:', row);
} catch (e) {
  console.log('\nError querying auto_reply_timer_seconds:', e.message);
}

// Show all records
const allRows = db.prepare('SELECT id, auto_reply_timer_seconds FROM ai_settings').all();
console.log('\nAll ai_settings records:');
allRows.forEach(row => {
  console.log(`  id=${row.id}, auto_reply_timer_seconds=${row.auto_reply_timer_seconds}`);
});

db.close();
