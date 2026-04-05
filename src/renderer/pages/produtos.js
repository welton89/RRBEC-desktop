export async function renderProdutos(container) {
  let categorias = [];
  let unidades = [];
  const [catRes, unRes] = await Promise.all([
    window.electronAPI.get('/categories'),
    window.electronAPI.get('/unit-of-measurements')
  ]);
  if (catRes.ok) categorias = catRes.data;
  if (unRes.ok) unidades = unRes.data;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">🍔 Produtos</div>
        <div class="page-subtitle">Cardápio e categorias</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-md" id="btn-gerenciar-cat">📁 Categorias</button>
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

  await loadProdutos(categorias, unidades);

  document.getElementById('btn-novo-prod').addEventListener('click', () => abrirModalProduto(null, categorias, unidades));
  document.getElementById('btn-gerenciar-cat').addEventListener('click', () => abrirModalGerenciarCategorias(categorias));
  document.getElementById('search-produto').addEventListener('input', () => filtrarProdutos(categorias, unidades));
  document.getElementById('filter-cat').addEventListener('change', () => filtrarProdutos(categorias, unidades));
  document.getElementById('filter-ativo').addEventListener('change', () => filtrarProdutos(categorias, unidades));
}

let _produtosData = [];

async function loadProdutos(categorias, unidades) {
  const wrap = document.getElementById('produtos-table');
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  const res = await window.electronAPI.get('/products');
  if (!res.ok) { wrap.innerHTML = `<div class="table-empty">Erro ao carregar produtos.</div>`; return; }
  _produtosData = res.data;
  renderProdutosTable(_produtosData, categorias, unidades);
}

function renderProdutosTable(data, categorias, unidades) {
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
            <button class="badge ${p.active ? 'badge-success' : 'badge-danger'} btn-status-prod" 
                    data-id="${p.id}" data-active="${p.active}" 
                    style="cursor:pointer; border:none; outline:none; transition: transform 0.1s active"
                    title="Clique para alterar status">
              ${p.active ? 'Ativo' : 'Inativo'}
            </button>
          </td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm btn-edit-prod" data-id="${p.id}">Editar</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = _produtosData.find(x => String(x.id) === String(btn.dataset.id));
      if (p) abrirModalProduto(p, categorias, unidades);
    });
  });

  wrap.querySelectorAll('.btn-status-prod').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const currentActive = btn.dataset.active === 'true';
      const r = await window.electronAPI.patch(`/products/${id}`, { active: !currentActive });
      if (r.ok) {
        showToast(`Produto ${!currentActive ? 'ativado' : 'inativado'}!`, 'success');
        loadProdutos(categorias, unidades);
      } else {
        showToast(r.error, 'error');
      }
    });
  });
}

function filtrarProdutos(categorias, unidades) {
  const q = document.getElementById('search-produto')?.value.toLowerCase() || '';
  const catId = parseInt(document.getElementById('filter-cat')?.value) || null;
  const ativo = document.getElementById('filter-ativo')?.value;

  const filtered = _produtosData.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    const matchCat = !catId || p.category === catId;
    const matchAtiv = !ativo || String(p.active) === ativo;
    return matchQ && matchCat && matchAtiv;
  });
  renderProdutosTable(filtered, categorias, unidades);
}

function abrirModalProduto(produto, categorias, unidades) {
  const isEdit = !!produto;
  const imagemAtual = produto?.image || '';

  openModal({
    title: isEdit ? `Editar: ${produto.name}` : 'Novo Produto',
    body: `
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1; text-align:center">
          <div id="prod-img-preview" style="width:120px;height:120px;border-radius:var(--radius-sm);border:2px dashed var(--border);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--bg-elevated);cursor:pointer">
            ${imagemAtual ? `<img src="${imagemAtual}" style="max-width:100%;max-height:100%;object-fit:cover" />` : '<span style="font-size:2rem;color:var(--text-muted)">📷</span>'}
          </div>
          <input type="file" id="prod-img-file" accept="image/*" style="display:none" />
          <button type="button" class="btn btn-secondary btn-sm" id="btn-select-img">Selecionar Imagem</button>
          ${imagemAtual ? '<button type="button" class="btn btn-ghost btn-sm" id="btn-remove-img" style="color:var(--danger)">Remover</button>' : ''}
          <input type="hidden" id="prod-img" value="${imagemAtual}" />
        </div>
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
          <label>Unidade de Medida</label>
          <select id="prod-unit" class="form-control">
            <option value="">– Selecione –</option>
            ${unidades.map(u => `<option value="${u.id}" ${produto?.unit_of_measure === u.id ? 'selected' : ''}>${u.acronym || u.name}</option>`).join('')}
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
      </div>`,
    footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary btn-md" id="btn-salvar-prod">${isEdit ? 'Salvar Alterações' : 'Criar Produto'}</button>`,
  });

  const previewEl = document.getElementById('prod-img-preview');
  const fileInput = document.getElementById('prod-img-file');
  const imgInput = document.getElementById('prod-img');

  previewEl.addEventListener('click', () => fileInput.click());
  document.getElementById('btn-select-img').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagem muito grande. Máximo 5MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      imgInput.value = base64;
      previewEl.innerHTML = `<img src="${base64}" style="max-width:100%;max-height:100%;object-fit:cover" />`;
    };
    reader.readAsDataURL(file);
  });

  const btnRemoveImg = document.getElementById('btn-remove-img');
  if (btnRemoveImg) {
    btnRemoveImg.addEventListener('click', () => {
      imgInput.value = '';
      previewEl.innerHTML = '<span style="font-size:2rem;color:var(--text-muted)">📷</span>';
    });
  }

  document.getElementById('btn-salvar-prod').addEventListener('click', async () => {
    const btn = document.getElementById('btn-salvar-prod');
    btn.disabled = true;
    btn.textContent = 'Processando...';

    const catVal = parseInt(document.getElementById('prod-cat').value);
    const unitVal = parseInt(document.getElementById('prod-unit').value);

    const data = {
      name: document.getElementById('prod-nome').value.trim(),
      description: document.getElementById('prod-desc').value.trim(),
      price: parseFloat(document.getElementById('prod-preco').value) || 0,
      quantity: parseInt(document.getElementById('prod-qty').value) || 0,
      active: document.getElementById('prod-ativo').value === 'true',
      cuisine: document.getElementById('prod-cuisine').value === 'true',
    };

    const imgValue = document.getElementById('prod-img').value.trim();
    if (imgValue) data.image = imgValue;

    if (catVal) data.category = catVal;
    if (unitVal) data.unit_of_measure = unitVal;

    if (!data.name) {
      btn.disabled = false;
      btn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Produto';
      return showToast('O nome do produto é obrigatório.', 'warning');
    }

    const r = isEdit
      ? await window.electronAPI.patch(`/products/${produto.id}`, data)
      : await window.electronAPI.post('/products', data);

    if (r.ok) {
      showToast(isEdit ? 'Produto atualizado!' : 'Produto criado!', 'success');
      closeModal();
      loadProdutos(categorias, unidades);
    } else {
      showToast(r.error, 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Produto';
    }
  });
}

// ─── Modal Gerenciar Categorias ──────────────────────────────────────────────
async function abrirModalGerenciarCategorias(categoriasArr) {
  let categorias = Array.isArray(categoriasArr) ? categoriasArr : [];

  const updateTable = () => {
    const listWrap = document.getElementById('cat-list-items');
    if (!listWrap) return;
    listWrap.innerHTML = categorias.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border)">
        <span style="${!c.active ? 'text-decoration:line-through; color:var(--text-muted)' : ''}">
          ${c.nome || c.name} ${!c.active ? '(Inativa)' : ''}
        </span>
        <button class="btn btn-ghost btn-sm btn-edit-cat" data-id="${c.id}" title="Editar Categoria">✏️</button>
      </div>`).join('');

    listWrap.querySelectorAll('.btn-edit-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = categorias.find(x => String(x.id) === String(btn.dataset.id));
        if (cat) abrirFormularioCategoria(cat, updateTable, async (novasCats) => {
          categorias = novasCats;
          updateTable();
        });
      });
    });
  };

  openModal({
    title: '📁 Gerenciar Categorias',
    body: `
      <div style="margin-bottom:20px">
        <button class="btn btn-primary btn-sm" id="btn-cat-add-new">+ Adicionar Nova</button>
      </div>
      <div id="cat-list-items" style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius-sm)">
        <div class="table-empty">Limpando...</div>
      </div>`,
    footer: `<button class="btn btn-secondary btn-md" onclick="closeModal()">Fechar</button>`,
  });

  updateTable();

  document.getElementById('btn-cat-add-new').addEventListener('click', () => {
    abrirFormularioCategoria(null, updateTable, async (novasCats) => {
      categorias = novasCats;
      updateTable();
    });
  });
}

// Abre formulário pequeno para criar ou editar uma única categoria
function abrirFormularioCategoria(cat, onSuccess, onListUpdate) {
  const isEdit = !!cat;

  // Criamos uma mini modal ou sobrepomos a atual com uma de confirmação simples de formulário
  // Para simplicidade, vamos usar o openModal mesmo (ele sobrepõe)
  openModal({
    title: isEdit ? `Editar Categoria: ${cat.nome || cat.name}` : 'Nova Categoria',
    body: `
      <div class="form-grid">
        <div class="form-group">
          <label>Nome da Categoria</label>
          <input type="text" id="cat-field-name" class="form-control" value="${isEdit ? (cat.nome || cat.name) : ''}" placeholder="Ex: Bebidas, Sobremesas..." />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="cat-field-active" class="form-control">
            <option value="true" ${cat?.active !== false ? 'selected' : ''}>Ativa</option>
            <option value="false" ${cat?.active === false ? 'selected' : ''}>Inativa</option>
          </select>
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary btn-md" id="btn-cat-form-cancel">Voltar</button>
      <button class="btn btn-primary btn-md" id="btn-cat-form-save">${isEdit ? 'Salvar Alterações' : 'Criar Categoria'}</button>`,
  });

  document.getElementById('btn-cat-form-cancel').onclick = () => {
    closeModal();
    // Reabre o gerenciador
    setTimeout(() => {
      // Recarregar categorias para garantir sync
      window.electronAPI.get('/categories').then(res => {
        if (res.ok) onListUpdate(res.data);
      });
    }, 300);
  };

  document.getElementById('btn-cat-form-save').addEventListener('click', async () => {
    const nome = document.getElementById('cat-field-name').value.trim();
    const active = document.getElementById('cat-field-active').value === 'true';

    if (!nome) return showToast('O nome é obrigatório.', 'warning');

    const data = { name: nome, active: active };
    const r = isEdit
      ? await window.electronAPI.patch(`/categories/${cat.id}`, { name: nome }) // Use PATCH as requested
      : await window.electronAPI.post('/categories', data);

    if (r.ok) {
      showToast(isEdit ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
      const res = await window.electronAPI.get('/categories');
      if (res.ok) {
        onListUpdate(res.data);
        closeModal();
        // Não reabre o gerenciador imediatamente para dar tempo do toast sumir, 
        // mas aqui vamos reabrir para manter o fluxo
        setTimeout(() => abrirModalGerenciarCategorias(res.data), 300);
      }
    } else {
      showToast(r.error, 'error');
    }
  });
}
