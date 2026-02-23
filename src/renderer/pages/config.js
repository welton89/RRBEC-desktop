export async function renderConfig(container) {
    const currentUrl = await window.electronAPI.getConfigUrl();

    container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">🎛️ Configurações</div>
        <div class="page-subtitle">Ajustes técnicos do aplicativo</div>
      </div>
    </div>

    <div class="card" style="max-width: 600px; margin-top: 20px;">
      <h3 style="margin-bottom: 20px; color: var(--text-primary);">🌐 API e Conectividade</h3>
      
      <div class="form-group">
        <label>URL Base da API (Django)</label>
        <input type="text" id="config-api-url" class="form-control" value="${currentUrl}" placeholder="Ex: http://192.168.1.100:8000/api/v1" />
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">
          ⚠️ <strong>Atenção:</strong> Alterar esta URL fará com que o app tente se conectar a um novo servidor. Certifique-se de que a URL termina em <code>/api/v1</code> e está acessível.
        </p>
      </div>

      <div style="margin-top: 30px; display: flex; gap: 10px;">
        <button class="btn btn-primary btn-md" id="btn-save-config">💾 Salvar Configurações</button>
        <button class="btn btn-secondary btn-md" id="btn-reset-url">↺ Restaurar Localhost</button>
      </div>
    </div>

    <div class="card" style="max-width: 600px; margin-top: 20px; border-left: 4px solid var(--primary);">
      <h3 style="margin-bottom: 10px; color: var(--text-primary);">ℹ️ Sobre o Sistema</h3>
      <p style="color: var(--text-secondary); font-size: 0.85rem;">
        <strong>Versão:</strong> 1.0.0 (Desenvolvedor)<br>
        <strong>Ambiente:</strong> Produção / Local<br>
        <strong>Sessão:</strong> Ativa (Tokens persistidos)
      </p>
    </div>
  `;

    // Salvar
    document.getElementById('btn-save-config').addEventListener('click', async () => {
        const newUrl = document.getElementById('config-api-url').value.trim();
        if (!newUrl.startsWith('http')) {
            return showToast('A URL deve começar com http:// ou https://', 'error');
        }

        const r = await window.electronAPI.setConfigUrl(newUrl);
        if (r.ok) {
            showToast('Configurações salvas! Reiniciando conexões...', 'success');
        } else {
            showToast('Erro ao salvar configurações.', 'error');
        }
    });

    // Restaurar
    document.getElementById('btn-reset-url').addEventListener('click', async () => {
        const defaultUrl = 'http://localhost:8000/api/v1';
        document.getElementById('config-api-url').value = defaultUrl;
        await window.electronAPI.setConfigUrl(defaultUrl);
        showToast('URL restaurada para o padrão localhost.', 'info');
    });
}
