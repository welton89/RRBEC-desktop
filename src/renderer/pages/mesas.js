export async function renderMesas(container) {
    container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">🪑 Mesas</div>
        <div class="page-subtitle">Status em tempo real — cruzando com comandas abertas</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-md" id="btn-refresh-mesas">↺ Atualizar</button>
        <button class="btn btn-primary btn-md" id="btn-nova-mesa">+ Nova Mesa</button>
      </div>
    </div>
    <div id="mesas-legenda" style="display:flex;gap:12px;padding:0 32px 8px;font-size:0.8rem;color:var(--text-secondary)">
      <span>🟢 Livre &nbsp; 🔴 Ocupada (tem comanda aberta) &nbsp; ⚫ Inativa</span>
    </div>
    <div id="mesas-container" class="mesa-grid"></div>`;

    await loadMesas();

    document.getElementById('btn-nova-mesa').addEventListener('click', () => abrirModalMesa());
    document.getElementById('btn-refresh-mesas').addEventListener('click', loadMesas);
}

async function loadMesas() {
    const grid = document.getElementById('mesas-container');
    if (!grid) return;
    grid.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;

    // Carrega mesas e comandas em paralelo para determinar ocupação
    const [mesasRes, comandasRes] = await Promise.all([
        window.electronAPI.get('/mesas/'),
        window.electronAPI.get('/comandas/'),
    ]);

    if (!mesasRes.ok) {
        grid.innerHTML = `<div class="table-empty">Erro ao carregar mesas.</div>`;
        return;
    }

    const mesas = mesasRes.data;

    // IDs de mesas com pelo menos uma comanda ativa (OPEN ou PAYING)
    const mesasOcupadas = new Set();
    if (comandasRes.ok) {
        comandasRes.data.forEach(c => {
            if ((c.status === 'OPEN' || c.status === 'PAYING') && c.mesa) mesasOcupadas.add(c.mesa);
        });
    }

    if (!mesas.length) {
        grid.innerHTML = `<div class="table-empty">Nenhuma mesa cadastrada.</div>`;
        return;
    }

    grid.innerHTML = mesas.map(mesa => {
        const inativa = !mesa.active;
        const ocupada = !inativa && mesasOcupadas.has(mesa.id);
        const classe = inativa ? 'inativa' : (ocupada ? 'ocupada' : 'livre');
        const icone = inativa ? '⚫' : (ocupada ? '🔴' : '🟢');
        const statusTxt = inativa ? 'Inativa' : (ocupada ? 'Ocupada' : 'Livre');

        return `
      <div class="mesa-card ${classe}" data-id="${mesa.id}" data-ocupada="${ocupada}" data-inativa="${inativa}"
           title="Localização: ${mesa.location || '–'}">
        <div class="mesa-num">${mesa.name}</div>
        <div class="mesa-status">${icone} ${statusTxt}</div>
        ${mesa.location ? `<div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px">${mesa.location}</div>` : ''}
      </div>`;
    }).join('');

    // Click em cada mesa abre detalhes/ações
    grid.querySelectorAll('.mesa-card').forEach(card => {
        card.addEventListener('click', () => {
            const mesa = mesas.find(m => m.id === parseInt(card.dataset.id));
            if (mesa) abrirDetalheMesa(mesa, mesasOcupadas.has(mesa.id));
        });
    });
}

function abrirDetalheMesa(mesa, ocupada) {
    const inativa = !mesa.active;
    openModal({
        title: mesa.name,
        body: `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:10px;align-items:center">
          <span class="badge ${inativa ? 'badge-muted' : (ocupada ? 'badge-danger' : 'badge-success')}">
            ${inativa ? 'Inativa' : (ocupada ? 'Ocupada' : 'Livre')}
          </span>
          ${mesa.active ? '<span class="badge badge-info">Ativa no sistema</span>' : ''}
        </div>
        ${mesa.location ? `<div style="font-size:0.82rem;color:var(--text-secondary)">📍 Localização: <strong>${mesa.location}</strong></div>` : ''}
      </div>`,
        footer: `
      <button class="btn btn-ghost btn-md" onclick="closeModal()">Fechar</button>
      <button class="btn btn-secondary btn-md" id="btn-edit-mesa">✏️ Editar</button>
      <button class="btn btn-danger btn-md" id="btn-del-mesa">Excluir</button>`,
    });

    document.getElementById('btn-edit-mesa').addEventListener('click', () => {
        closeModal();
        abrirModalMesa(mesa);
    });

    document.getElementById('btn-del-mesa').addEventListener('click', async () => {
        const r = await window.electronAPI.delete(`/mesas/${mesa.id}/`);
        if (r.ok) { showToast('Mesa excluída!', 'success'); closeModal(); loadMesas(); }
        else showToast(r.error, 'error');
    });
}

function abrirModalMesa(mesa = null) {
    const isEdit = !!mesa;
    openModal({
        title: isEdit ? `Editar: ${mesa.name}` : 'Nova Mesa',
        body: `
      <div class="form-grid">
        <div class="form-group">
          <label>Nome</label>
          <input type="text" id="mesa-nome" class="form-control" value="${mesa?.name || ''}" placeholder="Ex: BALCÃO, Mesa 01..." />
        </div>
        <div class="form-group">
          <label>Localização (x-y)</label>
          <input type="text" id="mesa-loc" class="form-control" value="${mesa?.location || ''}" placeholder="Ex: 350-850" />
        </div>
        <div class="form-group">
          <label>Ativa no sistema</label>
          <select id="mesa-active" class="form-control">
            <option value="true"  ${mesa?.active ? 'selected' : ''}>Sim</option>
            <option value="false" ${mesa?.active === false ? 'selected' : ''}>Não</option>
          </select>
        </div>
      </div>`,
        footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary btn-md" id="btn-salvar-mesa">${isEdit ? 'Salvar' : 'Criar'}</button>`,
    });

    document.getElementById('btn-salvar-mesa').addEventListener('click', async () => {
        const data = {
            name: document.getElementById('mesa-nome').value.trim(),
            location: document.getElementById('mesa-loc').value.trim(),
            active: document.getElementById('mesa-active').value === 'true',
        };
        if (!data.name) return showToast('Informe o nome da mesa.', 'error');

        const r = isEdit
            ? await window.electronAPI.put(`/mesas/${mesa.id}/`, data)
            : await window.electronAPI.post('/mesas/', data);

        if (r.ok) { showToast(isEdit ? 'Mesa atualizada!' : 'Mesa criada!', 'success'); closeModal(); loadMesas(); }
        else showToast(r.error, 'error');
    });
}
