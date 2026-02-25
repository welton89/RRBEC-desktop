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
  const mesasRes = await window.electronAPI.get('/mesas/');
  if (mesasRes.ok) mesas = mesasRes.data;

  await loadComandas(mesas);

  document.getElementById('btn-nova-comanda').addEventListener('click', () => abrirModalNovaComanda(mesas));
  document.getElementById('search-comanda').addEventListener('input', () => filtrarComandas());
  document.getElementById('filter-status').addEventListener('change', () => filtrarComandas());
}

let _comandasData = [];
let _mesasRef = [];
let _productsMap = {}; // Cache de preços {id: price}
let _paymentTypes = [];
let _clients = [];

async function loadComandas(mesas) {
  _mesasRef = mesas;
  const wrap = document.getElementById('comandas-table');
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;

  // Carrega dados necessários em paralelo
  const [res, pRes, ptRes, cRes] = await Promise.all([
    window.electronAPI.get('/comandas/'),
    window.electronAPI.get('/products/'),
    window.electronAPI.get('/payment-types/'),
    window.electronAPI.get('/clients/')
  ]);

  if (ptRes.ok) _paymentTypes = ptRes.data;
  if (cRes.ok) _clients = cRes.data;

  if (pRes.ok) {
    _productsMap = pRes.data.reduce((acc, p) => {
      acc[p.id] = parseFloat(p.price || 0);
      return acc;
    }, {});
  }

  if (!res.ok) { wrap.innerHTML = `<div class="table-empty">Erro ao carregar comandas.</div>`; return; }
  _comandasData = res.data;

  // Aplica o filtro padrão (Ativas) logo no carregamento
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
        <th>Itens</th>
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
    const totalComanda = (c.items || []).reduce((acc, item) => acc + (_productsMap[item.product] || 0), 0);

    return `<tr>
            <td><strong>#${c.id}</strong></td>
            <td>${c.name || '–'}</td>
            <td>${c.mesa_name || `Mesa ${c.mesa}` || '–'}</td>
            <td><span class="badge ${cfg.badge}">${cfg.label}</span></td>
            <td><strong style="color:var(--success)">R$ ${totalComanda.toFixed(2)}</strong></td>
            <td>${formatDate(c.dt_open)}</td>
            <td>
              <span class="badge badge-info" style="cursor:pointer" data-id="${c.id}" title="Ver itens">
                ${(c.items || []).length} ${(c.items || []).length === 1 ? 'item' : 'itens'}
              </span>
            </td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-secondary btn-sm btn-itens" data-id="${c.id}" title="Itens">🛒</button>
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

  // Listener para Receber
  wrap.querySelectorAll('.btn-receber').forEach(btn => {
    btn.addEventListener('click', () => {
      const comanda = _comandasData.find(c => c.id === parseInt(btn.dataset.id));
      if (comanda) abrirModalReceber(comanda);
    });
  });

  // Listener para botão "Pagar" (muda p/ PAYING)
  wrap.querySelectorAll('.btn-pagar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await window.electronAPI.patch(`/comandas/${btn.dataset.id}/`, { status: 'PAYING' });
      if (r.ok) { showToast('Comanda em fase de pagamento!', 'info'); loadComandas(_mesasRef); }
      else showToast(r.error, 'error');
    });
  });

    // Listener para botão "Reabrir" (muda p/ OPEN)
  wrap.querySelectorAll('.btn-reopen').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await window.electronAPI.patch(`/comandas/${btn.dataset.id}/`, { status: 'OPEN' });
      if (r.ok) { showToast('Comanda reaberta!', 'info'); loadComandas(_mesasRef); }
      else showToast(r.error, 'error');
    });
  });

  // Listener para ver itens da comanda
  wrap.querySelectorAll('.btn-itens').forEach(btn => {
    btn.addEventListener('click', () => {
      const comanda = _comandasData.find(c => c.id === parseInt(btn.dataset.id));
      if (comanda) abrirItensComanda(comanda);
    });
  });

  // Badge de itens também abre o modal
  wrap.querySelectorAll('.badge[data-id]').forEach(badge => {
    badge.addEventListener('click', () => {
      const comanda = _comandasData.find(c => c.id === parseInt(badge.dataset.id));
      if (comanda) abrirItensComanda(comanda);
    });
  });

  // Excluir comanda (Antigo Fechar)
  wrap.querySelectorAll('.btn-excluir').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Deseja realmente EXCLUIR/APAGAR esta comanda?')) {
        const r = await window.electronAPI.post(`/comandas/${btn.dataset.id}/apagar/`, {});
        if (r.ok) {
          showToast('Comanda excluída!', 'success');
          loadComandas(_mesasRef);
        } else {
          showToast(r.error, 'error');
        }
      }
    });
  });
}

function abrirModalReceber(comanda) {
  const total = (comanda.items || []).reduce((acc, it) => acc + (_productsMap[it.product] || 0), 0);

  openModal({
    title: `💰 Receber Pago - Comanda #${comanda.id}`,
    body: `
      <div class="form-grid">
        <div class="form-group">
          <label>Valor Total (R$)</label>
          <input type="number" id="pay-value" class="form-control" value="${total.toFixed(2)}" step="0.01" />
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
            <option value="">Cliente não identificado</option>
            ${_clients.map(cl => `<option value="${cl.id}" ${comanda.client === cl.id ? 'selected' : ''}>${cl.name || cl.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column: span 2">
          <label>Descrição / Observações</label>
          <input type="text" id="pay-desc" class="form-control" placeholder="Ex: Pagamento total..." value="Pagamento total" />
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-success btn-md" id="btn-confirmar-pagamento">Confirmar Recebimento</button>`
  });

  document.getElementById('btn-confirmar-pagamento').addEventListener('click', async () => {
    const payload = {
      value: parseFloat(document.getElementById('pay-value').value),
      type_pay: parseInt(document.getElementById('pay-type').value),
      client: document.getElementById('pay-client').value || null,
      description: document.getElementById('pay-desc').value.trim()
    };

    if (isNaN(payload.value) || payload.value <= 0) {
      return showToast('Informe um valor válido.', 'error');
    }

    const r = await window.electronAPI.post(`/comandas/${comanda.id}/pagar/`, payload);
    if (r.ok) {
      showToast('Pagamento processado e comanda encerrada!', 'success');
      closeModal();
      loadComandas(_mesasRef);
    } else {
      showToast(r.error, 'error');
    }
  });
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
  let comanda = typeof comandaIdOrObj === 'object' ? comandaIdOrObj : _comandasData.find(c => c.id === comandaIdOrObj);
  const ativa = comanda.status === 'OPEN' || comanda.status === 'PAYING';
  const podeAdd = comanda.status === 'OPEN'; // Só permite add se ainda não estiver pagando?


  // Carrega produtos (ativos)
  const pRes = await window.electronAPI.get('/products/');
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
    footer: `<button class="btn btn-secondary btn-md" onclick="closeModal()">Sair do PDV</button>`,
  });

  // Funções internas de renderização
  const renderLeft = () => {
    const container = document.getElementById('pdv-items-list');
    if (!container) return;

    const itens = comanda.items || [];
    const totalComanda = itens.reduce((acc, it) => acc + (_productsMap[it.product] || 0), 0);

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
      const prod = todosProdutos.find(p => p.id === it.product);
      const isCuisine = prod?.cuisine || false;
      const tooltip = it.obs ? `title="${it.obs}"` : '';

      return `
                <tr data-item-id="${it.id}">
                  <td style="padding:10px 0;border-bottom:1px solid var(--border)" ${tooltip}>
                    ${it.product_name}
                  </td>
                  <td style="padding:10px 0;text-align:right;border-bottom:1px solid var(--border)">
                    R$ ${(_productsMap[it.product] || 0).toFixed(2)}
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
        ` : `<p style="padding:40px 0;text-align:center;color:var(--text-muted)">Nenhum item adicionado.</p>`}
      </div>
      <div style="padding-top:20px;margin-top:auto;border-top:2px solid var(--border)">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--text-secondary)">Total de Itens:</span>
          <strong>${itens.length}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <span style="color:var(--text-secondary);font-size:1.1rem">Total da Conta:</span>
          <strong style="color:var(--success);font-size:1.3rem">R$ ${totalComanda.toFixed(2)}</strong>
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
          const r = await window.electronAPI.delete(`/items-comanda/${itemId}/`);
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
        const itemId = parseInt(btn.dataset.id);
        const item = comanda.items.find(it => it.id === itemId);
        const prod = todosProdutos.find(p => p.id === item.product);

        if (item && prod) {
          window.abrirModalObsCozinhaGlobal(prod.name, item.obs, async (novaObs) => {
            if (novaObs === null) return;
            const r = await window.electronAPI.patch(`/items-comanda/${itemId}/`, { obs: novaObs });
            if (r.ok) {
              showToast('Observação atualizada!', 'success');
              item.obs = novaObs;
              renderLeft();
              loadComandas(_mesasRef);
            } else {
              showToast(r.error, 'error');
            }
          });
        }
      });
    });
  };

  const processarResultadoAdd = (r) => {
    if (r.ok) {
      if (!comanda.items) comanda.items = [];
      comanda.items.push(r.data);
      renderLeft();
      loadComandas(_mesasRef);
    } else {
      showToast(r.error, 'error');
    }
  };

  const bindProductClicks = (container, filtrados) => {
    container.querySelectorAll('.pdv-product-card').forEach(card => {
      card.addEventListener('click', async () => {
        if (!podeAdd) return showToast('Comanda em fechamento ou fechada.', 'warning');
        const pId = parseInt(card.dataset.id);
        const prod = todosProdutos.find(x => x.id === pId);

        card.style.transform = 'scale(0.95)';
        setTimeout(() => card.style.transform = '', 100);

        if (prod.cuisine) {
          window.abrirModalObsCozinhaGlobal(prod.name, '', async (obs) => {
            if (obs === null) return;
            const r = await window.electronAPI.post('/items-comanda/', {
              comanda: comanda.id,
              product: pId,
              obs: obs
            });
            processarResultadoAdd(r);
          });
        } else {
          const r = await window.electronAPI.post('/items-comanda/', { comanda: comanda.id, product: pId });
          processarResultadoAdd(r);
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


// ─── Modal Nova Comanda ───────────────────────────────────────────────────────
function abrirModalNovaComanda(mesas) {
  openModal({
    title: 'Nova Comanda',
    body: `
      <form id="form-nova-comanda" class="form-grid">
        <div class="form-group">
          <label>Nome do Cliente / Identificação</label>
          <input type="text" id="comanda-nome" class="form-control" placeholder="Ex: João, Mesa do fundo..." autofocus required />
        </div>
        <div class="form-group">
          <label>Mesa</label>
          <select id="comanda-mesa" class="form-control">
            ${mesas.map(m => `<option value="${m.id}">${m.nome || m.name || `Mesa ${m.numero || m.number || m.id}`}</option>`).join('')}
          </select>
        </div>
        <button type="submit" style="display:none"></button> <!-- Invisível para permitir Enter -->
      </form>`,
    footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary btn-md" id="btn-criar-comanda">Criar e Adicionar Itens</button>`,
  });

  // Foco manual caso autofocus falhe em algum navegador
  setTimeout(() => document.getElementById('comanda-nome')?.focus(), 100);

  const submeter = async (e) => {
    if (e) e.preventDefault();
    const mesaId = parseInt(document.getElementById('comanda-mesa').value);
    const nome = document.getElementById('comanda-nome').value.trim();

    if (!nome) return showToast('Informe o nome ou identificação.', 'error');

    const loggedUser = await window.electronAPI.getUser();
    const payload = {
      name: nome,
      mesa: mesaId,
      user: loggedUser?.id || 1,
      status: 'OPEN'
    };

    const btn = document.getElementById('btn-criar-comanda');
    btn.disabled = true;
    btn.textContent = 'Criando...';

    const r = await window.electronAPI.post('/comandas/', payload);
    if (r.ok) {
      showToast('Comanda criada!', 'success');
      closeModal();
      loadComandas(_mesasRef);
      // Abre direto a modal de itens da comanda recém criada
      setTimeout(() => abrirItensComanda(r.data), 300);
    } else {
      showToast(r.error, 'error');
      btn.disabled = false;
      btn.textContent = 'Criar e Adicionar Itens';
    }
  };

  document.getElementById('form-nova-comanda').onsubmit = submeter;
  document.getElementById('btn-criar-comanda').onclick = submeter;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return '–';
  return new Date(str).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
