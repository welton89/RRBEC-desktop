function imprimirComanda(comanda, pagamentosComanda, totalComanda) {
  const itens = comanda.items || [];
  const totalPago = (pagamentosComanda || []).reduce((acc, p) => acc + parseFloat(p.value || 0), 0);
  const valorRestante = totalComanda - totalPago;

  const dataAtual = new Date().toLocaleString('pt-BR');
  const nomeEstabelecimento = 'RRBEC - Bar & Restaurante';

  const htmlImpressao = `
    <div class="print-comanda">
      <div class="print-header">
        <div class="print-title">${nomeEstabelecimento}</div>
        <div class="print-info">COMANDA #${comanda.id}</div>
        <div class="print-info">Data: ${dataAtual}</div>
        ${comanda.name ? `<div class="print-info">Cliente: ${comanda.name}</div>` : ''}
        ${comanda.mesa_name ? `<div class="print-info">Mesa: ${comanda.mesa_name}</div>` : ''}
      </div>

      <div class="print-items">
        <div style="font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:4px">
          <span style="float:left">PRODUTO</span>
          <span style="float:right">VALOR</span>
        </div>
        <div style="clear:both"></div>
        ${itens.map(it => {
  const price = _productsMap[String(it.product)] || 0;
  const nome = _productsNames[String(it.product)] || it.product_name || `Produto #${it.product}`;
  return `
          <div class="print-item">
            <span>${nome}</span>
            <span>R$ ${price.toFixed(2)}</span>
          </div>
        `;
}).join('')}
      </div>

      <div class="print-totals">
        <div style="display:flex;justify-content:space-between;padding:4px 0">
          <span>TOTAL:</span>
          <span>R$ ${totalComanda.toFixed(2)}</span>
        </div>
        ${totalPago > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:4px 0">
          <span>PAGO:</span>
          <span>R$ ${totalPago.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:bold">
          <span>RESTANTE:</span>
          <span>R$ ${valorRestante.toFixed(2)}</span>
        </div>
        ` : ''}
      </div>

      ${(pagamentosComanda || []).length > 0 ? `
      <div style="margin-top:10px;border-top:1px dashed #000;padding-top:8px">
        <div style="font-weight:bold;margin-bottom:4px">PAGAMENTOS:</div>
        ${pagamentosComanda.map(p => {
  const tipoNome = _paymentTypes.find(t => String(t.id) === String(p.type_pay))?.name || 
                   _paymentTypes.find(t => String(t.id) === String(p.type_pay))?.nome || '–';
  return `
          <div style="display:flex;justify-content:space-between;padding:2px 0">
            <span>${tipoNome}</span>
            <span>R$ ${parseFloat(p.value || 0).toFixed(2)}</span>
          </div>
        `;
}).join('')}
      </div>
      ` : ''}

      <div class="print-footer">
        <div>------------------------</div>
        <div>Obrigado pela preferência!</div>
        <div>Volte sempre!</div>
      </div>
    </div>
  `;

  const htmlCompleto = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Comanda #${comanda.id}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; width: 80mm; }
        .print-comanda { display: block; }
        .print-comanda * { color: black !important; background: transparent !important; }
        .print-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px; }
        .print-title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
        .print-info { font-size: 11px; margin: 2px 0; }
        .print-items { padding-bottom: 8px; margin-bottom: 8px; }
        .print-item { display: flex; justify-content: space-between; padding: 3px 0; }
        .print-totals { font-weight: bold; }
        .print-footer { text-align: center; margin-top: 15px; font-size: 10px; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { width: 80mm; }
        }
      </style>
    </head>
    <body>
      ${htmlImpressao}
    </body>
    </html>
  `;

  window.electronAPI.printDirect(htmlCompleto).then(r => {
    if (r.ok) {
      showToast('Impressão enviada!', 'success');
    } else {
      showToast('Nenhuma impressora configurada. Abrindo diálogo...', 'warning');
      const printWindow = window.open('', '', 'width=300,height=600');
      printWindow.document.write(htmlCompleto);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  });
}

export async function renderComandas(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">📋 Comandas</div>
        <div class="page-subtitle">Gerencie as comandas por mesa</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-md" id="btn-nova-comanda">+ Nova Comanda</button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <input type="text" class="search-input" id="search-comanda" placeholder="🔍 Buscar por nome ou mesa..." />
        <select id="filter-status" class="form-control" style="width:180px">
          <option value="">Todos os status</option>
          <option value="ACTIVE" selected>Ativas (Abertas/Pagando)</option>
          <option value="OPEN">Somente Abertas</option>
          <option value="PAYING">Pagando</option>
          <option value="CLOSED">Fechadas</option>
        </select>
      </div>
      <div id="comandas-table"></div>
    </div>`;

  let mesas = [];
  const mesasRes = await window.electronAPI.get('/mesas');
  if (mesasRes.ok) mesas = mesasRes.data;

  await loadComandas(mesas);

  document.getElementById('btn-nova-comanda').addEventListener('click', () => abrirModalNovaComanda(mesas));
  document.getElementById('search-comanda').addEventListener('input', () => filtrarComandas());
  document.getElementById('filter-status').addEventListener('change', () => filtrarComandas());
}

let _comandasData = [];
let _mesasRef = [];
let _productsMap = {}; // Cache de preços {id: price}
let _productsNames = {}; // Cache de nomes {id: name}
let _paymentTypes = [];
let _clients = [];
let _paymentsMap = {}; // Cache de pagamentos por comanda {comandaId: [pagamentos]}

async function loadComandas(mesas) {
  _mesasRef = mesas;
  const wrap = document.getElementById('comandas-table');
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;

  const [res, pRes, ptRes, cRes, pagsRes] = await Promise.all([
    window.electronAPI.get('/comandas'),
    window.electronAPI.get('/products'),
    window.electronAPI.get('/payment-types'),
    window.electronAPI.get('/clients'),
    window.electronAPI.get('/payments')
  ]);

  if (ptRes.ok) _paymentTypes = ptRes.data;
  if (cRes.ok) _clients = cRes.data;

  if (pRes.ok) {
    _productsMap = pRes.data.reduce((acc, p) => {
      acc[String(p.id)] = parseFloat(p.price || 0);
      return acc;
    }, {});
    _productsNames = pRes.data.reduce((acc, p) => {
      acc[String(p.id)] = p.name || `Produto #${p.id}`;
      return acc;
    }, {});
  }

  _paymentsMap = {};
  if (pagsRes.ok) {
    (pagsRes.data || []).forEach(p => {
      if (p.comanda) {
        if (!_paymentsMap[p.comanda]) _paymentsMap[p.comanda] = [];
        _paymentsMap[p.comanda].push(p);
      }
    });
  }

  if (!res.ok) { wrap.innerHTML = `<div class="table-empty">Erro ao carregar comandas.</div>`; return; }
  _comandasData = res.ok ? res.data : [];
  _comandasData.reverse();
  console.log('[PDV] Comandas carregadas do servidor:', _comandasData);

  filtrarComandas();
}

function renderComandasTable(data) {
  const wrap = document.getElementById('comandas-table');
  if (!wrap) return;
  if (!data.length) { wrap.innerHTML = `<div class="table-empty">Nenhuma comanda encontrada.</div>`; return; }

  // Limita a exibição às primeiras 100 comandas
  const limitedData = data.slice(0, 100);

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th>
        <th>Nome</th>
        <th>Mesa</th>
        <th>Status</th>
        <th>Total</th>
        <th>Aberta em</th>
        <th>Ações</th>
      </tr></thead>
      <tbody>
        ${data.map(c => {
    const statusCfg = {
      'OPEN': { label: 'Aberta', badge: 'badge-success' },
      'PAYING': { label: 'Pagando', badge: 'badge-warning' },
      'CLOSED': { label: 'Fechada', badge: 'badge-muted' }
    };
    const cfg = statusCfg[c.status] || { label: c.status, badge: 'badge-muted' };
    const ativa = c.status === 'OPEN' || c.status === 'PAYING';
    const totalComanda = (c.items || []).reduce((acc, item) => acc + (_productsMap[String(item.product)] || 0), 0);

    const pagamentos = _paymentsMap[c.id] || [];
    const totalPago = pagamentos.reduce((acc, p) => acc + parseFloat(p.value || 0), 0);
    const valorRestante = totalComanda - totalPago;
    const temPagamentos = pagamentos.length > 0;

    return `<tr class="comanda-row" data-id="${c.id}" style="cursor:pointer">
            <td><strong>#${c.id}</strong></td>
            <td>${c.name || '–'}</td>
            <td>${c.mesa_name || `Mesa ${c.mesa}` || '–'}</td>
            <td><span class="badge ${cfg.badge}">${cfg.label}</span></td>
            <td>
              ${temPagamentos ? `<div style="display:flex;flex-direction:column;gap:2px">
                <span style="text-decoration:line-through;color:var(--text-muted);font-size:0.85rem">R$ ${totalComanda.toFixed(2)}</span>
                <strong style="color:${valorRestante <= 0 ? 'var(--success)' : 'var(--warning)'}">R$ ${Math.max(0, valorRestante).toFixed(2)}</strong>
                ${temPagamentos ? `<span style="font-size:0.7rem;color:var(--text-muted)">Pago: R$ ${totalPago.toFixed(2)}</span>` : ''}
              </div>` : `<strong style="color:var(--success)">R$ ${totalComanda.toFixed(2)}</strong>`}
            </td>
            <td>${formatDate(c.dt_open)}</td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-secondary btn-sm btn-editar" data-id="${c.id}" title="Editar">✏️</button>
                ${ativa ? `<button class="btn btn-success btn-sm btn-receber" data-id="${c.id}" title="Receber">💰</button>` : ''}
                ${ativa && c.status === 'OPEN' ? `<button class="btn btn-warning btn-sm btn-pagar" data-id="${c.id}" title="Avisar Pagamento">⏳</button>` : ''}
                ${ativa && c.status === 'PAYING' ? `<button class="btn btn-warning btn-sm btn-reopen" data-id="${c.id}" title="Reabrir Comanda">Reabrir</button>` : ''}
              </div>
            </td>
          </tr>`;
  }).join('')}
      </tbody>
    </table>
    ${data.length > 100 ? `<div style="padding:10px; text-align:center; color:var(--text-muted); font-size:0.8rem;">Exibindo apenas as últimas 100 de ${data.length} comandas.</div>` : ''}
  `;

  // Listener para linha toda
  wrap.querySelectorAll('.comanda-row').forEach(row => {
    row.addEventListener('click', () => {
      const comanda = _comandasData.find(c => c.id === parseInt(row.dataset.id));
      if (comanda) abrirItensComanda(comanda);
    });
  });

  // Listener para Receber
  wrap.querySelectorAll('.btn-receber').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const comanda = _comandasData.find(c => c.id === parseInt(btn.dataset.id));
      if (comanda) abrirModalPagamento(comanda);
    });
  });

  // Listener para Editar
  wrap.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const comanda = _comandasData.find(c => c.id === parseInt(btn.dataset.id));
      if (comanda) abrirModalNovaComanda(_mesasRef, comanda);
    });
  });

  // Listener para botão "Pagar" (muda p/ PAYING)
  wrap.querySelectorAll('.btn-pagar').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await window.electronAPI.patch(`/comandas/${btn.dataset.id}`, { status: 'PAYING' });
      if (r.ok) { showToast('Comanda em fase de pagamento!', 'info'); loadComandas(_mesasRef); }
      else showToast(r.error, 'error');
    });
  });

  // Listener para botão "Reabrir" (muda p/ OPEN)
  wrap.querySelectorAll('.btn-reopen').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await window.electronAPI.patch(`/comandas/${btn.dataset.id}`, { status: 'OPEN' });
      if (r.ok) { showToast('Comanda reaberta!', 'info'); loadComandas(_mesasRef); }
      else showToast(r.error, 'error');
    });
  });
}
async function abrirModalPagamento(comanda, onPaymentComplete) {
  try {
    if (!comanda.items) comanda.items = [];
    const totalBruto = comanda.items.reduce((acc, it) => acc + (_productsMap[String(it.product)] || 0), 0);
    
    const pagamentosAtuais = _paymentsMap[comanda.id] || [];
    const totalPago = pagamentosAtuais.reduce((acc, p) => acc + parseFloat(p.value || 0), 0);
    const valorRestante = Math.max(0, totalBruto - totalPago);

    openModal({
      title: `💰 Receber Pagamento - Comanda #${comanda.id}`,
      body: `
        <div class="form-grid">
          <div class="form-group">
            <label>Valor Total (R$)</label>
            <input type="number" id="pay-value" class="form-control" value="${valorRestante.toFixed(2)}" step="0.01" />
            ${totalPago > 0 ? `<small style="color:var(--text-muted)">Valor restante (já pagos: R$ ${totalPago.toFixed(2)})</small>` : ''}
          </div>
          <div class="form-group">
            <label>Forma de Pagamento</label>
            <select id="pay-type" class="form-control">
              ${_paymentTypes.map(pt => `<option value="${pt.id}">${pt.name || pt.nome}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Cliente (Opcional)</label>
            <select id="pay-client" class="form-control">
              <option value="">Consumidor Final</option>
              ${_clients.filter(c => c.active !== false).map(cl => `
                <option value="${cl.id}" ${String(comanda.client) === String(cl.id) ? 'selected' : ''}>
                  ${cl.name}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group" style="grid-column: span 2">
            <label>Descrição / Observações</label>
            <input type="text" id="pay-desc" class="form-control" placeholder="Ex: Pagamento total..." value="Pagamento total" />
          </div>
        </div>`,
      footer: `
        <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-success btn-md" id="btn-confirmar-pagamento">${valorRestante <= 0 ? 'Quitar Dívida' : 'Confirmar Recebimento'}</button>`
    });

    const btnConfirmar = document.getElementById('btn-confirmar-pagamento');

    document.getElementById('pay-value').addEventListener('input', () => {
      const valorInformado = parseFloat(document.getElementById('pay-value').value) || 0;
      if (valorInformado < valorRestante) {
        btnConfirmar.textContent = 'Pagamento Parcial';
        btnConfirmar.classList.remove('btn-success');
        btnConfirmar.classList.add('btn-warning');
      } else {
        btnConfirmar.textContent = valorRestante <= 0 ? 'Quitar Dívida' : 'Confirmar Recebimento';
        btnConfirmar.classList.remove('btn-warning');
        btnConfirmar.classList.add('btn-success');
      }
    });

    btnConfirmar.addEventListener('click', async () => {
      const payTypeId = parseInt(document.getElementById('pay-type').value);
      const clientId = document.getElementById('pay-client').value || null;
      const totalOriginal = parseFloat(document.getElementById('pay-value').value);

      const tipoPgto = document.getElementById('pay-type').options[document.getElementById('pay-type').selectedIndex].text;
      const isVale = tipoPgto.toLowerCase().includes('vale');
      const isPagamentoParcial = totalOriginal < valorRestante;

      if (isVale && !clientId) {
        return showToast('Para pagamentos em Vale, selecione um cliente.', 'warning');
      }

      const numericClientId = clientId ? parseInt(clientId) : null;

      const payload = {
        value: isVale ? 0 : totalOriginal,
        type_pay: payTypeId,
        client: numericClientId,
        description: isVale ? `Vale - R$ ${totalOriginal.toFixed(2)}` : (document.getElementById('pay-desc').value || ''),
        status: isVale ? 'FIADO' : (isPagamentoParcial ? 'OPEN' : 'CLOSED')
      };

      if (!isVale && (isNaN(payload.value) || payload.value <= 0)) {
        return showToast('Informe um valor válido.', 'error');
      }

      try {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Processando...';

        const rPay = await window.electronAPI.post(`/comandas/${comanda.id}/pagar`, payload);
        if (!rPay.ok) throw new Error(rPay.error);

        if (isVale) {
          await new Promise(r => setTimeout(r, 300));
          const rPatch = await window.electronAPI.patch(`/comandas/${comanda.id}`, {
            status: 'FIADO',
            client: numericClientId
          });
          if (!rPatch.ok) console.error('[PDV] Erro no patch FIADO:', rPatch.error);
        }

        if (isPagamentoParcial) {
          showToast('Pagamento parcial registrado!', 'success');
        } else if (valorRestante <= 0) {
          showToast('Dívida quitada!', 'success');
        } else {
          showToast(isVale ? 'Venda registrada como FIADO!' : 'Pagamento realizado!', 'success');
        }
        closeModal();
        loadComandas(_mesasRef);
        if (onPaymentComplete) onPaymentComplete();
      } catch (err) {
        showToast(err.message, 'error');
        if (btnConfirmar) {
          btnConfirmar.disabled = false;
          btnConfirmar.textContent = totalOriginal < valorRestante ? 'Pagamento Parcial' : 'Confirmar Recebimento';
        }
      }
    });
  } catch (err) {
    console.error('[PDV] Erro ao abrir modal de pagamento:', err);
    showToast('Erro ao abrir tela de pagamento.', 'error');
  }
}

function filtrarComandas() {
  const q = document.getElementById('search-comanda')?.value.toLowerCase() || '';
  const status = document.getElementById('filter-status')?.value || '';
  const filtered = _comandasData.filter(c => {
    const matchQ = !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.mesa_name || '').toLowerCase().includes(q) ||
      String(c.id).includes(q);
    const matchStatus = !status ||
      (status === 'ACTIVE' ? (c.status === 'OPEN' || c.status === 'PAYING') : (c.status === status));
    return matchQ && matchStatus;
  });
  renderComandasTable(filtered);
}

// ─── Modal de Itens (Novo Layout PDV Split) ───────────────────────────────────
async function abrirItensComanda(comandaIdOrObj) {
  let comanda = typeof comandaIdOrObj === 'object' ? comandaIdOrObj : _comandasData.find(c => String(c.id) === String(comandaIdOrObj));

  if (!comanda) return showToast('Comanda não encontrada.', 'error');

  console.log(`[PDV] Abrindo comanda #${comanda.id}:`, comanda);
  console.log(`[PDV] Itens da comanda #${comanda.id}:`, comanda.items || []);

  const ativa = comanda.status === 'OPEN' || comanda.status === 'PAYING';
  const podeAdd = comanda.status === 'OPEN';


  // Carrega produtos (ativos)
  const pRes = await window.electronAPI.get('/products');
  let todosProdutos = pRes.ok ? pRes.data.filter(p => p.active) : [];

  openModal({
    full: true,
    title: `🛒 #${comanda.id} — ${comanda.name || ''} (${comanda.mesa_name || ''}) — ${formatDate(comanda.dt_open)}`,
    body: `
      <div class="pdv-container">
        <!-- Lado Esquerdo: Itens da Comanda -->
        <div class="pdv-left" id="pdv-items-list">
          <div class="loading-screen"><div class="spinner"></div></div>
        </div>
        
        <!-- Lado Direito: Catálogo de Produtos -->
        <div class="pdv-right">
          <div class="pdv-header">
            <input type="text" class="search-input" id="pdv-search" placeholder="🔍 Buscar produto..." style="width:100%" />
          </div>
          <div class="pdv-products-grid" id="pdv-products-grid">
            <!-- Cards aqui -->
          </div>
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary btn-md" id="btn-pdv-imprimir">🖨️ Imprimir</button>
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Sair do PDV</button>
    `,
  });

  // Carrega pagamentos específicos desta comanda
  let pagamentosComanda = _paymentsMap[comanda.id] || [];
  if (!pagamentosComanda.length) {
    const pagsRes = await window.electronAPI.get('/payments');
    if (pagsRes.ok) {
      pagamentosComanda = (pagsRes.data || []).filter(p => String(p.comanda) === String(comanda.id));
    }
  }

  // Calcula totais fora do renderLeft para uso na impressão
  const totalComanda = (comanda.items || []).reduce((acc, it) => acc + (_productsMap[String(it.product)] || 0), 0);

  const renderLeft = () => {
    const container = document.getElementById('pdv-items-list');
    if (!container) return;

    const itens = comanda.items || [];
    const totalPago = pagamentosComanda.reduce((acc, p) => acc + parseFloat(p.value || 0), 0);
    const valorRestante = totalComanda - totalPago;
    const temPagamentos = pagamentosComanda.length > 0;

    container.innerHTML = `
      <div style="flex:1; overflow-y: auto;">
        <h4 style="margin-bottom:12px;color:var(--text-secondary);font-size:0.8rem;text-transform:uppercase">Itens na Comanda</h4>
        ${itens.length ? `
          <table style="width:100%;font-size:0.9rem">
            <thead><tr style="color:var(--text-muted);border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:8px 0">Produto</th>
              <th style="text-align:right;padding:8px 0">Preço</th>
              ${podeAdd ? '<th style="text-align:center;padding:8px 0">Ação</th>' : ''}
            </tr></thead>
            <tbody>
              ${itens.map(it => {
      const prod = todosProdutos.find(p => String(p.id) === String(it.product));
      const isCuisine = prod?.cuisine || false;
      const tooltip = it.obs ? `title="${it.obs}"` : '';

      return `
                <tr data-item-id="${it.id}">
                  <td style="padding:10px 0;border-bottom:1px solid var(--border)" ${tooltip}>
                    ${prod?.name || it.product_name || `Produto #${it.product}`}
                  </td>
                  <td style="padding:10px 0;text-align:right;border-bottom:1px solid var(--border)">
                    R$ ${(_productsMap[String(it.product)] || 0).toFixed(2)}
                  </td>
                  ${podeAdd ? `
                  <td style="padding:10px 0;text-align:center;border-bottom:1px solid var(--border)">
                    <div style="display:flex; gap:8px; justify-content:center">
                      ${isCuisine ? `
                        <button class="btn btn-ghost btn-sm btn-edit-obs" data-id="${it.id}" title="Editar observação" style="color: var(--primary); font-size: 1rem;">
                          📝
                        </button>
                      ` : ''}
                      <button class="btn btn-ghost btn-sm btn-del-item" data-id="${it.id}" title="Excluir item" style="color: var(--danger); font-size: 1rem;">
                        🗑️
                      </button>
                    </div>
                  </td>` : ''}
                </tr>`;
    }).join('')}
            </tbody>
          </table>
        ` : `<p style="padding:20px 0;text-align:center;color:var(--text-muted)">Nenhum item adicionado.</p>`}

        ${temPagamentos ? `
          <h4 style="margin:20px 0 12px 0;color:var(--text-secondary);font-size:0.8rem;text-transform:uppercase;border-top:1px solid var(--border);padding-top:16px">Pagamentos Recebidos</h4>
          <table style="width:100%;font-size:0.85rem">
            <thead><tr style="color:var(--text-muted);border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:6px 0">Forma</th>
              <th style="text-align:right;padding:6px 0">Valor</th>
            </tr></thead>
            <tbody>
              ${pagamentosComanda.map(p => {
      const tipoNome = _paymentTypes.find(t => String(t.id) === String(p.type_pay))?.name || _paymentTypes.find(t => String(t.id) === String(p.type_pay))?.nome || '–';
      return `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid var(--border);color:var(--success)">
                    💰 ${tipoNome}
                  </td>
                  <td style="padding:8px 0;text-align:right;border-bottom:1px solid var(--border);color:var(--success)">
                    R$ ${parseFloat(p.value || 0).toFixed(2)}
                  </td>
                </tr>`;
    }).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
      <div style="padding-top:20px;margin-top:auto;border-top:2px solid var(--border)">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--text-secondary)">Total de Itens:</span>
          <strong>${itens.length}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-secondary)">Total da Conta:</span>
          <strong style="color:${temPagamentos ? 'var(--text-muted);text-decoration:line-through' : 'var(--success)'}">R$ ${totalComanda.toFixed(2)}</strong>
        </div>
        ${temPagamentos ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--text-secondary)">Valor Pago:</span>
          <strong style="color:var(--success)">R$ ${totalPago.toFixed(2)}</strong>
        </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <span style="color:var(--text-secondary);font-size:1.1rem">${temPagamentos ? 'Restante:' : 'Total:'}</span>
          <strong style="color:${valorRestante <= 0 ? 'var(--success)' : 'var(--warning)'};font-size:1.3rem">R$ ${Math.max(0, valorRestante).toFixed(2)}</strong>
        </div>
        ${ativa ? `
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
            <button class="btn btn-success btn-lg" id="btn-pdv-receber">💰 Receber</button>
            <button class="btn btn-danger btn-lg" id="btn-pdv-excluir">🗑️ Excluir</button>
            </div>
        ` : ''}
      </div>`;

    // Listeners de exclusão de item individual
    container.querySelectorAll('.btn-del-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = btn.dataset.id;
        if (confirm('Deseja realmente excluir este item da comanda?')) {
          const r = await window.electronAPI.delete(`/items-comanda/${itemId}`);
          if (r.ok) {
            showToast('Item excluído!', 'success');
            comanda.items = comanda.items.filter(it => it.id !== parseInt(itemId));
            renderLeft();
            loadComandas(_mesasRef);
          } else {
            showToast(r.error, 'error');
          }
        }
      });
    });

    // Listeners de edição de observação
    container.querySelectorAll('.btn-edit-obs').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = String(btn.dataset.id);
        const item = comanda.items.find(it => String(it.id) === itemId);
        const prod = todosProdutos.find(p => String(p.id) === String(item?.product));

        if (item && prod) {
          window.abrirModalObsCozinhaGlobal(prod.name, item.obs || '', async (novaObs) => {
            if (novaObs === null || novaObs === item.obs) return;

            // Busca os pedidos para encontrar o ID da order vinculada
            const ordersRes = await window.electronAPI.get('/orders');
            if (ordersRes.ok) {
              const linkedOrder = ordersRes.data.find(o => String(o.productComanda) === itemId);

              if (linkedOrder) {
                // PATCH na Order (Cozinha)
                const r = await window.electronAPI.patch(`/orders/${linkedOrder.id}`, { obs: novaObs });
                if (r.ok) {
                  item.obs = novaObs; // Atualiza local
                  showToast('Observação enviada para a cozinha!', 'success');
                  renderLeft();
                } else {
                  showToast('Erro ao atualizar na cozinha.', 'error');
                }
              } else {
                // Se não achou a order, tenta atualizar só o item principal como fallback
                await window.electronAPI.patch(`/items-comanda/${itemId}`, { obs: novaObs });
                item.obs = novaObs;
                renderLeft();
                showToast('Observação salva (item sem vínculo cozinha).', 'info');
              }
            }
          });
        }
      });
    });

    // Listeners do rodapé do PDV (Receber, Excluir e Imprimir)
    const bRec = document.getElementById('btn-pdv-receber');
    if (bRec) {
      bRec.onclick = () => {
        closeModal();
        setTimeout(() => abrirModalPagamento(comanda, () => {
          setTimeout(() => abrirItensComanda(comanda), 300);
        }), 300);
      };
    }

    const bImp = document.getElementById('btn-pdv-imprimir');
    if (bImp) {
      bImp.onclick = () => imprimirComanda(comanda, pagamentosComanda, totalComanda);
    }

    const bExc = document.getElementById('btn-pdv-excluir');
    if (bExc) {
      bExc.onclick = async () => {
        if (confirm('Deseja realmente EXCLUIR/APAGAR esta comanda?')) {
          const r = await window.electronAPI.post(`/comandas/${comanda.id}/apagar`, {});
          if (r.ok) {
            showToast('Comanda excluída!', 'success');
            closeModal();
            loadComandas(_mesasRef);
          } else {
            showToast(r.error, 'error');
          }
        }
      };
    }
  };

  const processarResultadoAdd = async (r, prod, obs = '') => {
    if (r.ok) {
      if (!comanda.items) comanda.items = [];

      const novoItem = r.data;
      // Normaliza o campo product caso o servidor retorne product_id
      if (!novoItem.product && novoItem.product_id) novoItem.product = novoItem.product_id;

      comanda.items.push(novoItem);
      renderLeft();
      loadComandas(_mesasRef);

      // Se o produto for de cozinha, cria a order na nova rota
      if (prod && prod.cuisine) {
        const orderPayload = {
          productComanda: novoItem.id, // ID do item vinculado
          id_product: prod.id,
          id_comanda: comanda.id,
          obs: obs || novoItem.obs || ''
        };

        console.log('[PDV] Criando pedido na cozinha:', orderPayload);
        const orderRes = await window.electronAPI.post('/orders', orderPayload);
        if (orderRes.ok) {
          showToast('Pedido enviado para a cozinha!', 'success');
        } else {
          showToast('Item adicionado, mas falhou ao enviar para cozinha.', 'warning');
        }
      }
    } else {
      showToast(r.error, 'error');
    }
  };

  const bindProductClicks = (container, filtrados) => {
    container.querySelectorAll('.pdv-product-card').forEach(card => {
      card.addEventListener('click', async () => {
        if (!podeAdd) return showToast('Comanda em fechamento ou fechada.', 'warning');
        const pId = String(card.dataset.id);
        const prod = todosProdutos.find(x => String(x.id) === pId);

        card.style.transform = 'scale(0.95)';
        setTimeout(() => card.style.transform = '', 100);

        if (!prod) return showToast('Erro: Produto não encontrado.', 'error');

        if (prod.cuisine) {
          window.abrirModalObsCozinhaGlobal(prod.name, '', async (obs) => {
            if (obs === null) return;
            const loggedUser = await window.electronAPI.getUser();
            const r = await window.electronAPI.post('/items-comanda', {
              comanda: comanda.id,
              product: prod.id,
              obs: obs,
              applicant: loggedUser?.username || 'Sistema'
            });
            processarResultadoAdd(r, prod, obs);
          });
        } else {
          const loggedUser = await window.electronAPI.getUser();
          const r = await window.electronAPI.post('/items-comanda', {
            comanda: comanda.id,
            product: prod.id,
            applicant: loggedUser?.username || 'Sistema'
          });
          processarResultadoAdd(r, prod);
        }
      });
    });
  };

  const renderRight = (filtro = '') => {
    const container = document.getElementById('pdv-products-grid');
    if (!container) return;

    const filtrados = todosProdutos.filter(p => !filtro || p.name.toLowerCase().includes(filtro.toLowerCase())).slice(0, 20);

    // console.log('Produtos carregados no PDV:', todosProdutos);
    container.innerHTML = filtrados.map(p => {
      const imgTarget = p.image ? `url('${p.image}')` : `url('https://wallpapers.com/images/featured/fundo-abstrato-escuro-27kvn4ewpldsngbu.jpg')`;
      return `
        <div class="pdv-product-card" data-id="${p.id}">
          <div class="pdv-product-bg" style="background-image: ${imgTarget}"></div>
          <div class="pdv-product-info">
            <div class="pdv-product-name">${p.name}</div>
            <div class="pdv-product-price">R$ ${parseFloat(p.price || 0).toFixed(2)}</div>
          </div>
        </div>
      `;
    }).join('');

    bindProductClicks(container, filtrados);
  };

  // Inicializa
  renderLeft();
  renderRight();

  document.getElementById('pdv-search')?.addEventListener('input', (e) => renderRight(e.target.value));

  // Foco no campo de busca ao abrir o PDV
  setTimeout(() => document.getElementById('pdv-search')?.focus(), 200);
}


// ─── Modal Comanda (Nova / Editar) ──────────────────────────────────────────
function abrirModalNovaComanda(mesas, comandaExistente = null) {
  const isEdit = !!comandaExistente;
  
  openModal({
    title: isEdit ? `Editar Comanda #${comandaExistente.id}` : 'Nova Comanda',
    body: `
      <form id="form-comanda" class="form-grid">
        <div class="form-group">
          <label>Nome do Cliente / Identificação</label>
          <input type="text" id="comanda-nome" class="form-control" placeholder="Ex: João, Mesa do fundo..." value="${isEdit ? (comandaExistente.name || '') : ''}" autofocus required />
        </div>
        <div class="form-group">
          <label>Mesa</label>
          <select id="comanda-mesa" class="form-control">
            ${mesas.map(m => `<option value="${m.id}" ${isEdit && String(comandaExistente.mesa) === String(m.id) ? 'selected' : ''}>${m.nome || m.name || `Mesa ${m.numero || m.number || m.id}`}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Relacionar Cliente (Opcional)</label>
          <select id="comanda-cliente" class="form-control">
            <option value="">Nenhum Cliente</option>
            ${_clients.filter(cl => cl.active !== false).map(cl => `
              <option value="${cl.id}" ${isEdit && String(comandaExistente.client) === String(cl.id) ? 'selected' : ''}>
                ${cl.name}
              </option>
            `).join('')}
          </select>
        </div>
        <button type="submit" style="display:none"></button>
      </form>`,
    footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary btn-md" id="btn-salvar-comanda">${isEdit ? 'Salvar Alterações' : 'Criar e Adicionar Itens'}</button>`,
  });

  setTimeout(() => document.getElementById('comanda-nome')?.focus(), 100);

  const submeter = async (e) => {
    if (e) e.preventDefault();
    const mesaId = parseInt(document.getElementById('comanda-mesa').value);
    const clientId = document.getElementById('comanda-cliente').value ? parseInt(document.getElementById('comanda-cliente').value) : null;
    const nome = document.getElementById('comanda-nome').value.trim();

    if (!nome) return showToast('Informe o nome ou identificação.', 'error');

    const btn = document.getElementById('btn-salvar-comanda');
    btn.disabled = true;
    btn.textContent = isEdit ? 'Salvando...' : 'Criando...';

    const loggedUser = await window.electronAPI.getUser();
    const payload = {
      mesa: mesaId,
      user: loggedUser?.id || 1,
      client: clientId,
      name: nome,
    };

    let r;
    if (isEdit) {
      r = await window.electronAPI.patch(`/comandas/${comandaExistente.id}`, payload);
    } else {
      r = await window.electronAPI.post('/comandas', payload);
    }

    if (r.ok) {
      showToast(isEdit ? 'Comanda atualizada!' : 'Comanda criada!', 'success');
      closeModal();
      loadComandas(_mesasRef);
      if (!isEdit) {
        setTimeout(() => abrirItensComanda(r.data), 300);
      }
    } else {
      showToast(r.error, 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Salvar Alterações' : 'Criar e Adicionar Itens';
    }
  };

  document.getElementById('form-comanda').onsubmit = submeter;
  document.getElementById('btn-salvar-comanda').onclick = submeter;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return '–';
  return new Date(str).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
