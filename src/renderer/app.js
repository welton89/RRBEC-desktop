// ─── Imports de Páginas ───────────────────────────────────────────────────────
// Cada página exporta uma função render() que retorna uma string HTML
// e opcionalmente uma função init() chamada após inserção no DOM.

import { renderDashboard } from './pages/dashboard.js';
import { renderMesas } from './pages/mesas.js';
import { renderComandas } from './pages/comandas.js';
import { renderPedidos } from './pages/pedidos.js';
import { renderProdutos } from './pages/produtos.js';
import { renderClientes } from './pages/clientes.js';
import { renderPagamentos } from './pages/pagamentos.js';
import { renderLogin } from './pages/login.js';
import { renderConfig } from './pages/config.js';

// ─── Roteador ────────────────────────────────────────────────────────────────
const PAGES = {
    dashboard: renderDashboard,
    mesas: renderMesas,
    comandas: renderComandas,
    pedidos: renderPedidos,
    produtos: renderProdutos,
    clientes: renderClientes,
    pagamentos: renderPagamentos,
    config: renderConfig,
};

let currentPage = null;
let currentUser = null;

async function navigate(page) {
    if (currentPage === page) return;
    currentPage = page;

    // Highlight sidebar
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });

    const container = document.getElementById('page-container');
    container.innerHTML = `<div class="loading-screen"><div class="spinner"></div> Carregando...</div>`;

    const renderer = PAGES[page];
    if (renderer) await renderer(container);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function checkAuthAndRender() {
    const { authenticated } = await window.electronAPI.check();
    if (!authenticated) {
        showLogin();
    } else {
        // Carrega dados do usuário
        currentUser = await window.electronAPI.getUser();
        if (currentUser) {
            document.getElementById('user-display-name').textContent = currentUser.first_name || currentUser.username;
            document.getElementById('user-initials').textContent = (currentUser.first_name?.[0] || currentUser.username?.[0] || '?').toUpperCase();
        }

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        if (!currentPage) navigate('dashboard');
    }
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    renderLogin();
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

// ─── Toast Global ─────────────────────────────────────────────────────────────
window.showToast = function (message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
};

// ─── Modal Global ─────────────────────────────────────────────────────────────
window.openModal = function ({ title, body, footer = '', full = false }) {
    const box = document.querySelector('.modal-box');
    box.classList.toggle('modal-full', full);

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer;
    document.getElementById('modal-overlay').classList.remove('hidden');
};

window.closeModal = function () {
    document.getElementById('modal-overlay').classList.add('hidden');
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Debug: Captura erros globais
    window.onerror = (msg, url, line) => {
        console.error(`[RENDERER ERROR] ${msg} at ${url}:${line}`);
        window.showToast?.('Erro interno detectado. Verifique o console.', 'error');
    };
    window.onunhandledrejection = (event) => {
        console.error('[RENDERER UNHANDLED REJECTION]', event.reason);
    };

    console.log('[APP] DOMContentLoaded - Initializing...');

    // Sidebar navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            console.log(`[APP] Navigating to: ${item.dataset.page}`);
            navigate(item.dataset.page);
        });
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) closeModal();
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        console.log('[APP] Logout requested');
        await window.electronAPI.logout();
        currentPage = null;
        showLogin();
    });

    await checkAuthAndRender();

    window.electronAPI.onAuthExpired(() => {
        console.warn('[APP] Session expired. Redirecting to login...');
        showToast('Sessão expirada. Por favor, entre novamente.', 'error');
        currentUser = null;
        showLogin();
    });
});

// ─── Modals Compartilhados ────────────────────────────────────────────────────

window.abrirModalObsCozinhaGlobal = function (nomeProduto, currentObs, callback) {
    const tags = ['Para viagem', 'Meia porção', 'Com ovo', 'Com leite', 'Sem cebola'];
    let selectedTags = new Set();
    const initialObs = currentObs || '';

    // Se houver observação inicial, tenta extrair as tags
    let initialText = initialObs;
    if (initialObs.includes(' | ')) {
        const parts = initialObs.split(' | ');
        initialText = parts[0];
        const tagsPart = parts[1] || '';
        tagsPart.split(', ').forEach(t => { if (t) selectedTags.add(t); });
    } else if (tags.some(t => initialObs.includes(t))) {
        // Fallback simples se não houver o divisor |
        tags.forEach(t => { if (initialObs.includes(t)) selectedTags.add(t); });
    }

    openModal({
        title: `📝 Observações: ${nomeProduto}`,
        body: `
      <div class="form-group">
        <label>Instruções Especiais</label>
        <textarea id="obs-text" class="form-control" rows="3" placeholder="Ex: Sem sal, ponto da carne...">${initialText}</textarea>
      </div>
      <div class="obs-tags">
        ${tags.map(tag => `<div class="tag-item ${selectedTags.has(tag) ? 'active' : ''}" data-tag="${tag}">${tag}</div>`).join('')}
      </div>
    `,
        footer: `
      <button class="btn btn-secondary btn-md" id="btn-obs-cancelar">Pular / Cancelar</button>
      <button class="btn btn-primary btn-md" id="btn-obs-confirmar">Confirmar</button>
    `
    });

    const textInput = document.getElementById('obs-text');
    setTimeout(() => textInput.focus(), 100);

    document.querySelectorAll('.tag-item').forEach(tagEl => {
        tagEl.addEventListener('click', () => {
            const tag = tagEl.dataset.tag;
            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
                tagEl.classList.remove('active');
            } else {
                selectedTags.add(tag);
                tagEl.classList.add('active');
            }
        });
    });

    const finalizar = () => {
        const texto = textInput.value.trim();
        const tagsStr = Array.from(selectedTags).join(', ');
        const finalObs = [texto, tagsStr].filter(x => x).join(' | ');
        closeModal();
        callback(finalObs);
    };

    document.getElementById('btn-obs-confirmar').onclick = finalizar;
    document.getElementById('btn-obs-cancelar').onclick = () => {
        closeModal();
        callback(null); // Return null instead of empty string on cancel to preserve original
    };

    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finalizar();
        }
    });
};

export { navigate, showApp, showLogin };
