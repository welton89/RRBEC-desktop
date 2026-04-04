const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const axios = require('axios');

const store = new Store();

function getBaseUrl() {
  const currentUrl = store.get('api_url');
  // Migração automática da URL antiga para o novo middleware local
  if (!currentUrl || currentUrl.includes('squareweb.app')) {
    const newUrl = 'http://localhost:8080/api/v1';
    store.set('api_url', newUrl);
    return newUrl;
  }
  return currentUrl;
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
  // mainWindow.webContents.openDevTools();
}

// ─── Helpers de Autenticação (Middleware Go) ──────────────────────────────────

function getHeaders() {
  const user = store.get('user');
  return user && user.id ? { 'X-User-ID': String(user.id) } : {};
}

async function requestWithRetry(method, endpoint, data) {
  const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
  const url = `${getBaseUrl()}${cleanEndpoint}`;
  const headers = {
    ...getHeaders(),
    'Content-Type': 'application/json'
  };
  
  console.log(`[DEBUG_API] >>> ${method.toUpperCase()} ${url}`);
  console.log(`[DEBUG_API] >>> Headers:`, JSON.stringify(headers));
  if (data) console.log(`[DEBUG_API] >>> Body:`, JSON.stringify(data));

  try {
    const res = await axios({ 
      method, 
      url, 
      data, 
      headers
    });
    return { ok: true, data: res.data };
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data || err.message;
    console.error(`[DEBUG_API] >>> ERROR ${status || 'NET'} on ${endpoint}:`, msg);

    if (status === 401 || status === 403) {
      if (mainWindow) mainWindow.webContents.send('auth:expired');
      return { ok: false, error: 'Sessão expirada ou não autorizado.', expired: true };
    }
    return { ok: false, error: typeof msg === 'object' ? JSON.stringify(msg) : msg };
  }
}

// ─── IPC Handlers (Registrar IMEDIATAMENTE) ──────────────────────────────────
ipcMain.handle('auth:login', async (_, { username, password }) => {
  try {
    const url = `${getBaseUrl()}/login`;
    console.log(`[DEBUG_LOGIN] >>> Tentando login em: ${url}`);
    
    const res = await axios.post(url, { username, password }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    const userData = res.data;
    console.log('[DEBUG_LOGIN] >>> Resposta Completa do Servidor:', JSON.stringify(userData));

    // Busca o ID em qualquer lugar possível (id, user.id, user_id, UID, pk)
    const userId = userData.id || 
                   (userData.user && userData.user.id) || 
                   userData.user_id || 
                   userData.pk;
    
    console.log('[DEBUG_LOGIN] >>> ID Capturado:', userId);
    
    if (!userId) {
      console.warn('[DEBUG_LOGIN] >>> AVISO: Não encontramos um ID numérico. Verifique a Resposta Completa acima.');
    }

    // Normaliza para garantir que user.id exista para o getHeaders()
    if (!userData.id) userData.id = userId;
    
    store.set('user', userData);
    store.delete('access_token');
    store.delete('refresh_token');
    
    return { ok: true };
  } catch (err) {
    console.error('[DEBUG_LOGIN] >>> Falha no Login:', err.response?.data || err.message);
    return { ok: false, error: 'Erro de autenticação no servidor local.' };
  }
});

ipcMain.handle('auth:logout', () => {
  store.delete('user');
  store.delete('access_token');
  store.delete('refresh_token');
  return { ok: true };
});

ipcMain.handle('auth:check', () => {
  const user = store.get('user');
  return { authenticated: !!(user && user.id) };
});

ipcMain.handle('auth:user', () => {
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

ipcMain.handle('config:get-print-silent', () => store.get('print_silent', false));
ipcMain.handle('config:set-print-silent', (_, value) => {
  store.set('print_silent', value);
  console.log('[MAIN] Print silent mode:', value);
  return { ok: true };
});

ipcMain.handle('print:direct', async (_, html) => {
  const printSilent = store.get('print_silent', false);
  try {
    const win = new BrowserWindow({ show: false });
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise(r => win.webContents.once('did-finish-load', r));
    return new Promise((resolve) => {
      win.webContents.print({
        silent: printSilent,
        printBackground: true,
        deviceName: ''
      }, (success, errorType) => {
        win.close();
        if (success) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: 'Nenhuma impressora configurada ou disponível.' });
        }
      });
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
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
