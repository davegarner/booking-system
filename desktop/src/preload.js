'use strict';

/**
 * preload.js — the only bridge between the main process and the bundled UI.
 *
 * Runs before any page script, so it can guarantee two things the browser
 * version gets from server-side injection:
 *   - window.FSW      : the bootstrap payload (identity, role, tz, companyName, notice)
 *   - window.fswApi   : { call(action, args) } → the JSON API via the main process
 *
 * JsCommon's gcall() detects window.fswApi and routes through it, so the entire
 * existing UI works unchanged. contextIsolation is on; nothing else is exposed.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Synchronous: main fetched and cached the bootstrap before creating this window.
const bootstrap = ipcRenderer.sendSync('fsw:bootstrap');
contextBridge.exposeInMainWorld('FSW', bootstrap);

contextBridge.exposeInMainWorld('fswApi', {
  call: function (action, args) {
    return ipcRenderer.invoke('fsw:call', action, args || []);
  }
});
