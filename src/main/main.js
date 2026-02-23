const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const axios = require('axios');

const store = new Store();

function getBaseUrl() {
  return store.get('api_url', 'http://localhost:8000/api/v1');
}

// ─── Janela Principal ────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    frame: true,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.webContents.openDevTools();
}

// ─── Helpers de Token ────────────────────────────────────────────────────────
let isRefreshing = false;
let refreshPromise = null;

function getHeaders() {
  const token = store.get('access_token');
  // console.log('[MAIN] getHeaders - Token exists:', !!token);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshAccessToken() {
  if (isRefreshing) {
    console.log('[JWT] Refresh already in progress, waiting...');
    return refreshPromise;
  }

  const refresh = store.get('refresh_token');
  if (!refresh) {
    console.error('[JWT] No refresh token available.');
    throw new Error('No refresh token');
  }

  isRefreshing = true;
  console.log('[JWT] Starting token refresh flow...');

  refreshPromise = axios.post(`${getBaseUrl()}/token/refresh/`, { refresh })
    .then(res => {
      const { access, refresh: newRefresh } = res.data;
      store.set('access_token', access);
      if (newRefresh) {
        store.set('refresh_token', newRefresh);
        console.log('[JWT] Refresh token rotated and updated.');
      }
      console.log('[JWT] Access token updated successfully.');
      return access;
    })
    .catch(err => {
      console.error('[JWT] Refresh Failed:', err.response?.data || err.message);
      // Limpa tudo se o refresh falhar (refresh_token expirou definitivamente)
      store.delete('access_token');
      store.delete('refresh_token');
      store.delete('user');
      throw err;
    })
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}

async function requestWithRetry(method, endpoint, data) {
  const url = `${getBaseUrl()}${endpoint}`;
  console.log(`[API] ${method.toUpperCase()} ${url}`);

  try {
    const res = await axios({ method, url, data, headers: getHeaders() });
    return { ok: true, data: res.data };
  } catch (err) {
    const status = err.response?.status;

    // Se for 401 ou 403, tentamos o refresh uma única vez
    if ((status === 401 || status === 403) && store.get('refresh_token')) {
      console.warn(`[API] ${status} Unauthorized/Forbidden on ${endpoint}. Attempting refresh...`);
      try {
        await refreshAccessToken();
        // Tenta a requisição original novamente com o novo header
        const retryRes = await axios({ method, url, data, headers: getHeaders() });
        console.log(`[API] Retry successful for ${endpoint}`);
        return { ok: true, data: retryRes.data };
      } catch (refreshErr) {
        console.error(`[API] Retry failed after refresh for ${endpoint}`);
        if (mainWindow) mainWindow.webContents.send('auth:expired');
        return { ok: false, error: 'Sessão expirada. Faça login novamente.', expired: true };
      }
    }

    const msg = err.response?.data || err.message;
    console.error(`[API ERROR] ${status || 'NET'} ${endpoint}:`, msg);
    return { ok: false, error: typeof msg === 'object' ? JSON.stringify(msg) : msg };
  }
}

// ─── IPC Handlers (Registrar IMEDIATAMENTE) ──────────────────────────────────
ipcMain.handle('auth:login', async (_, { username, password }) => {
  try {
    const res = await axios.post(`${getBaseUrl()}/token/`, { username, password });
    console.log('[MAIN] Login Successful. User:', res.data.user?.username);
    store.set('access_token', res.data.access);
    store.set('refresh_token', res.data.refresh);
    store.set('user', res.data.user);
    return { ok: true };
  } catch (err) {
    console.error('[MAIN] Login Failed:', err.response?.data || err.message);
    return { ok: false, error: 'Credenciais inválidas.' };
  }
});

ipcMain.handle('auth:logout', () => {
  store.delete('access_token');
  store.delete('refresh_token');
  store.delete('user');
  return { ok: true };
});

ipcMain.handle('auth:check', () => ({ authenticated: !!store.get('access_token') }));

ipcMain.handle('auth:user', () => {
  console.log('[MAIN] IPC auth:user requested.');
  return store.get('user');
});

ipcMain.handle('api:get', (_, endpoint) => requestWithRetry('get', endpoint));
ipcMain.handle('api:post', (_, endpoint, data) => requestWithRetry('post', endpoint, data));
ipcMain.handle('api:put', (_, endpoint, data) => requestWithRetry('put', endpoint, data));
ipcMain.handle('api:patch', (_, endpoint, data) => requestWithRetry('patch', endpoint, data));
ipcMain.handle('api:delete', (_, endpoint) => requestWithRetry('delete', endpoint));

ipcMain.handle('config:get-url', () => getBaseUrl());
ipcMain.handle('config:set-url', (_, url) => {
  store.set('api_url', url);
  console.log('[MAIN] API URL updated to:', url);
  return { ok: true };
});

// ─── Lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
