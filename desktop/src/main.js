'use strict';

/**
 * main.js — Electron entry point for the FSW Booking desktop app.
 *
 * Startup order (this is what makes the existing UI work unchanged):
 *   1. Load config (OAuth client + desktop /exec URL).
 *   2. Sign in with Google — silently from the stored refresh token, or via the
 *      system browser the first time.
 *   3. Fetch getBootstrap() so we know who the user is and which view to show.
 *   4. Create the window; the preload exposes that bootstrap as window.FSW and a
 *      backend bridge as window.fswApi BEFORE any page script runs.
 *
 * All backend traffic flows main ⇄ Apps Script; the renderer only ever sees
 * window.fswApi.call(). Tokens never reach the web layer.
 */

const path = require('path');
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const { loadConfig } = require('./config');
const { GoogleAuth } = require('./auth');
const { callBackend } = require('./backend');

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');

let config = null;
let auth = null;
let bootstrap = null;
let mainWindow = null;

function viewToFile(view) {
  if (view === 'manager') return 'manager.html';
  if (view === 'employee') return 'employee.html';
  return 'notice.html';
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(start);
}

async function start() {
  config = loadConfig();
  if (!config.clientId || !config.execUrl) {
    dialog.showErrorBox('FSW Booking — not configured',
      'Missing OAuth client ID or the desktop /exec URL.\n\n' +
      'Copy config.example.json to config.json and fill in the values, or place a ' +
      'config.json in the app data folder. See desktop/README.md.');
    app.quit();
    return;
  }

  auth = new GoogleAuth(
    { clientId: config.clientId, clientSecret: config.clientSecret, allowedDomain: config.allowedDomain },
    path.join(app.getPath('userData'), 'auth.bin')
  );

  registerIpc();

  try {
    await auth.getIdToken();                 // silent if a refresh token exists; else system-browser sign-in
    bootstrap = await fetchBootstrap();      // identity + which view to render
  } catch (e) {
    const again = dialog.showMessageBoxSync({
      type: 'error',
      title: 'FSW Booking — sign-in failed',
      message: 'Could not sign you in.',
      detail: String(e && e.message ? e.message : e),
      buttons: ['Try again', 'Quit'],
      defaultId: 0, cancelId: 1
    });
    if (again === 0) { auth.signOut(); return start(); }
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}

async function fetchBootstrap() {
  const idToken = await auth.getIdToken();
  const res = await callBackend(config.execUrl, idToken, 'getBootstrap', []);
  if (!res.ok) throw new Error(res.error || 'Could not load your account.');
  return res.result;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180, height: 820, minWidth: 920, minHeight: 600,
    title: (bootstrap && bootstrap.companyName ? bootstrap.companyName : 'FSW') + ' Booking',
    backgroundColor: '#f6f8fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  buildMenu();

  // Open any external links (e.g. links inside meeting notes) in the real browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadFile(path.join(RENDERER_DIR, viewToFile(bootstrap.view)));
}

function registerIpc() {
  // The renderer's gcall() lands here. We attach a fresh ID token and forward.
  ipcMain.handle('fsw:call', async (_e, action, args) => {
    const idToken = await auth.getIdToken();
    const res = await callBackend(config.execUrl, idToken, action, args || []);
    if (res.ok) return res.result;            // resolves the renderer promise (like google.script.run)
    throw new Error(res.error || 'Request failed.'); // rejects it
  });

  // Synchronous bootstrap handoff for the preload.
  ipcMain.on('fsw:bootstrap', (e) => { e.returnValue = bootstrap; });
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Sign out',
          click: async () => {
            const ok = dialog.showMessageBoxSync(mainWindow, {
              type: 'question', buttons: ['Sign out', 'Cancel'], defaultId: 0, cancelId: 1,
              message: 'Sign out of FSW Booking?', detail: 'You will need to sign in with Google again.'
            });
            if (ok === 0) { auth.signOut(); app.relaunch(); app.exit(0); }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'Help',
      submenu: [
        { label: 'About FSW Booking', click: () => dialog.showMessageBox(mainWindow, {
            type: 'info', title: 'FSW Booking',
            message: 'FSW Booking — desktop',
            detail: 'Signed in as ' + (bootstrap && bootstrap.email ? bootstrap.email : 'unknown') +
                    '\nRole: ' + (bootstrap && bootstrap.role ? bootstrap.role : 'n/a') +
                    '\nVersion ' + app.getVersion()
          }) }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
