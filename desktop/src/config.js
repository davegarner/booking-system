'use strict';

/**
 * config.js — load the desktop app's runtime settings.
 *
 * The OAuth client ID/secret and the desktop /exec URL are NOT secrets in the
 * usual sense (Google explicitly treats an installed-app client secret as
 * non-confidential), but we keep them out of source control so each deployment
 * can be configured independently.
 *
 * Resolution order (first non-empty wins, per field):
 *   1. Environment variables (FSW_CLIENT_ID, FSW_CLIENT_SECRET, FSW_EXEC_URL, FSW_ALLOWED_DOMAIN)
 *   2. <userData>/config.json   — written after install on each machine
 *   3. <app>/config.json        — handy during development (gitignored)
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function loadConfig() {
  const fromUser = readJson(path.join(app.getPath('userData'), 'config.json')) || {};
  const fromApp = readJson(path.join(__dirname, '..', 'config.json')) || {};
  const merged = Object.assign({}, fromApp, fromUser);
  return {
    clientId:      process.env.FSW_CLIENT_ID      || merged.clientId      || '',
    clientSecret:  process.env.FSW_CLIENT_SECRET  || merged.clientSecret  || '',
    execUrl:       process.env.FSW_EXEC_URL       || merged.execUrl       || '',
    allowedDomain: process.env.FSW_ALLOWED_DOMAIN || merged.allowedDomain || ''
  };
}

module.exports = { loadConfig };
