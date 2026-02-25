export async function renderProdutos(container) {
  let categorias = [];
  const catRes = await window.electronAPI.get('/categories/');
  if (catRes.ok) categorias = catRes.data;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">🍔 Produtos</div>
        <div class="page-subtitle">Cardápio e categorias</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-md" id="btn-nova-cat">+ Categoria</button>
        <button class="btn btn-primary btn-md" id="btn-novo-prod">+ Produto</button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <input type="text" class="search-input" id="search-produto" placeholder="🔍 Buscar produto..." />
        <select id="filter-cat" class="form-control" style="width:180px">
          <option value="">Todas as categorias</option>
          ${categorias.map(c => `<option value="${c.id}">${c.nome || c.name}</option>`).join('')}
        </select>
        <select id="filter-ativo" class="form-control" style="width:140px">
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>
      <div id="produtos-table"></div>
    </div>`;

  await loadProdutos(categorias);

  document.getElementById('btn-novo-prod').addEventListener('click', () => abrirModalProduto(null, categorias));
  document.getElementById('btn-nova-cat').addEventListener('click', () => abrirModalCategoria());
  document.getElementById('search-produto').addEventListener('input', () => filtrarProdutos(categorias));
  document.getElementById('filter-cat').addEventListener('change', () => filtrarProdutos(categorias));
  document.getElementById('filter-ativo').addEventListener('change', () => filtrarProdutos(categorias));
}

let _produtosData = [];

async function loadProdutos(categorias) {
  const wrap = document.getElementById('produtos-table');
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  const res = await window.electronAPI.get('/products/');
  if (!res.ok) { wrap.innerHTML = `<div class="table-empty">Erro ao carregar produtos.</div>`; return; }
  _produtosData = res.data;
  renderProdutosTable(_produtosData, categorias);
}

function renderProdutosTable(data, categorias) {
  const wrap = document.getElementById('produtos-table');
  if (!wrap) return;
  if (!data.length) { wrap.innerHTML = `<div class="table-empty">Nenhum produto encontrado.</div>`; return; }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th>
        <th>Nome</th>
        <th>Categoria</th>
        <th>Preço</th>
        <th>Estoque</th>
        <th>Unid.</th>
        <th>Cozinha</th>
        <th>Ativo</th>
        <th>Ações</th>
      </tr></thead>
      <tbody>
        ${data.map(p => `<tr>
          <td style="color:var(--text-muted)">#${p.id}</td>
          <td><strong>${p.name}</strong></td>
          <td>${p.category_name || '–'}</td>
          <td>R$ ${parseFloat(p.price || 0).toFixed(2)}</td>
          <td>
            <span class="badge ${p.quantity > 0 ? 'badge-info' : 'badge-warning'}">
              ${p.quantity ?? '–'}
            </span>
          </td>
          <td style="font-size:0.8rem;color:var(--text-secondary)">${p.unit_of_measure_name || '–'}</td>
          <td>
            <span class="badge ${p.cuisine ? 'badge-warning' : 'badge-muted'}">
              ${p.cuisine ? 'Sim' : 'Não'}
            </span>
          </td>
          <td>
            <span class="badge ${p.active ? 'badge-success' : 'badge-danger'}">
              ${p.active ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm btn-edit-prod" data-id="${p.id}">Editar</button>
              <button class="btn btn-danger btn-sm btn-del-prod" data-id="${p.id}">Excluir</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = _produtosData.find(x => x.id === parseInt(btn.dataset.id));
      if (p) abrirModalProduto(p, categorias);
    });
  });

  wrap.querySelectorAll('.btn-del-prod').forEach(btn =>
    btn.addEventListener('click', async () => {
      const r = await window.electronAPI.delete(`/products/${btn.dataset.id}/`);
      if (r.ok) { showToast('Produto excluído!', 'success'); loadProdutos(categorias); }
      else showToast(r.error, 'error');
    })
  );
}

function filtrarProdutos(categorias) {
  const q = document.getElementById('search-produto')?.value.toLowerCase() || '';
  const catId = parseInt(document.getElementById('filter-cat')?.value) || null;
  const ativo = document.getElementById('filter-ativo')?.value;

  const filtered = _produtosData.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    const matchCat = !catId || p.category === catId;
    const matchAtiv = !ativo || String(p.active) === ativo;
    return matchQ && matchCat && matchAtiv;
  });
  renderProdutosTable(filtered, categorias);
}

function abrirModalProduto(produto, categorias) {
  const isEdit = !!produto;
  openModal({
    title: isEdit ? `Editar: ${produto.name}` : 'Novo Produto',
    body: `
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label>Nome</label>
          <input type="text" id="prod-nome" class="form-control" value="${produto?.name || ''}" placeholder="Nome do produto" />
        </div>
        <div class="form-group">
          <label>Preço (R$)</label>
          <input type="number" id="prod-preco" class="form-control" value="${produto?.price || ''}" step="0.01" min="0" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label>Estoque</label>
          <input type="number" id="prod-qty" class="form-control" value="${produto?.quantity ?? ''}" min="0" placeholder="0" />
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <select id="prod-cat" class="form-control">
            <option value="">– Sem categoria –</option>
            ${categorias.map(c => `<option value="${c.id}" ${produto?.category === c.id ? 'selected' : ''}>${c.nome || c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Ativo</label>
          <select id="prod-ativo" class="form-control">
            <option value="true"  ${produto?.active !== false ? 'selected' : ''}>Sim</option>
            <option value="false" ${produto?.active === false ? 'selected' : ''}>Não</option>
          </select>
        </div>
        <div class="form-group">
          <label>Cozinha (cuisine)</label>
          <select id="prod-cuisine" class="form-control">
            <option value="false" ${!produto?.cuisine ? 'selected' : ''}>Não</option>
            <option value="true"  ${produto?.cuisine ? 'selected' : ''}>Sim</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Descrição</label>
          <input type="text" id="prod-desc" class="form-control" value="${produto?.description || ''}" placeholder="Descrição opcional" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Imagem</label>
          <input type="file" id="prod-img" accept="image/*" class="form-control" />
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary btn-md" id="btn-salvar-prod">${isEdit ? 'Salvar' : 'Criar'}</button>`,
  });

  document.getElementById('btn-salvar-prod').addEventListener('click', async () => {
    const catVal = parseInt(document.getElementById('prod-cat').value) || null;
    const data = {
      name: document.getElementById('prod-nome').value,
      description: document.getElementById('prod-desc').value,
      //image: document.getElementById('prod-img').value,
      price: parseFloat(document.getElementById('prod-preco').value) || 0,
      quantity: parseInt(document.getElementById('prod-qty').value) || 0,
      category: catVal,
      active: document.getElementById('prod-ativo').value === 'true',
      cuisine: document.getElementById('prod-cuisine').value === 'true',
    };
    const r = isEdit
      ? await window.electronAPI.put(`/products/${produto.id}/`, data)
      : await window.electronAPI.post('/products/', data);
    if (r.ok) { showToast(isEdit ? 'Produto atualizado!' : 'Produto criado!', 'success'); closeModal(); loadProdutos(categorias); }
    else showToast(r.error, 'error');
  });
}

function abrirModalCategoria() {
  openModal({
    title: 'Nova Categoria',
    body: `
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="cat-nome" class="form-control" placeholder="Ex: Bebidas, Lanches..." />
      </div>`,
    footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary btn-md" id="btn-criar-cat">Criar</button>`,
  });
  document.getElementById('btn-criar-cat').addEventListener('click', async () => {
    const nome = document.getElementById('cat-nome').value.trim();
    if (!nome) return showToast('Informe um nome.', 'error');
    const r = await window.electronAPI.post('/categories/', { nome, name: nome });
    if (r.ok) { showToast('Categoria criada!', 'success'); closeModal(); }
    else showToast(r.error, 'error');
  });
}
