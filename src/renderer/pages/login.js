import { showApp, navigate } from '../app.js';

export function renderLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    // Configuração de URL na tela de Login
    const configToggle = document.getElementById('login-config-toggle');
    const configContainer = document.getElementById('login-config-container');
    const apiUrlInput = document.getElementById('login-api-url');
    const btnSaveUrl = document.getElementById('btn-save-login-config');

    // Carrega a URL atual
    window.electronAPI.getConfigUrl().then(url => {
        if (apiUrlInput) apiUrlInput.value = url;
    });

    configToggle?.addEventListener('click', (e) => {
        e.preventDefault();
        configContainer?.classList.toggle('hidden');
    });

    btnSaveUrl?.addEventListener('click', async () => {
        const newUrl = apiUrlInput.value.trim();
        if (!newUrl.startsWith('http')) {
            return alert('A URL deve começar com http:// ou https://');
        }
        await window.electronAPI.setConfigUrl(newUrl);
        alert('URL da API atualizada com sucesso!');
        configContainer?.classList.add('hidden');
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');
        const btnText = document.getElementById('login-btn-text');
        const spinner = document.getElementById('login-spinner');
        const errBox = document.getElementById('login-error');

        btn.disabled = true;
        btnText.textContent = 'Entrando...';
        spinner.classList.remove('hidden');
        errBox.classList.add('hidden');

        const res = await window.electronAPI.login({ username, password });

        btn.disabled = false;
        btnText.textContent = 'Entrar';
        spinner.classList.add('hidden');

        if (res.ok) {
            showApp();
            navigate('dashboard');
        } else {
            errBox.textContent = res.error || 'Erro ao fazer login.';
            errBox.classList.remove('hidden');
        }
    };
}
