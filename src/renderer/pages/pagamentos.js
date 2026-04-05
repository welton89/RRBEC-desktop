export async function renderPagamentos(container) {
  const [tRes, cRes, cliRes] = await Promise.all([
    window.electronAPI.get('/payment-types'),
    window.electronAPI.get('/comandas'),
    window.electronAPI.get('/clients'),
  ]);
  const tiposPag = tRes.ok ? tRes.data : [];
  const comandas = cRes.ok ? cRes.data : [];
  const clientes = cliRes.ok ? cliRes.data : [];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">💳 Pagamentos</div>
        <div class="page-subtitle">Histórico financeiro do estabelecimento</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-md" id="btn-novo-pag">+ Registrar Pagamento</button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <input type="text" class="search-input" id="search-pag" placeholder="🔍 Buscar por cliente, comanda ou descrição..." />
        <select id="filter-tipo" class="form-control" style="width:160px">
          <option value="">Todos os tipos</option>
          ${tiposPag.map(t => `<option value="${t.id}">${t.nome || t.name}</option>`).join('')}
        </select>
      </div>
      <div id="pagamentos-table"></div>
    </div>`;

  await loadPagamentos(tiposPag, comandas, clientes);

  document.getElementById('btn-novo-pag').addEventListener('click', () => abrirModalPagamento(tiposPag, comandas));
  document.getElementById('search-pag').addEventListener('input', () => filtrarPagamentos());
  document.getElementById('filter-tipo').addEventListener('change', () => filtrarPagamentos());
}

let _pagsData = [];
let _cmdMap = {};
let _tiposPag = [];
let _clientesMap = {};

async function loadPagamentos(tiposPag, comandas, clientes) {
  const wrap = document.getElementById('pagamentos-table');
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  
  _tiposPag = tiposPag;

  const res = await window.electronAPI.get('/payments');
  if (!res.ok) { wrap.innerHTML = `<div class="table-empty">Erro ao carregar pagamentos.</div>`; return; }
  
  _pagsData = (res.data || []).sort((a, b) => b.id - a.id);
  
  _cmdMap = (comandas || []).reduce((acc, c) => {
    acc[String(c.id)] = {
      name: c.name || 'Sem nome',
      mesa: c.mesa_name || `Mesa ${c.mesa}`,
      mesa_name: c.mesa_name || '',
      status: c.status,
      dt_open: c.dt_open,
      client: c.client
    };
    return acc;
  }, {});

  if (clientes) {
    _clientesMap = (clientes || []).reduce((acc, c) => {
      acc[String(c.id)] = c.name || '–';
      return acc;
    }, {});
  }

  renderPagsTable();
}

function renderPagsTable() {
  const wrap = document.getElementById('pagamentos-table');
  if (!wrap) return;

  if (!_pagsData.length) {
    wrap.innerHTML = `<div class="table-empty">Nenhum pagamento registrado.</div>`;
    return;
  }

  const total = _pagsData.reduce((acc, p) => acc + parseFloat(p.value || 0), 0);

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th>
        <th>Cliente</th>
        <th>Comanda</th>
        <th>Tipo</th>
        <th>Valor</th>
        <th>Descrição</th>
        <th>Data</th>
        <th>Ações</th>
      </tr></thead>
      <tbody>
        ${_pagsData.map(p => {
          const cInfo = _cmdMap[String(p.comanda)];
          const clienteNome = _clientesMap[String(p.client)] || p.client_name || '–';
          const cDesc = cInfo ? `${cInfo.name} (${cInfo.mesa})` : (p.comanda_name || '–');
          return `
            <tr>
              <td style="color:var(--text-muted)">#${p.id}</td>
              <td>${clienteNome}</td>
              <td>
                ${p.comanda ? `<span style="font-size:0.8rem">
                  <span style="color:var(--text-muted)">#${p.comanda}</span>
                  <span style="color:var(--text-secondary)"> ${cDesc}</span>
                </span>` : '–'}
              </td>
              <td><span class="badge badge-info">${p.type_pay_name || '–'}</span></td>
              <td><strong style="color:var(--success)">R$ ${parseFloat(p.value || 0).toFixed(2)}</strong></td>
              <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);font-size:0.82rem">
                ${p.description || '–'}
              </td>
              <td style="white-space:nowrap;font-size:0.82rem">${formatDate(p.datetime)}</td>
              <td>
                <button class="btn btn-secondary btn-sm btn-view-pag" data-id="${p.id}">🔍 Ver</button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;align-items:center;gap:8px">
      <span style="font-size:0.82rem;color:var(--text-secondary)">Total exibido:</span>
      <strong style="color:var(--success);font-size:1rem">R$ ${total.toFixed(2)}</strong>
    </div>`;

  wrap.querySelectorAll('.btn-view-pag').forEach(btn =>
    btn.addEventListener('click', () => {
      const pag = _pagsData.find(p => String(p.id) === String(btn.dataset.id));
      if (pag) abrirDetalhesPagamento(pag);
    })
  );
}

function abrirDetalhesPagamento(pagamento) {
  const cInfo = _cmdMap[String(pagamento.comanda)];
  const tipoNome = _tiposPag.find(t => String(t.id) === String(pagamento.type_pay))?.name || 
                   _tiposPag.find(t => String(t.id) === String(pagamento.type_pay))?.nome || 
                   pagamento.type_pay_name || '–';
  const clienteNome = _clientesMap[String(pagamento.client)] || pagamento.client_name || '–';

  openModal({
    title: `💳 Detalhes do Pagamento #${pagamento.id}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card" style="padding:16px;background:var(--bg-elevated)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Valor</div>
              <div style="font-size:1.5rem;font-weight:700;color:var(--success)">R$ ${parseFloat(pagamento.value || 0).toFixed(2)}</div>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Forma de Pagamento</div>
              <div style="font-size:1rem;font-weight:600">${tipoNome}</div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Cliente</div>
            <div style="font-weight:500">${clienteNome}</div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Data/Hora</div>
            <div style="font-weight:500">${formatDate(pagamento.datetime)}</div>
          </div>
        </div>

        ${pagamento.comanda ? `
        <div>
          <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Comanda</div>
          <div class="card" style="padding:12px;background:var(--bg-elevated)">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <div>
                <div style="font-weight:600">#${pagamento.comanda} — ${cInfo?.name || '–'}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary)">${cInfo?.mesa || '–'}</div>
              </div>
              <span class="badge badge-${cInfo?.status === 'FIADO' ? 'warning' : cInfo?.status === 'CLOSED' ? 'success' : 'info'}">
                ${cInfo?.status || '–'}
              </span>
            </div>
            ${cInfo?.dt_open ? `
            <div style="font-size:0.8rem;color:var(--text-muted)">
              Abertura: ${formatDate(cInfo.dt_open)}
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}

        ${pagamento.description ? `
        <div>
          <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Descrição</div>
          <div style="padding:10px;background:var(--bg-elevated);border-radius:var(--radius-sm)">${pagamento.description}</div>
        </div>
        ` : ''}
      </div>
    `,
    footer: `<button class="btn btn-secondary btn-md" onclick="closeModal()">Fechar</button>`
  });
}

function filtrarPagamentos() {
  const q = document.getElementById('search-pag')?.value.toLowerCase() || '';
  const tipo = parseInt(document.getElementById('filter-tipo')?.value) || null;

  const filtered = _pagsData.filter(p => {
    const clienteNome = _clientesMap[String(p.client)] || p.client_name || '';
    const cInfo = _cmdMap[String(p.comanda)];
    const comandaNome = cInfo?.name || p.comanda_name || '';
    const matchQ = !q ||
      clienteNome.toLowerCase().includes(q) ||
      comandaNome.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      String(p.id).includes(q);
    const matchTipo = !tipo || p.type_pay === tipo;
    return matchQ && matchTipo;
  });

  const wrap = document.getElementById('pagamentos-table');
  if (!wrap) return;

  if (!filtered.length) {
    wrap.innerHTML = `<div class="table-empty">Nenhum pagamento encontrado.</div>`;
    return;
  }

  const total = filtered.reduce((acc, p) => acc + parseFloat(p.value || 0), 0);

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th>
        <th>Cliente</th>
        <th>Comanda</th>
        <th>Tipo</th>
        <th>Valor</th>
        <th>Descrição</th>
        <th>Data</th>
        <th>Ações</th>
      </tr></thead>
      <tbody>
        ${filtered.map(p => {
          const cInfo = _cmdMap[String(p.comanda)];
          const clienteNome = _clientesMap[String(p.client)] || p.client_name || '–';
          const cDesc = cInfo ? `${cInfo.name} (${cInfo.mesa})` : (p.comanda_name || '–');
          return `
            <tr>
              <td style="color:var(--text-muted)">#${p.id}</td>
              <td>${clienteNome}</td>
              <td>
                ${p.comanda ? `<span style="font-size:0.8rem">
                  <span style="color:var(--text-muted)">#${p.comanda}</span>
                  <span style="color:var(--text-secondary)"> ${cDesc}</span>
                </span>` : '–'}
              </td>
              <td><span class="badge badge-info">${p.type_pay_name || '–'}</span></td>
              <td><strong style="color:var(--success)">R$ ${parseFloat(p.value || 0).toFixed(2)}</strong></td>
              <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);font-size:0.82rem">
                ${p.description || '–'}
              </td>
              <td style="white-space:nowrap;font-size:0.82rem">${formatDate(p.datetime)}</td>
              <td>
                <button class="btn btn-secondary btn-sm btn-view-pag" data-id="${p.id}">🔍 Ver</button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;align-items:center;gap:8px">
      <span style="font-size:0.82rem;color:var(--text-secondary)">Total exibido:</span>
      <strong style="color:var(--success);font-size:1rem">R$ ${total.toFixed(2)}</strong>
    </div>`;

  wrap.querySelectorAll('.btn-view-pag').forEach(btn =>
    btn.addEventListener('click', () => {
      const pag = _pagsData.find(p => String(p.id) === String(btn.dataset.id));
      if (pag) abrirDetalhesPagamento(pag);
    })
  );
}

function abrirModalPagamento(tiposPag, comandas) {
  const comandasAbertas = comandas.filter(c => c.status === 'OPEN' || c.status === 'PAYING');

  openModal({
    title: 'Registrar Pagamento',
    body: `
      <div class="form-grid">
        <div class="form-group">
          <label>Tipo de Pagamento</label>
          <select id="pag-tipo" class="form-control">
            ${tiposPag.map(t => `<option value="${t.id}">${t.nome || t.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Valor (R$)</label>
          <input type="number" id="pag-valor" class="form-control" step="0.01" min="0" placeholder="0.00" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Comanda (opcional)</label>
          <select id="pag-comanda" class="form-control">
            <option value="">– Sem comanda –</option>
            ${comandasAbertas.map(c => `<option value="${c.id}">#${c.id} — ${c.name || ''} (${c.mesa_name || ''})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Descrição</label>
          <input type="text" id="pag-desc" class="form-control" placeholder="Ex: PAGAMENTO DE FIADO" />
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary btn-md" id="btn-salvar-pag">Registrar</button>`,
  });

  document.getElementById('btn-salvar-pag').addEventListener('click', async () => {
    const tipoVal = parseInt(document.getElementById('pag-tipo').value) || null;
    const comandaVal = parseInt(document.getElementById('pag-comanda').value) || null;
    const valor = parseFloat(document.getElementById('pag-valor').value);

    if (!valor || valor <= 0) return showToast('Informe um valor válido.', 'error');

    const data = {
      type_pay: tipoVal,
      value: valor.toFixed(2),
      comanda: comandaVal,
      description: document.getElementById('pag-desc').value.trim(),
    };

    const r = await window.electronAPI.post('/payments', data);
    if (r.ok) { showToast('Pagamento registrado!', 'success'); closeModal(); loadPagamentos(_tiposPag, [], null); }
    else showToast(r.error, 'error');
  });
}

function formatDate(str) {
  if (!str) return '–';
  return new Date(str).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
