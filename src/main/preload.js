const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Auth
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    logout: () => ipcRenderer.invoke('auth:logout'),
    check: () => ipcRenderer.invoke('auth:check'),
    getUser: () => ipcRenderer.invoke('auth:user'),

    // Config
    getConfigUrl: () => ipcRenderer.invoke('config:get-url'),
    setConfigUrl: (url) => ipcRenderer.invoke('config:set-url', url),
    getPrintSilent: () => ipcRenderer.invoke('config:get-print-silent'),
    setPrintSilent: (value) => ipcRenderer.invoke('config:set-print-silent', value),

    // Print
    printDirect: (html) => ipcRenderer.invoke('print:direct', html),

    // API CRUD
    get: (endpoint) => ipcRenderer.invoke('api:get', endpoint),
    post: (endpoint, data) => ipcRenderer.invoke('api:post', endpoint, data),
    put: (endpoint, data) => ipcRenderer.invoke('api:put', endpoint, data),
    patch: (endpoint, data) => ipcRenderer.invoke('api:patch', endpoint, data),
    delete: (endpoint) => ipcRenderer.invoke('api:delete', endpoint),

    // Eventos
    onAuthExpired: (callback) => ipcRenderer.on('auth:expired', () => callback()),
});
