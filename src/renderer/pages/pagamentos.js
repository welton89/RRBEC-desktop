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
      <div class="table-toolbar" style="border-top:1px solid var(--border);margin-top:0;padding-top:12px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div style="display:flex;gap:8px;align-items:center">
            <label style="font-size:0.8rem;color:var(--text-muted)">De:</label>
            <input type="datetime-local" id="filter-dataini" class="form-control" style="width:180px" />
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <label style="font-size:0.8rem;color:var(--text-muted)">Até:</label>
            <input type="datetime-local" id="filter-datafim" class="form-control" style="width:180px" />
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-limpar-filtro-data">🗑️ Limpar</button>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-warning btn-md" id="btn-imprimir-relatorio">🖨️ Imprimir Cupom</button>
        </div>
      </div>
      <div id="pagamentos-table"></div>
    </div>`;

  await loadPagamentos(tiposPag, comandas, clientes);

  document.getElementById('btn-novo-pag').addEventListener('click', () => abrirModalPagamento(tiposPag, comandas));
  document.getElementById('search-pag').addEventListener('input', () => filtrarPagamentos());
  document.getElementById('filter-tipo').addEventListener('change', () => filtrarPagamentos());
  document.getElementById('filter-dataini').addEventListener('change', () => filtrarPagamentos());
  document.getElementById('filter-datafim').addEventListener('change', () => filtrarPagamentos());
  document.getElementById('btn-limpar-filtro-data').addEventListener('click', () => {
    document.getElementById('filter-dataini').value = '';
    document.getElementById('filter-datafim').value = '';
    filtrarPagamentos();
  });
  document.getElementById('btn-imprimir-relatorio').addEventListener('click', () => imprimirRelatorio());
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

  window._pagsFiltered = _pagsData;
renderPagsTableFiltered(_pagsData);
}

function renderPagsTableFiltered(filtered) {
  const wrap = document.getElementById('pagamentos-table');
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

function imprimirRelatorio() {
  const filtered = window._pagsFiltered || _pagsData;
  if (!filtered.length) return showToast('Nenhum pagamento para imprimir.', 'warning');

  const dataIni = document.getElementById('filter-dataini')?.value;
  const dataFim = document.getElementById('filter-datafim')?.value;
  
  const dataIniStr = dataIni ? new Date(dataIni).toLocaleString('pt-BR') : 'Início';
  const dataFimStr = dataFim ? new Date(dataFim).toLocaleString('pt-BR') : 'Agora';

  const porTipo = {};
  filtered.forEach(p => {
    const tipoNome = p.type_pay_name || _tiposPag.find(t => String(t.id) === String(p.type_pay))?.nome || _tiposPag.find(t => String(t.id) === String(p.type_pay))?.name || 'Outro';
    if (!porTipo[tipoNome]) porTipo[tipoNome] = 0;
    porTipo[tipoNome] += parseFloat(p.value || 0);
  });

  const totalGeral = filtered.reduce((acc, p) => acc + parseFloat(p.value || 0), 0);

  const htmlRelatorio = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Pagamentos</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; width: 80mm; }
        .rel { display: block; }
        .rel * { color: black !important; background: transparent !important; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
        .periodo { font-size: 11px; margin-top: 4px; }
        .section { margin-top: 16px; }
        .section-title { font-size: 13px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
        .row { display: flex; justify-content: space-between; padding: 3px 0; }
        .total { font-weight: bold; margin-top: 8px; border-top: 2px solid #000; padding-top: 8px; }
        .footer { text-align: center; margin-top: 16px; font-size: 10px; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="rel">
        <div class="header">
          <div class="title">RRBEC - Bar & Restaurante</div>
          <div class="periodo">Relatório de Pagamentos</div>
          <div class="periodo">${dataIniStr} - ${dataFimStr}</div>
        </div>
        
        <div class="section">
          <div class="section-title">RESUMO POR TIPO</div>
          ${Object.entries(porTipo).map(([tipo, valor]) => `
            <div class="row">
              <span>${tipo}</span>
              <span>R$ ${valor.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="total">
          <div class="row">
            <span>TOTAL GERAL:</span>
            <span>R$ ${totalGeral.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <div>------------------------</div>
          <div>${filtered.length} pagamento(s)</div>
          <div>Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  window.electronAPI.printDirect(htmlRelatorio).then(r => {
    if (r.ok) {
      showToast('Relatório enviado para impressão!', 'success');
    } else if (r.error === 'NO_PRINTER') {
      showToast('Nenhuma impressora configurada.', 'warning', 5000);
      const printWindow = window.open('', '', 'width=300,height=400');
      printWindow.document.write(htmlRelatorio);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    } else {
      const printWindow = window.open('', '', 'width=300,height=400');
      printWindow.document.write(htmlRelatorio);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    }
  });
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
