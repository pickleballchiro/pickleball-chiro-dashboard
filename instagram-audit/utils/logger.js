const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'audit-log.txt');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function timestamp() {
  return new Date().toISOString();
}

function formatLine(level, message) {
  return `[${timestamp()}] [${level}] ${message}`;
}

function log(message) {
  const line = formatLine('INFO', message);
  console.log(line);
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function error(message, err) {
  const detail = err ? ` | ${err.message || err}` : '';
  const line = formatLine('ERROR', message + detail);
  console.error(line);
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function warn(message) {
  const line = formatLine('WARN', message);
  console.warn(line);
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function runSummary({ postsAdded, postsUpdated, errors }) {
  const line = formatLine('SUMMARY', `Run complete — Added: ${postsAdded} | Updated: ${postsUpdated} | Errors: ${errors}`);
  console.log('\n' + '='.repeat(70));
  console.log(line);
  console.log('='.repeat(70) + '\n');
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, line + '\n');
}

module.exports = { log, error, warn, runSummary };
