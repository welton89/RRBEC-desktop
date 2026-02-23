// Pedidos = Fila de Cozinha (KDS - Kitchen Display System)
// Cada "order" representa um item individual na fila, com pipeline de status por timestamps

const STATUS_CONFIG = {
  'Em espera': { badge: 'badge-warning', icon: '⏳', next: 'preparing', nextLabel: '▶ Preparando' },
  'Preparando': { badge: 'badge-info', icon: '🍳', next: 'finished', nextLabel: '✅ Pronto' },
  'Pronto': { badge: 'badge-success', icon: '✅', next: 'delivered', nextLabel: '🚀 Entregue' },
  'Entregue': { badge: 'badge-muted', icon: '🚀', next: null, nextLabel: null },
  'Cancelado': { badge: 'badge-danger', icon: '❌', next: null, nextLabel: null },
};

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
          <option value="Em espera">⏳ Em espera</option>
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

async function loadOrders() {
  const wrap = document.getElementById('orders-table');
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  const res = await window.electronAPI.get('/orders/');
  if (!res.ok) { wrap.innerHTML = `<div class="table-empty">Erro ao carregar pedidos.</div>`; return; }
  _ordersData = res.data;

  // Por padrão, filtra para mostrar só os não entregues/cancelados
  const filtroInicial = document.getElementById('filter-status-order');
  if (filtroInicial && !filtroInicial.value) {
    // Mantém filtro vazio mas é renderizado completo
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
    const cfg = STATUS_CONFIG[o.status] || { badge: 'badge-muted', icon: '?', next: null };
    return `<tr>
            <td style="color:var(--text-muted)">#${o.id}</td>
            <td><strong>${o.product_name || '–'}</strong></td>
            <td style="font-size:0.82rem;color:var(--text-secondary)">${o.comanda_name || '–'}</td>
            <td style="font-size:0.82rem">${o.mesa_name || '–'}</td>
            <td><span class="badge ${cfg.badge}">${cfg.icon} ${o.status}</span></td>
            <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${formatTime(o.queue)}</td>
            <td style="font-size:0.8rem;color:var(--text-secondary);max-width:140px;">
              <div style="display:flex;align-items:center;gap:4px">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.obs || ''}">${o.obs || '–'}</span>
                <button class="btn btn-ghost btn-sm btn-edit-obs" data-id="${o.id}" data-obs="${o.obs || ''}" title="Editar observação" style="padding:0;color:var(--primary);font-size:1rem;min-height:unset;height:auto">✎</button>
              </div>
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
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
      &nbsp;·&nbsp; ⏳ ${data.filter(o => o.status === 'Em espera').length} em espera
      &nbsp;·&nbsp; 🍳 ${data.filter(o => o.status === 'Preparando').length} preparando
      &nbsp;·&nbsp; ✅ ${data.filter(o => o.status === 'Pronto').length} prontos
    </div>`;

  // Avançar status para próxima etapa
  wrap.querySelectorAll('.btn-avanca').forEach(btn =>
    btn.addEventListener('click', async () => {
      const nowISO = new Date().toISOString();
      const patch = { [btn.dataset.next]: nowISO };
      const r = await window.electronAPI.patch(`/orders/${btn.dataset.id}/`, patch);
      if (r.ok) { showToast('Status atualizado!', 'success'); loadOrders(); }
      else showToast(r.error, 'error');
    })
  );

  // Cancelar pedido
  wrap.querySelectorAll('.btn-cancela').forEach(btn =>
    btn.addEventListener('click', async () => {
      const r = await window.electronAPI.patch(`/orders/${btn.dataset.id}/`, { canceled: new Date().toISOString() });
      if (r.ok) { showToast('Pedido cancelado.', 'info'); loadOrders(); }
      else showToast(r.error, 'error');
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

        const r = await window.electronAPI.patch(`/orders/${orderId}/`, { obs: novaObs });
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
    const matchStatus = !status || o.status === status;
    return matchQ && matchStatus;
  });
  renderOrdersTable(filtered);
}

function formatTime(str) {
  if (!str) return '–';
  return new Date(str).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
