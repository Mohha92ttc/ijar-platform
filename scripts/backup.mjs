#!/usr/bin/env node
/**
 * PostgreSQL backup with retention.
 * Usage: node scripts/backup.mjs
 * Env: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, BACKUP_DIR, BACKUP_KEEP_DAYS
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const backupDir = process.env.BACKUP_DIR || path.join(root, 'backups');
const keepDays = Math.max(1, parseInt(process.env.BACKUP_KEEP_DAYS || '14', 10));

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '5432';
const user = process.env.DB_USER || 'postgres';
const db = process.env.DB_NAME || 'ijar_db';
const password = process.env.DB_PASSWORD || '';

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = path.join(backupDir, `ijar_${stamp}.dump`);

const env = { ...process.env, PGPASSWORD: password };
const result = spawnSync(
  'pg_dump',
  ['-h', host, '-p', String(port), '-U', user, '-d', db, '-Fc', '-f', outFile],
  { env, encoding: 'utf8' }
);

if (result.status !== 0) {
  console.error('Backup failed:', result.stderr || result.error);
  process.exit(1);
}

console.log(`Backup written: ${outFile}`);

// Also copy uploads if present (disk mode)
const uploads = path.join(root, 'uploads');
if (fs.existsSync(uploads)) {
  const uploadsSnap = path.join(backupDir, `uploads_${stamp}`);
  fs.cpSync(uploads, uploadsSnap, { recursive: true });
  console.log(`Uploads snapshot: ${uploadsSnap}`);
}

// Retention
const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
for (const name of fs.readdirSync(backupDir)) {
  const full = path.join(backupDir, name);
  try {
    const st = fs.statSync(full);
    if (st.mtimeMs < cutoff) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`Removed old backup: ${name}`);
    }
  } catch {
    // ignore
  }
}

console.log(`Done. Retention: ${keepDays} days.`);
