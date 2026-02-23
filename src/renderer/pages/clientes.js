export async function renderClientes(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">👥 Clientes</div>
        <div class="page-subtitle">Cadastro de clientes e controle de débitos</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-md" id="btn-refresh-clientes">↺ Atualizar</button>
        <button class="btn btn-primary btn-md" id="btn-novo-cliente">+ Novo Cliente</button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <input type="text" class="search-input" id="search-cliente" placeholder="🔍 Buscar por nome ou contato..." />
        <select id="filter-debt" class="form-control" style="width:160px">
          <option value="">Todos os clientes</option>
          <option value="has-debt">Com débito</option>
          <option value="no-debt">Sem débito</option>
        </select>
      </div>
      <div id="clientes-table"></div>
    </div>`;

  await loadClientes();

  document.getElementById('btn-novo-cliente').addEventListener('click', () => abrirModalCliente());
  document.getElementById('btn-refresh-clientes').addEventListener('click', loadClientes);
  document.getElementById('search-cliente').addEventListener('input', () => filtrarClientes());
  document.getElementById('filter-debt').addEventListener('change', () => filtrarClientes());
}

let _clientesData = [];
let _productsMap = {};

async function loadClientes() {
  const wrap = document.getElementById('clientes-table');
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;

  // Carrega clientes e produtos em paralelo para ter os preços
  const [res, pRes] = await Promise.all([
    window.electronAPI.get('/clients/'),
    window.electronAPI.get('/products/')
  ]);

  if (pRes.ok) {
    _productsMap = pRes.data.reduce((acc, p) => {
      acc[p.id] = parseFloat(p.price || 0);
      return acc;
    }, {});
  }

  if (!res.ok) { wrap.innerHTML = `<div class="table-empty">Erro ao carregar clientes.</div>`; return; }
  _clientesData = res.data;
  renderClientesTable(_clientesData);
}

function renderClientesTable(data) {
  const wrap = document.getElementById('clientes-table');
  if (!wrap) return;
  if (!data.length) { wrap.innerHTML = `<div class="table-empty">Nenhum cliente encontrado.</div>`; return; }

  // Ordena por maior débito por padrão
  const sorted = [...data].sort((a, b) => parseFloat(b.debt || 0) - parseFloat(a.debt || 0));

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th>
        <th>Nome</th>
        <th>Contato</th>
        <th>Débito</th>
        <th>Status</th>
        <th>Cadastrado em</th>
        <th>Ações</th>
      </tr></thead>
      <tbody>
        ${sorted.map(c => {
    const debt = parseFloat(c.debt || 0);
    return `<tr>
            <td style="color:var(--text-muted)">#${c.id}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.contact || '–'}</td>
            <td>
              <span style="font-weight:600; color: ${debt > 0 ? 'var(--danger)' : 'var(--text-secondary)'}">
                R$ ${debt.toFixed(2)}
              </span>
            </td>
            <td>
              <span class="badge ${c.active ? 'badge-success' : 'badge-muted'}">
                ${c.active ? 'Ativo' : 'Inativo'}
              </span>
            </td>
            <td style="font-size:0.82rem;color:var(--text-muted)">${formatDate(c.created_at)}</td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-info btn-sm btn-hist-cli" data-id="${c.id}" title="Ver Fiados">📜</button>
                <button class="btn btn-secondary btn-sm btn-edit-cli" data-id="${c.id}">Editar</button>
                <button class="btn btn-danger btn-sm btn-del-cli" data-id="${c.id}">Excluir</button>
              </div>
            </td>
          </tr>`;
  }).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('.btn-hist-cli').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = _clientesData.find(x => x.id === parseInt(btn.dataset.id));
      if (c) abrirHistoricoFiados(c);
    });
  });

  wrap.querySelectorAll('.btn-edit-cli').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = _clientesData.find(x => x.id === parseInt(btn.dataset.id));
      if (c) abrirModalCliente(c);
    });
  });

  wrap.querySelectorAll('.btn-del-cli').forEach(btn =>
    btn.addEventListener('click', async () => {
      const r = await window.electronAPI.delete(`/clients/${btn.dataset.id}/`);
      if (r.ok) { showToast('Cliente excluído!', 'success'); loadClientes(); }
      else showToast(r.error, 'error');
    })
  );
}

function filtrarClientes() {
  const q = document.getElementById('search-cliente')?.value.toLowerCase() || '';
  const debtFltr = document.getElementById('filter-debt')?.value || '';

  const filtered = _clientesData.filter(c => {
    const matchQ = !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.contact || '').toLowerCase().includes(q) ||
      String(c.id).includes(q);

    const debtValue = parseFloat(c.debt || 0);
    const matchDebt = !debtFltr ||
      (debtFltr === 'has-debt' ? debtValue > 0 : debtValue === 0);

    return matchQ && matchDebt;
  });
  renderClientesTable(filtered);
}

function abrirModalCliente(cliente = null) {
  const isEdit = !!cliente;
  openModal({
    title: isEdit ? `Editar: ${cliente.name}` : 'Novo Cliente',
    body: `
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label>Nome Completo</label>
          <input type="text" id="cli-nome" class="form-control" value="${cliente?.name || ''}" placeholder="Ex: Belchior de Oliveira" />
        </div>
        <div class="form-group">
          <label>Contato</label>
          <input type="text" id="cli-contact" class="form-control" value="${cliente?.contact || ''}" placeholder="(00) 0000-0000" />
        </div>
        <div class="form-group">
          <label>Débito Inicial (R$)</label>
          <input type="number" id="cli-debt" class="form-control" value="${cliente?.debt || '0.00'}" step="0.01" min="0" ${isEdit ? 'disabled' : ''} />
          ${isEdit ? '<small style="color:var(--text-muted)">Ajuste via pagamentos/comandas</small>' : ''}
        </div>
        <div class="form-group">
          <label>Ativo</label>
          <select id="cli-active" class="form-control">
            <option value="true"  ${cliente?.active !== false ? 'selected' : ''}>Sim</option>
            <option value="false" ${cliente?.active === false ? 'selected' : ''}>Não</option>
          </select>
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary btn-md" id="btn-salvar-cli">${isEdit ? 'Salvar' : 'Criar'}</button>`,
  });

  document.getElementById('btn-salvar-cli').addEventListener('click', async () => {
    const data = {
      name: document.getElementById('cli-nome').value.trim(),
      contact: document.getElementById('cli-contact').value.trim(),
      active: document.getElementById('cli-active').value === 'true',
    };

    // Só envia débito na criação se for o caso da API suportar
    if (!isEdit) {
      data.debt = parseFloat(document.getElementById('cli-debt').value || 0).toFixed(2);
    }

    if (!data.name) return showToast('Informe o nome do cliente.', 'error');

    const r = isEdit
      ? await window.electronAPI.put(`/clients/${cliente.id}/`, data)
      : await window.electronAPI.post('/clients/', data);

    if (r.ok) { showToast(isEdit ? 'Cliente atualizado!' : 'Cliente criado!', 'success'); closeModal(); loadClientes(); }
    else showToast(r.error, 'error');
  });
}

async function abrirHistoricoFiados(cliente) {
  openModal({
    title: `📜 Fiados: ${cliente.name}`,
    body: `
      <div id="fiados-modal-content">
        <div id="fiados-list" class="loading-screen"><div class="spinner"></div></div>
        
        <div id="fiados-summary" class="hidden" style="margin-top:20px; padding-top:15px; border-top:2px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:0.85rem; color:var(--text-secondary)">Selecionados: <span id="selected-count">0</span></div>
            <div style="font-size:1.2rem; font-weight:700; color:var(--success)">Total: R$ <span id="selected-total">0.00</span></div>
          </div>
          <button class="btn btn-primary btn-md" id="btn-pagar-selecionados" disabled>💳 Pagar Selecionados</button>
        </div>
      </div>`,
    footer: `<button class="btn btn-secondary btn-md" onclick="closeModal()">Sair</button>`
  });

  const res = await window.electronAPI.get(`/clients/${cliente.id}/fiados/`);
  const listContainer = document.getElementById('fiados-list');
  const summary = document.getElementById('fiados-summary');
  if (!listContainer) return;

  if (!res.ok) {
    listContainer.innerHTML = `<div class="table-empty">Erro ao carregar fiados: ${res.error}</div>`;
    return;
  }

  const fiados = res.data;
  if (!fiados.length) {
    listContainer.innerHTML = `<div class="table-empty">Nenhuma comanda pendente para este cliente.</div>`;
    return;
  }

  listContainer.classList.remove('loading-screen');
  listContainer.style.maxHeight = '400px';
  listContainer.style.overflowY = 'auto';
  summary.classList.remove('hidden');

  listContainer.innerHTML = fiados.map(f => {
    const totalComanda = (f.items || []).reduce((acc, it) => acc + (_productsMap[it.product] || 0), 0);

    return `
      <div class="card card-fiado" style="margin-bottom:15px; border-left: 4px solid var(--warning); position:relative; padding-left:50px">
        <div style="position:absolute; left:15px; top:50%; transform:translateY(-50%)">
          <input type="checkbox" class="fiado-check" data-id="${f.id}" data-total="${totalComanda}" style="width:20px; height:20px; cursor:pointer" />
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div>
            <div style="font-weight:600; font-size:1.1rem;">Comanda #${f.id} - ${f.name || 'Sem nome'}</div>
            <div style="font-size:0.8rem; color:var(--text-muted)">Abertura: ${formatDate(f.dt_open)}</div>
          </div>
          <div style="text-align:right">
            <div class="badge badge-warning" style="margin-bottom:5px">${f.status}</div>
            <div style="font-weight:700; color:var(--danger); font-size:1.1rem">R$ ${totalComanda.toFixed(2)}</div>
          </div>
        </div>
        
        <div style="font-size:0.85rem;">
          <div style="margin-bottom:5px; color:var(--text-secondary)">Mesa: ${f.mesa_name || '–'} | Lançado por: ${f.user_name || '–'}</div>
        </div>
        
        <div style="margin-top:10px; border-top:1px solid var(--border); padding-top:10px;">
          <details>
            <summary style="font-weight:600; font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); cursor:pointer; outline:none">
              Ver Itens (${(f.items || []).length})
            </summary>
            <ul style="list-style:none; padding:10px 0 0 0; margin:0; font-size:0.85rem;">
              ${(f.items || []).map(it => `
                <li style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed var(--border)">
                  <span>• ${it.product_name}</span>
                  <div style="text-align:right">
                    <span>R$ ${(_productsMap[it.product] || 0).toFixed(2)}</span>
                    <div style="font-size:0.7rem; color:var(--text-muted)">${formatDateShort(it.data_time)}</div>
                  </div>
                </li>
              `).join('')}
            </ul>
          </details>
        </div>
      </div>
    `;
  }).join('');

  // Lógica de Soma Dinâmica
  const updateSum = () => {
    const checks = listContainer.querySelectorAll('.fiado-check:checked');
    let sum = 0;
    checks.forEach(c => sum += parseFloat(c.dataset.total));

    document.getElementById('selected-count').textContent = checks.length;
    document.getElementById('selected-total').textContent = sum.toFixed(2);

    const btnPagar = document.getElementById('btn-pagar-selecionados');
    btnPagar.disabled = checks.length === 0;
  };

  listContainer.querySelectorAll('.fiado-check').forEach(chk => {
    chk.addEventListener('change', updateSum);
  });

  document.getElementById('btn-pagar-selecionados').addEventListener('click', async () => {
    const selecionados = Array.from(listContainer.querySelectorAll('.fiado-check:checked')).map(c => parseInt(c.dataset.id));
    const totalPrompt = document.getElementById('selected-total').textContent;

    if (confirm(`Deseja confirmar o pagamento de R$ ${totalPrompt} referente a ${selecionados.length} comanda(s)?`)) {
      const btn = document.getElementById('btn-pagar-selecionados');
      btn.disabled = true;
      btn.textContent = 'Processando...';

      const r = await window.electronAPI.post('/clients/pagar_fiados/', { ids: selecionados });

      if (r.ok) {
        showToast('Pagamento realizado com sucesso!', 'success');
        closeModal();
        loadClientes(); // Recarrega a lista para atualizar os débitos
      } else {
        showToast(r.error || 'Erro ao processar pagamento.', 'error');
        btn.disabled = false;
        btn.textContent = '💳 Pagar Selecionados';
      }
    }
  });

  updateSum();
}

function formatDateShort(str) {
  if (!str) return '–';
  const d = new Date(str);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(str) {
  if (!str) return '–';
  return new Date(str).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
