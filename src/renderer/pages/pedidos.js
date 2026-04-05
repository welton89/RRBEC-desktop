// Pedidos = Fila de Cozinha (KDS - Kitchen Display System)
// Cada "order" representa um item individual na fila, com pipeline de status por timestamps

const STATUS_CONFIG = {
  'Na fila': { badge: 'badge-warning', icon: '⏳', next: 'preparing', nextLabel: '▶ Preparando' },
  'Preparando': { badge: 'badge-info', icon: '🍳', next: 'finished', nextLabel: '✅ Pronto' },
  'Pronto': { badge: 'badge-success', icon: '✅', next: 'delivered', nextLabel: '🚀 Entregue' },
  'Entregue': { badge: 'badge-muted', icon: '🚀', next: null, nextLabel: null },
  'Cancelado': { badge: 'badge-danger', icon: '❌', next: null, nextLabel: null },
};

function getOrderStatus(o) {
  if (o.canceled && o.canceled !== '0001-01-01T00:00:00Z') return 'Cancelado';
  if (o.delivered && o.delivered !== '0001-01-01T00:00:00Z') return 'Entregue';
  if (o.finished && o.finished !== '0001-01-01T00:00:00Z') return 'Pronto';
  if (o.preparing && o.preparing !== '0001-01-01T00:00:00Z') return 'Preparando';
  return 'Na fila';
}

export async function renderPedidos(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">🛒 Pedidos</div>
        <div class="page-subtitle">Fila de cozinha em tempo real</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-md" id="btn-refresh-orders">↺ Atualizar</button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <input type="text" class="search-input" id="search-order" placeholder="🔍 Buscar produto, comanda ou mesa..." />
        <select id="filter-status-order" class="form-control" style="width:160px">
          <option value="">Todos os status</option>
          <option value="Na fila">⏳ Na fila</option>
          <option value="Preparando">🍳 Preparando</option>
          <option value="Pronto">✅ Pronto</option>
          <option value="Entregue">🚀 Entregue</option>
          <option value="Cancelado">❌ Cancelado</option>
        </select>
      </div>
      <div id="orders-table"></div>
    </div>`;

  await loadOrders();

  document.getElementById('btn-refresh-orders').addEventListener('click', loadOrders);
  document.getElementById('search-order').addEventListener('input', () => filtrarOrders());
  document.getElementById('filter-status-order').addEventListener('change', () => filtrarOrders());
}

let _ordersData = [];
let _productsMap = {};
let _comandasMap = {};
let _mesasMap = {};
let _productsFullMap = {};

async function loadOrders() {
  const wrap = document.getElementById('orders-table');
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  
  // Busca tudo em paralelo para resolver as referências (IDs)
  const [res, pRes, cRes, mRes] = await Promise.all([
    window.electronAPI.get('/orders'),
    window.electronAPI.get('/products'),
    window.electronAPI.get('/comandas'),
    window.electronAPI.get('/mesas')
  ]);

  if (!res.ok) { wrap.innerHTML = `<div class="table-empty">Erro ao carregar pedidos.</div>`; return; }
  
  if (pRes.ok) {
    _productsMap = pRes.data.reduce((acc, p) => { acc[String(p.id)] = p.name; return acc; }, {});
    _productsFullMap = pRes.data.reduce((acc, p) => { acc[String(p.id)] = p; return acc; }, {});
  }
  if (mRes.ok) _mesasMap = mRes.data.reduce((acc, m) => { acc[String(m.id)] = m.name; return acc; }, {});
  if (cRes.ok) _comandasMap = cRes.data.reduce((acc, c) => {
    acc[String(c.id)] = {
      id: c.id,
      name: c.name || '–',
      mesa: _mesasMap[String(c.mesa)] || `Mesa ${c.mesa}` || '–',
      mesa_name: c.mesa_name || _mesasMap[String(c.mesa)] || '–'
    };
    return acc;
  }, {});

  _ordersData = res.data;

  // Por padrão, filtra para mostrar só os não entregues/cancelados
  const filtroInicial = document.getElementById('filter-status-order');
  if (filtroInicial && !filtroInicial.value) {
    // Mantém o filtro se necessário
  }
  renderOrdersTable(_ordersData);
}

function renderOrdersTable(data) {
  const wrap = document.getElementById('orders-table');
  if (!wrap) return;
  if (!data.length) { wrap.innerHTML = `<div class="table-empty">Nenhum pedido encontrado.</div>`; return; }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th>
        <th>Produto</th>
        <th>Comanda</th>
        <th>Mesa</th>
        <th>Status</th>
        <th>Na fila</th>
        <th>Obs.</th>
        <th>Ações</th>
      </tr></thead>
      <tbody>
        ${data.map(o => {
    const status = getOrderStatus(o);
    const cfg = STATUS_CONFIG[status] || { badge: 'badge-muted', icon: '?', next: null };
    
    // Resolve nomes com base nos IDs
    const prodName = _productsMap[String(o.id_product)] || o.product_name || `ID #${o.id_product}`;
    const comandaInfo = _comandasMap[String(o.id_comanda)] || { name: `Comanda #${o.id_comanda}`, mesa: '–' };

    return `<tr>
            <td style="color:var(--text-muted)">#${o.id}</td>
            <td><strong>${prodName}</strong></td>
            <td style="font-size:0.82rem;color:var(--text-secondary)">${comandaInfo.name}</td>
            <td style="font-size:0.82rem">${comandaInfo.mesa}</td>
            <td><span class="badge ${cfg.badge}">${cfg.icon} ${status}</span></td>
            <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${formatTime(o.queue)}</td>
            <td style="font-size:0.8rem;color:var(--text-secondary);max-width:140px;">
              <div style="display:flex;align-items:center;gap:4px">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.obs || ''}">${o.obs || '–'}</span>
                <button class="btn btn-ghost btn-sm btn-edit-obs" data-id="${o.id}" data-obs="${o.obs || ''}" title="Editar observação" style="padding:0;color:var(--primary);font-size:1rem;min-height:unset;height:auto">✎</button>
              </div>
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn btn-secondary btn-sm btn-reprint" data-id="${o.id}" title="Reimprimir Ticket">🖨️</button>
                ${cfg.next ? `<button class="btn btn-success btn-sm btn-avanca" data-id="${o.id}" data-next="${cfg.next}">${cfg.nextLabel}</button>` : ''}
                ${o.status !== 'Cancelado' && o.status !== 'Entregue'
        ? `<button class="btn btn-danger btn-sm btn-cancela" data-id="${o.id}">✕</button>`
        : ''}
              </div>
            </td>
          </tr>`;
  }).join('')}
      </tbody>
    </table>
    <div style="padding:12px 20px;border-top:1px solid var(--border);font-size:0.8rem;color:var(--text-muted)">
      ${data.length} ${data.length === 1 ? 'pedido' : 'pedidos'} exibidos
      &nbsp;·&nbsp; ⏳ ${data.filter(o => getOrderStatus(o) === 'Na fila').length} na fila
      &nbsp;·&nbsp; 🍳 ${data.filter(o => getOrderStatus(o) === 'Preparando').length} preparando
      &nbsp;·&nbsp; ✅ ${data.filter(o => getOrderStatus(o) === 'Pronto').length} prontos
    </div>`;

  // Avançar status para próxima etapa
  wrap.querySelectorAll('.btn-avanca').forEach(btn =>
    btn.addEventListener('click', async () => {
      const nowISO = new Date().toISOString();
      const patch = { [btn.dataset.next]: nowISO };
      const r = await window.electronAPI.patch(`/orders/${btn.dataset.id}`, patch);
      if (r.ok) { showToast('Status atualizado!', 'success'); loadOrders(); }
      else showToast(r.error, 'error');
    })
  );

  // Cancelar pedido
  wrap.querySelectorAll('.btn-cancela').forEach(btn =>
    btn.addEventListener('click', async () => {
      const r = await window.electronAPI.patch(`/orders/${btn.dataset.id}`, { canceled: new Date().toISOString() });
      if (r.ok) { showToast('Pedido cancelado.', 'info'); loadOrders(); }
      else showToast(r.error, 'error');
    })
  );

  // Reimprimir ticket de cozinha
  wrap.querySelectorAll('.btn-reprint').forEach(btn =>
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      const order = _ordersData.find(o => String(o.id) === String(orderId));
      if (!order) return showToast('Pedido não encontrado.', 'error');
      
      const comanda = _comandasMap[String(order.id_comanda)];
      const product = _productsFullMap[String(order.id_product)];
      
      const dataAtual = new Date().toLocaleString('pt-BR');
      const nomeEstabelecimento = 'RRBEC - Bar & Restaurante';
      const nomeProduto = product?.name || order.product_name || `Produto #${order.id_product}`;
      const obs = order.obs || '';
      const usuario = order.applicant || 'Sistema';
      const nomeComanda = comanda?.name || `Comanda #${comanda?.id || order.id_comanda}`;
      const nomeMesa = comanda?.mesa_name || comanda?.mesa || '–';

      const htmlTicket = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Ticket Cozinha - ${nomeComanda}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Courier New', monospace; font-size: 13px; padding: 8px; width: 80mm; }
            .ticket { display: block; color: black; }
            .ticket * { color: black !important; background: transparent !important; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
            .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
            .subtitle { font-size: 12px; margin-top: 4px; }
            .info { margin: 4px 0; font-size: 12px; }
            .info strong { font-size: 14px; }
            .product { font-size: 18px; font-weight: bold; text-align: center; margin: 12px 0; padding: 8px; border: 3px double #000; text-transform: uppercase; }
            .obs { font-style: italic; font-size: 11px; text-align: center; margin-top: 8px; padding: 6px; border: 1px dashed #000; }
            .footer { text-align: center; font-size: 10px; margin-top: 8px; color: #666; }
            @media print { @page { size: 80mm auto; margin: 0; } }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <div class="title">🍳 COZINHA - REIMPRESSÃO</div>
              <div class="subtitle">${nomeEstabelecimento}</div>
            </div>
            
            <div class="info" style="text-align:center">
              <strong>${nomeComanda}</strong>
            </div>
            <div class="info" style="display:flex;justify-content:space-between">
              <span>Mesa: ${nomeMesa}</span>
              <span>${dataAtual}</span>
            </div>
            
            <div class="product">${nomeProduto}</div>
            
            ${obs ? `<div class="obs">OBS: ${obs}</div>` : ''}
            
            <div class="footer">
              Atendido por: ${usuario}
            </div>
          </div>
        </body>
        </html>
      `;

      window.electronAPI.printDirect(htmlTicket).then(r => {
        if (r.ok) {
          showToast('Ticket reimpresso!', 'success');
        } else if (r.error === 'NO_PRINTER') {
          showToast('⚠️ Nenhuma impressora configurada. Configure uma impressora nas configurações do sistema.', 'warning', 5000);
          const printWindow = window.open('', '', 'width=300,height=400');
          printWindow.document.write(htmlTicket);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 300);
        } else {
          const printWindow = window.open('', '', 'width=300,height=400');
          printWindow.document.write(htmlTicket);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 300);
        }
      });
    })
  );

  // Editar observação
  wrap.querySelectorAll('.btn-edit-obs').forEach(btn =>
    btn.addEventListener('click', () => {
      const currentObs = btn.dataset.obs || '';
      const orderId = btn.dataset.id;
      // Para o nome do produto, usamos o valor mais próximo ou apenas "Pedido #"
      const row = btn.closest('tr');
      const productName = row ? row.querySelector('td:nth-child(2) strong').innerText : `Pedido #${orderId}`;

      window.abrirModalObsCozinhaGlobal(productName, currentObs, async (novaObs) => {
        if (novaObs === null || novaObs === currentObs) return;

        const r = await window.electronAPI.patch(`/orders/${orderId}`, { obs: novaObs });
        if (r.ok) {
          showToast('Observação atualizada!', 'success');
          loadOrders();
        } else {
          showToast(r.error, 'error');
        }
      });
    })
  );
}


function filtrarOrders() {
  const q = document.getElementById('search-order')?.value.toLowerCase() || '';
  const status = document.getElementById('filter-status-order')?.value || '';

  const filtered = _ordersData.filter(o => {
    const matchQ = !q ||
      (o.product_name || '').toLowerCase().includes(q) ||
      (o.comanda_name || '').toLowerCase().includes(q) ||
      (o.mesa_name || '').toLowerCase().includes(q) ||
      (o.obs || '').toLowerCase().includes(q);
    const matchStatus = !status || getOrderStatus(o) === status;
    return matchQ && matchStatus;
  });
  renderOrdersTable(filtered);
}

function formatTime(str) {
  if (!str) return '–';
  return new Date(str).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
