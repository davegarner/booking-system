'use strict';

/**
 * backend.js — call the Apps Script JSON API (doPost) from the main process.
 *
 * Running this in the main process (Node) instead of the renderer means there's
 * no browser CORS to fight, and the ID token never lives in the web layer.
 * Body is sent as text/plain (Apps Script reads e.postData.contents regardless);
 * the web app responds via a 302 to googleusercontent that fetch follows.
 *
 * Always resolves to { ok, result } | { ok:false, error } — never throws — so
 * the caller can map it cleanly onto the renderer's promise.
 */

async function callBackend(execUrl, idToken, action, args) {
  let res;
  try {
    res = await fetch(execUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, idToken, args: args || [] }),
      redirect: 'follow'
    });
  } catch (e) {
    return { ok: false, error: 'Network error contacting the server: ' + (e && e.message ? e.message : e) };
  }

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && typeof json.ok === 'boolean') return json;
    return { ok: false, error: 'Unexpected response from the server.' };
  } catch (e) {
    // Almost always: the deployment isn't "Anyone, even anonymous", so Google
    // returned an HTML login/redirect page instead of our JSON.
    return {
      ok: false,
      error: 'The server did not return JSON (HTTP ' + res.status + '). Check that the desktop ' +
             'deployment’s access is set to "Anyone, even anonymous" and the /exec URL is correct.'
    };
  }
}

module.exports = { callBackend };
