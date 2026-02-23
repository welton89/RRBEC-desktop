export async function renderPagamentos(container) {
  // Carrega tipos de pagamento para o formulário de novo registro
  let tiposPag = [], comandas = [];
  const [tRes, cRes] = await Promise.all([
    window.electronAPI.get('/payment-types/'),
    window.electronAPI.get('/comandas/'),
  ]);
  if (tRes.ok) tiposPag = tRes.data;
  if (cRes.ok) comandas = cRes.data;

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

  await loadPagamentos(tiposPag, comandas);

  document.getElementById('btn-novo-pag').addEventListener('click', () => abrirModalPagamento(tiposPag, comandas));
  document.getElementById('search-pag').addEventListener('input', () => filtrarPagamentos(tiposPag));
  document.getElementById('filter-tipo').addEventListener('change', () => filtrarPagamentos(tiposPag));
}

let _pagsData = [];

async function loadPagamentos(tiposPag, comandas) {
  const wrap = document.getElementById('pagamentos-table');
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  const res = await window.electronAPI.get('/payments/');
  if (!res.ok) { wrap.innerHTML = `<div class="table-empty">Erro ao carregar pagamentos.</div>`; return; }
  _pagsData = res.data;
  renderPagsTable(_pagsData);
}

function renderPagsTable(data) {
  const wrap = document.getElementById('pagamentos-table');
  if (!wrap) return;

  if (!data.length) {
    wrap.innerHTML = `<div class="table-empty">Nenhum pagamento registrado.</div>`;
    return;
  }

  // Soma total dos pagamentos exibidos
  const total = data.reduce((acc, p) => acc + parseFloat(p.value || 0), 0);

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
        ${data.map(p => `<tr>
          <td style="color:var(--text-muted)">#${p.id}</td>
          <td>${p.client_name || '–'}</td>
          <td>
            ${p.comanda ? `<span style="font-size:0.8rem">
              <span style="color:var(--text-muted)">#${p.comanda}</span>
              ${p.comanda_name ? `<span style="color:var(--text-secondary)"> ${p.comanda_name}</span>` : ''}
            </span>` : '–'}
          </td>
          <td><span class="badge badge-info">${p.type_pay_name || '–'}</span></td>
          <td><strong style="color:var(--success)">R$ ${parseFloat(p.value || 0).toFixed(2)}</strong></td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);font-size:0.82rem">
            ${p.description || '–'}
          </td>
          <td style="white-space:nowrap;font-size:0.82rem">${formatDate(p.datetime)}</td>
          <td>
            <button class="btn btn-danger btn-sm btn-del-pag" data-id="${p.id}">Excluir</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;align-items:center;gap:8px">
      <span style="font-size:0.82rem;color:var(--text-secondary)">Total exibido:</span>
      <strong style="color:var(--success);font-size:1rem">R$ ${total.toFixed(2)}</strong>
    </div>`;

  wrap.querySelectorAll('.btn-del-pag').forEach(btn =>
    btn.addEventListener('click', async () => {
      const r = await window.electronAPI.delete(`/payments/${btn.dataset.id}/`);
      if (r.ok) { showToast('Pagamento excluído!', 'success'); loadPagamentos([], []); }
      else showToast(r.error, 'error');
    })
  );
}

function filtrarPagamentos(tiposPag) {
  const q = document.getElementById('search-pag')?.value.toLowerCase() || '';
  const tipo = parseInt(document.getElementById('filter-tipo')?.value) || null;

  const filtered = _pagsData.filter(p => {
    const matchQ = !q ||
      (p.client_name || '').toLowerCase().includes(q) ||
      (p.comanda_name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      String(p.id).includes(q);
    const matchTipo = !tipo || p.type_pay === tipo;
    return matchQ && matchTipo;
  });
  renderPagsTable(filtered);
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

    const r = await window.electronAPI.post('/payments/', data);
    if (r.ok) { showToast('Pagamento registrado!', 'success'); closeModal(); loadPagamentos(tiposPag, comandas); }
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
