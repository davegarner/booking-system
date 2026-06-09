'use strict';

/**
 * auth.js — Google sign-in for a desktop app, done the way Google requires.
 *
 * Google blocks its login pages inside embedded webviews, so we use the
 * "OAuth 2.0 for native apps" flow: open the SYSTEM browser, receive the result
 * on a loopback HTTP server (http://127.0.0.1:<random-port>), and protect the
 * exchange with PKCE. We request only `openid email profile` — enough to get an
 * ID token that proves who the user is. That ID token is what the Apps Script
 * backend verifies (see src/Auth.gs:verifyGoogleIdToken_).
 *
 * The long-lived refresh token is stored encrypted at rest via Electron's
 * safeStorage (OS-backed — DPAPI on Windows), so the user signs in once and is
 * silently re-authenticated on subsequent launches.
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const { shell, safeStorage } = require('electron');

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'openid email profile';
const SIGNIN_TIMEOUT_MS = 5 * 60 * 1000;

const DONE_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>FSW Booking</title>' +
  '<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f6f8fb;color:#1a2b4a;' +
  'display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}' +
  '.c{background:#fff;padding:32px 40px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.08);text-align:center}' +
  'h1{font-size:18px;margin:0 0 6px}p{margin:0;color:#5a6b86}</style></head>' +
  '<body><div class="c"><h1>✅ Signed in</h1><p>You can close this tab and return to the FSW Booking app.</p></div></body></html>';

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a JWT payload without verifying (used only to read our own token's exp). */
function decodeJwt(jwt) {
  try {
    const part = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(part, 'base64').toString('utf8'));
  } catch (e) { return null; }
}

class GoogleAuth {
  /**
   * @param {{clientId:string, clientSecret:string, allowedDomain:string}} config
   * @param {string} storePath  file path for the encrypted refresh token
   */
  constructor(config, storePath) {
    this.config = config;
    this.storePath = storePath;
    this.idToken = null;
    this.idTokenExpMs = 0;
    this.redirectUri = null;
    this.refreshToken = this._loadRefreshToken();
  }

  hasStoredSession() { return !!this.refreshToken; }

  /** A valid ID token, refreshing or prompting interactively as needed. */
  async getIdToken() {
    if (this.idToken && Date.now() < this.idTokenExpMs - 60000) return this.idToken;
    if (this.refreshToken) {
      try { await this._refresh(); return this.idToken; }
      catch (e) { this.refreshToken = null; /* stale/revoked — fall through to interactive */ }
    }
    await this.signInInteractive();
    return this.idToken;
  }

  signOut() {
    this.idToken = null;
    this.idTokenExpMs = 0;
    this.refreshToken = null;
    try { if (fs.existsSync(this.storePath)) fs.unlinkSync(this.storePath); } catch (e) { /* ignore */ }
  }

  /* ----------------------------- token storage --------------------------- */

  _loadRefreshToken() {
    try {
      if (!fs.existsSync(this.storePath)) return null;
      if (!safeStorage.isEncryptionAvailable()) return null;
      return safeStorage.decryptString(fs.readFileSync(this.storePath)) || null;
    } catch (e) { return null; }
  }

  _saveRefreshToken(token) {
    if (!token) return;
    this.refreshToken = token;
    try {
      if (safeStorage.isEncryptionAvailable()) {
        fs.writeFileSync(this.storePath, safeStorage.encryptString(token));
      }
    } catch (e) { /* non-fatal: user just signs in again next launch */ }
  }

  _applyTokenResponse(json) {
    if (json.id_token) {
      this.idToken = json.id_token;
      const claims = decodeJwt(json.id_token);
      this.idTokenExpMs = (claims && claims.exp) ? claims.exp * 1000 : Date.now() + 55 * 60 * 1000;
    }
    if (json.refresh_token) this._saveRefreshToken(json.refresh_token);
  }

  /* ------------------------------- flows --------------------------------- */

  async _refresh() {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.config.clientId
    });
    if (this.config.clientSecret) body.set('client_secret', this.config.clientSecret);

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) throw new Error('Token refresh failed (' + res.status + ').');
    this._applyTokenResponse(await res.json());
  }

  signInInteractive() {
    return new Promise((resolve, reject) => {
      const verifier = b64url(crypto.randomBytes(32));
      const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
      const state = b64url(crypto.randomBytes(16));
      let settled = false;
      const finish = (fn, arg) => { if (settled) return; settled = true; try { server.close(); } catch (e) {} fn(arg); };

      const server = http.createServer(async (req, res) => {
        let url;
        try { url = new URL(req.url, 'http://127.0.0.1'); } catch (e) { res.writeHead(400); res.end(); return; }
        if (!url.searchParams.has('code') && !url.searchParams.has('error')) { res.writeHead(404); res.end(); return; }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(DONE_HTML);

        const err = url.searchParams.get('error');
        if (err) return finish(reject, new Error('Sign-in was cancelled or failed (' + err + ').'));
        if (url.searchParams.get('state') !== state) return finish(reject, new Error('Sign-in state mismatch; please try again.'));
        try {
          await this._exchangeCode(url.searchParams.get('code'), verifier);
          finish(resolve);
        } catch (e) { finish(reject, e); }
      });

      server.on('error', (e) => finish(reject, e));
      server.listen(0, '127.0.0.1', () => {
        this.redirectUri = 'http://127.0.0.1:' + server.address().port;
        const params = new URLSearchParams({
          client_id: this.config.clientId,
          redirect_uri: this.redirectUri,
          response_type: 'code',
          scope: SCOPE,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent',
          state
        });
        if (this.config.allowedDomain) params.set('hd', this.config.allowedDomain);
        shell.openExternal(AUTH_ENDPOINT + '?' + params.toString());
      });

      setTimeout(() => finish(reject, new Error('Sign-in timed out. Please try again.')), SIGNIN_TIMEOUT_MS);
    });
  }

  async _exchangeCode(code, verifier) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      redirect_uri: this.redirectUri,
      code_verifier: verifier
    });
    if (this.config.clientSecret) body.set('client_secret', this.config.clientSecret);

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) throw new Error('Token exchange failed (' + res.status + '): ' + (await res.text()));
    this._applyTokenResponse(await res.json());
  }
}

module.exports = { GoogleAuth };
