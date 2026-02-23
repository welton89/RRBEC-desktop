export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-subtitle">Visão geral do seu estabelecimento</div>
      </div>
    </div>
    <div class="cards-grid cards-grid-4" id="dash-stats">
      <div class="card stat-card">
        <div class="stat-icon purple">🪑</div>
        <div><div class="stat-value" id="stat-mesas">–</div><div class="stat-label">Mesas Abertas</div></div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon amber">📋</div>
        <div><div class="stat-value" id="stat-comandas">–</div><div class="stat-label">Comandas Ativas</div></div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon green">🛒</div>
        <div><div class="stat-value" id="stat-pedidos">–</div><div class="stat-label">Pedidos Hoje</div></div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon blue">👥</div>
        <div><div class="stat-value" id="stat-clientes">–</div><div class="stat-label">Clientes Cad.</div></div>
      </div>
    </div>
    <div class="cards-grid cards-grid-2" style="padding-top:0">
      <div class="card">
        <h3 style="font-size:1rem;margin-bottom:16px;">🪑 Status das Mesas</h3>
        <div id="dash-mesas-preview" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
      </div>
      <div class="card">
        <h3 style="font-size:1rem;margin-bottom:16px;">📋 Últimas Comandas</h3>
        <div id="dash-comandas-preview"></div>
      </div>
    </div>`;

  // Carrega dados em paralelo
  const [mesas, comandas, pedidos, clientes] = await Promise.all([
    window.electronAPI.get('/mesas/'),
    window.electronAPI.get('/comandas/'),
    window.electronAPI.get('/orders/'),
    window.electronAPI.get('/clients/'),
  ]);

  if (mesas.ok) {
    // Cruza com comandas para verificar ocupação
    const mesasOcupadas = new Set();
    if (comandas.ok) {
      comandas.data.forEach(c => {
        if ((c.status === 'OPEN' || c.status === 'PAYING') && c.mesa) mesasOcupadas.add(c.mesa);
      });
    }

    const abertas = mesas.data.filter(m => m.active && mesasOcupadas.has(m.id)).length;
    document.getElementById('stat-mesas').textContent = abertas;

    const preview = document.getElementById('dash-mesas-preview');
    preview.innerHTML = mesas.data.slice(0, 12).map(m => {
      const ocupada = mesasOcupadas.has(m.id);
      return `<span style="padding:4px 10px;border-radius:6px;font-size:0.78rem;font-weight:600;
        background:${ocupada ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)'};
        color:${ocupada ? '#fca5a5' : '#86efac'}">
        ${m.name}
      </span>`;
    }).join('');
  }

  if (comandas.ok) {
    document.getElementById('stat-comandas').textContent = comandas.data.filter(c => c.status === 'OPEN' || c.status === 'PAYING').length;
    const preview = document.getElementById('dash-comandas-preview');
    preview.innerHTML = `<table style="width:100%;font-size:0.85rem">
      <thead><tr style="color:var(--text-muted)"><th style="text-align:left;padding:4px 0">ID</th><th style="text-align:left">Nome/Mesa</th><th style="text-align:left">Status</th></tr></thead>
      <tbody>
        ${comandas.data.slice(0, 5).map(c => {
      const statusLabel = c.status === 'OPEN' ? 'Aberta' : (c.status === 'PAYING' ? 'Pagando' : 'Fechada');
      const badgeClass = c.status === 'OPEN' ? 'badge-success' : (c.status === 'PAYING' ? 'badge-warning' : 'badge-muted');
      return `
          <tr>
            <td style="padding:6px 0">#${c.id}</td>
            <td>${c.name || c.mesa_name || '–'}</td>
            <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
          </tr>`;
    }).join('')}
      </tbody>
    </table>`;
  }

  if (pedidos.ok) {
    const hoje = new Date().toISOString().slice(0, 10);
    const pedidosHoje = pedidos.data.filter(p => (p.created_at || p.data || '').startsWith(hoje)).length;
    document.getElementById('stat-pedidos').textContent = pedidosHoje || pedidos.data.length;
  }

  if (clientes.ok) {
    document.getElementById('stat-clientes').textContent = clientes.data.length;
  }
}
