let _productsMap = {};
let _productsNames = {};
let _paymentTypes = [];
let _clients = [];
let _mesas = [];
let _pdvComanda = null;
let _pdvItems = [];
let _loggedUser = null;

export async function renderPdv(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">🖨️ PDV - Impressão de Fichas</div>
        <div class="page-subtitle">Adicione itens para imprimir fichas na cozinha</div>
      </div>
    </div>
    <div class="pdv-container">
      <div class="pdv-left" id="pdv-ficha-items">
        <div class="loading-screen"><div class="spinner"></div></div>
      </div>
      <div class="pdv-right">
        <div class="pdv-header">
          <input type="text" class="search-input" id="pdv-search" placeholder="🔍 Buscar produto..." style="width:100%" />
        </div>
        <div class="pdv-products-grid" id="pdv-products-grid"></div>
      </div>
    </div>
    <div class="pdv-footer-bar">
      <div class="pdv-footer-info">
        <div style="display:flex;gap:20px">
          <div>
            <span style="color:var(--text-muted);font-size:0.8rem">Total:</span>
            <strong id="pdv-total-all" style="font-size:1.1rem;color:var(--success)">R$ 0,00</strong>
          </div>
          <div>
            <span style="color:var(--text-muted);font-size:0.8rem">Selecionado:</span>
            <strong id="pdv-total-selected" style="font-size:1.1rem;color:var(--warning)">R$ 0,00</strong>
          </div>
        </div>
      </div>
      <div class="pdv-footer-actions">
        <button class="btn btn-secondary btn-lg" id="btn-pdv-limpar">
          🗑️ Limpar Tudo
        </button>
        <button class="btn btn-warning btn-lg" id="btn-pdv-imprimir-fichas" disabled>
          🖨️ Imprimir Fichas
        </button>
        <button class="btn btn-success btn-lg" id="btn-pdv-pagamento">
          💰 Pagamento
        </button>
      </div>
    </div>`;

  _loggedUser = await window.electronAPI.getUser();
  await criarComandaPdv();
  await loadPdvData();

  setTimeout(() => {
    const btnLimpar = document.getElementById('btn-pdv-limpar');
    const btnImprimir = document.getElementById('btn-pdv-imprimir-fichas');
    const btnPagamento = document.getElementById('btn-pdv-pagamento');
    const searchInput = document.getElementById('pdv-search');

    if (btnLimpar) {
      btnLimpar.onclick = async () => {
        if (!_pdvItems.length) return;
        if (confirm('Deseja limpar todos os itens do PDV?')) {
          await limparPdv();
        }
      };
    }

    if (btnImprimir) {
      btnImprimir.onclick = () => {
        imprimirFichasSelecionadas();
      };
    }

    if (btnPagamento) {
      btnPagamento.onclick = () => {
        abrirModalPagamentoPdv();
      };
    }

    if (searchInput) {
      searchInput.oninput = async (e) => {
        const pRes = await window.electronAPI.get('/products');
        const todosProdutos = pRes.ok ? pRes.data.filter(p => p.active) : [];
        renderRight(todosProdutos, e.target.value);
      };
    }
  }, 150);
}

async function criarComandaPdv() {
  const mesasRes = await window.electronAPI.get('/mesas');
  if (mesasRes.ok) {
    _mesas = mesasRes.data;
  }

  const comandasRes = await window.electronAPI.get('/comandas');
  if (comandasRes.ok) {
    const existing = comandasRes.data.find(c => c.name === 'PDV-BALCAO' && c.status === 'OPEN');
    if (existing) {
      _pdvComanda = existing;
      console.log('[PDV] ComandaPDV encontrada:', _pdvComanda);
      await recarregarComanda();
      return;
    }
  }

  const now = new Date();
  const dataStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const horaStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '');
  const userId = _loggedUser?.id || 1;
  
  const nomeComanda = 'PDV-BALCAO';

  const mesaId = _mesas[0]?.id || 1;

  const r = await window.electronAPI.post('/comandas', {
    user: userId,
    mesa: mesaId,
    name: nomeComanda,
    status: 'OPEN'
  });

  if (r.ok) {
    _pdvComanda = r.data;
    console.log('[PDV] ComandaPDV criada:', _pdvComanda);
  } else {
    console.error('[PDV] Erro ao criar comanda:', r.error);
  }
}

async function loadPdvData() {
  const [pRes, ptRes, cRes] = await Promise.all([
    window.electronAPI.get('/products'),
    window.electronAPI.get('/payment-types'),
    window.electronAPI.get('/clients')
  ]);

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

  if (ptRes.ok) _paymentTypes = ptRes.data;
  if (cRes.ok) _clients = cRes.data;

  const todosProdutos = pRes.ok ? pRes.data.filter(p => p.active) : [];
  renderRight(todosProdutos);
  renderLeft();
}

function renderLeft() {
  const container = document.getElementById('pdv-ficha-items');
  if (!container) return;

  if (!_pdvComanda || !_pdvComanda.items || _pdvComanda.items.length === 0) {
    container.innerHTML = `
      <div style="padding:40px 20px;text-align:center;color:var(--text-muted)">
        <div style="font-size:3rem;margin-bottom:16px">📋</div>
        <div>Nenhum item adicionado</div>
        <div style="font-size:0.85rem;margin-top:8px">Clique nos produtos para adicionar</div>
      </div>`;
    updateFooterCounts();
    return;
  }

  _pdvItems = _pdvComanda.items || [];

  container.innerHTML = `
    <div style="flex:1;overflow-y:auto">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <input type="checkbox" id="check-all" checked style="width:20px;height:20px;cursor:pointer" />
        <label for="check-all" style="cursor:pointer;font-weight:500">Selecionar Todos</label>
      </div>
      <table style="width:100%;font-size:0.9rem">
        <thead>
          <tr style="color:var(--text-muted);border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:8px 4px;width:40px"></th>
            <th style="text-align:left;padding:8px">Produto</th>
            <th style="text-align:right;padding:8px">Preço</th>
            <th style="text-align:center;padding:8px;width:50px">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${_pdvItems.map((it, index) => {
    const price = _productsMap[String(it.product)] || 0;
    const name = _productsNames[String(it.product)] || it.product_name || `Produto #${it.product}`;
    return `
              <tr data-index="${index}">
                <td style="padding:10px 4px">
                  <input type="checkbox" class="item-checkbox" data-index="${index}" ${it.selected !== false ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer" />
                </td>
                <td style="padding:10px 0;border-bottom:1px solid var(--border)">
                  ${it.product_name || name}
                  ${it.obs ? `<br><small style="color:var(--text-muted);font-size:0.75rem">OBS: ${it.obs}</small>` : ''}
                </td>
                <td style="padding:10px 0;text-align:right;border-bottom:1px solid var(--border)">
                  R$ ${price.toFixed(2)}
                </td>
                <td style="padding:10px 0;text-align:center;border-bottom:1px solid var(--border)">
                  <button class="btn btn-ghost btn-sm btn-remove-item" data-id="${it.id}" title="Remover" style="color:var(--danger);font-size:0.9rem">
                    🗑️
                  </button>
                </td>
              </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>`;

  container.querySelectorAll('.item-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.index);
      if (!_pdvItems[idx]) return;
      _pdvItems[idx].selected = cb.checked;
      updateFooterCounts();
    });
  });

  container.querySelector('#check-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    _pdvItems.forEach(it => it.selected = checked);
    container.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = checked);
    updateFooterCounts();
  });

  container.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = btn.dataset.id;
      if (confirm('Deseja realmente excluir este item?')) {
        const r = await window.electronAPI.delete(`/items-comanda/${itemId}`);
        if (r.ok) {
          showToast('Item excluído!', 'success');
          await recarregarComanda();
        } else {
          showToast(r.error, 'error');
        }
      }
    });
  });

  updateFooterCounts();
}

async function recarregarComanda() {
  if (!_pdvComanda) return;
  const r = await window.electronAPI.get(`/comandas/${_pdvComanda.id}`);
  if (r.ok) {
    _pdvComanda = r.data;
    renderLeft();
  }
}

function updateFooterCounts() {
  const totalAll = (_pdvItems || []).reduce((acc, it) => acc + (_productsMap[String(it.product)] || 0), 0);
  const selected = (_pdvItems || []).filter(it => it.selected !== false);
  const totalSelected = selected.reduce((acc, it) => acc + (_productsMap[String(it.product)] || 0), 0);
  
  const totalAllEl = document.getElementById('pdv-total-all');
  const totalSelectedEl = document.getElementById('pdv-total-selected');
  const printBtn = document.getElementById('btn-pdv-imprimir-fichas');
  
  if (totalAllEl) totalAllEl.textContent = `R$ ${totalAll.toFixed(2)}`;
  if (totalSelectedEl) totalSelectedEl.textContent = `R$ ${totalSelected.toFixed(2)}`;
  if (printBtn) {
    printBtn.disabled = selected.length === 0;
    printBtn.innerHTML = selected.length > 0 
      ? `🖨️ Imprimir ${selected.length} Ficha${selected.length > 1 ? 's' : ''}` 
      : '🖨️ Imprimir Fichas';
  }
}

function renderRight(todosProdutos, filtro = '') {
  const container = document.getElementById('pdv-products-grid');
  if (!container) return;

  const filtrados = todosProdutos.filter(p => !filtro || p.name.toLowerCase().includes(filtro.toLowerCase())).slice(0, 20);

  container.innerHTML = filtrados.map(p => {
    const imgUrl = p.image 
      ? (p.image.startsWith('data:') || p.image.startsWith('http') 
        ? p.image 
        : `http://localhost:8080${p.image}`)
      : 'https://wallpapers.com/images/featured/fundo-abstrato-escuro-27kvn4ewpldsngbu.jpg';
    
    return `
      <div class="pdv-product-card" data-id="${p.id}" data-cuisine="${p.cuisine || false}">
        <div class="pdv-product-bg" style="background-image: url('${imgUrl}')"></div>
        <div class="pdv-product-info">
          <div class="pdv-product-name">${p.cuisine ? '🍳 ' : ''}${p.name}</div>
          <div class="pdv-product-price">R$ ${parseFloat(p.price || 0).toFixed(2)}</div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.pdv-product-card').forEach(card => {
    card.addEventListener('click', async () => {
      const pId = String(card.dataset.id);
      const prod = todosProdutos.find(x => String(x.id) === pId);
      
      card.style.transform = 'scale(0.95)';
      setTimeout(() => card.style.transform = '', 100);

      if (!prod) return showToast('Erro: Produto não encontrado.', 'error');
      if (!_pdvComanda) return showToast('Erro: Comanda PDV não criada.', 'error');

      if (prod.cuisine) {
        window.abrirModalObsCozinhaGlobal(prod.name, '', async (obs) => {
          if (obs === null) return;
          const loggedUser = await window.electronAPI.getUser();
          const r = await window.electronAPI.post('/items-comanda', {
            comanda: _pdvComanda.id,
            product: prod.id,
            obs: obs,
            applicant: loggedUser?.username || 'Sistema'
          });
          await processarResultadoAdd(r, prod, obs, loggedUser);
        });
      } else {
        const loggedUser = await window.electronAPI.getUser();
        const r = await window.electronAPI.post('/items-comanda', {
          comanda: _pdvComanda.id,
          product: prod.id,
          applicant: loggedUser?.username || 'Sistema'
        });
        await processarResultadoAdd(r, prod);
      }
    });
  });
}

async function processarResultadoAdd(r, prod, obs = '', loggedUser = null) {
  if (r.ok) {
    await recarregarComanda();

    if (prod && prod.cuisine) {
      const orderPayload = {
        productComanda: r.data.id,
        id_product: prod.id,
        id_comanda: _pdvComanda.id,
        obs: obs || r.data.obs || '',
        applicant: loggedUser?.username || 'Sistema'
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
}

async function imprimirFichasSelecionadas() {
  const selected = _pdvItems.filter(it => it.selected !== false);
  if (!selected.length) return showToast('Nenhum item selecionado para imprimir.', 'warning');

  const loggedUser = await window.electronAPI.getUser();

  for (const item of selected) {
    const prod = { name: _productsNames[String(item.product)] || item.product_name };
    const htmlTicket = gerarHtmlTicket(item, prod, loggedUser);
    
    window.electronAPI.printDirect(htmlTicket).then(r => {
      if (r.ok) {
        // OK
      } else if (r.error === 'NO_PRINTER') {
        showToast('Nenhuma impressora configurada. Abra as configuracoes para adicionar uma.', 'warning', 5000);
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
    
    await new Promise(r => setTimeout(r, 200));
  }

  showToast(`${selected.length} ficha${selected.length > 1 ? 's' : ''} enviada(s) para impressao!`, 'success');
}

function gerarHtmlTicket(item, product, loggedUser) {
  const dataAtual = new Date().toLocaleString('pt-BR');
  const nomeEstabelecimento = 'Raul Rock Bar & Café';
  const nomeProduto = product?.name || item.product_name || `Produto #${item.product}`;
  const observacao = item.obs || '';

  const htmlTicket = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ticket PDV - ${nomeProduto}</title>
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
        @media print {
          @page { size: 80mm auto; margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="header">
          <div class="title">${nomeEstabelecimento}</div>
        </div>
        
        <div class="info" style="text-align:center">
          <strong>${_pdvComanda?.name || 'PDV'}</strong>
        </div>
        <div class="info" style="display:flex;justify-content:space-between">
          <span>PDV</span>
          <span>${dataAtual}</span>
        </div>
        
        <div class="product">
          ${nomeProduto}
        </div>
        
        ${observacao ? `<div class="obs">OBS: ${observacao}</div>` : ''}
        
        <div class="footer">
          Válido somente por essa noite
        </div>
        <div class="header">
        </div>
      </div>
    </body>
    </html>
  `;

  return htmlTicket;
}

function calcularTotal() {
  return _pdvItems.reduce((acc, it) => {
    if (it.selected !== false) {
      return acc + (_productsMap[String(it.product)] || 0);
    }
    return acc;
  }, 0);
}

function abrirModalPagamentoPdv() {
  if (!_pdvComanda || !_pdvItems.length) return showToast('Adicione itens primeiro.', 'warning');

  const total = calcularTotal();
  const valorRestante = total;

  openModal({
    title: `💰 Pagamento - ${_pdvComanda.name}`,
    body: `
      <div class="form-grid">
        <div class="form-group">
          <label>Valor Total (R$)</label>
          <input type="number" id="pay-value" class="form-control" value="${valorRestante.toFixed(2)}" step="0.01" />
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
              <option value="${cl.id}">${cl.name}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column: span 2">
          <label>Descrição / Observações</label>
          <input type="text" id="pay-desc" class="form-control" placeholder="Ex: Pagamento PDV..." value="Pagamento PDV" />
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary btn-md" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-success btn-md" id="btn-confirmar-pagamento">Confirmar Recebimento</button>`
  });

  const btnConfirmar = document.getElementById('btn-confirmar-pagamento');

  btnConfirmar.addEventListener('click', async () => {
    const payTypeId = parseInt(document.getElementById('pay-type').value);
    const clientId = document.getElementById('pay-client').value || null;
    const valor = parseFloat(document.getElementById('pay-value').value);

    if (isNaN(valor) || valor <= 0) {
      return showToast('Informe um valor válido.', 'error');
    }

    try {
      btnConfirmar.disabled = true;
      btnConfirmar.textContent = 'Processando...';

      const rPay = await window.electronAPI.post(`/comandas/${_pdvComanda.id}/pagar`, {
        value: valor,
        type_pay: payTypeId,
        client: clientId ? parseInt(clientId) : null,
        description: document.getElementById('pay-desc').value || 'Pagamento PDV',
        status: 'CLOSED'
      });
      
      if (rPay.ok) {
        showToast('Pagamento realizado com sucesso!', 'success');
        closeModal();
        
        await window.electronAPI.patch(`/comandas/${_pdvComanda.id}`, {
          status: 'CLOSED'
        });
        
        _pdvItems = [];
        _pdvComanda = null;
        await criarComandaPdv();
        renderLeft();
        updateFooterCounts();
      } else {
        throw new Error(rPay.error || 'Erro ao registrar pagamento.');
      }
    } catch (err) {
      showToast(err.message, 'error');
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = 'Confirmar Recebimento';
    }
  });
}

async function excluirComandaPdv() {
  if (!_pdvComanda) return;
  
  const itensToDelete = _pdvComanda.items || [];
  for (const item of itensToDelete) {
    await window.electronAPI.delete(`/items-comanda/${item.id}`);
  }
  
  _pdvItems = [];
  await recarregarComanda();
  showToast('PDV limpo!', 'info');
}

async function limparPdv() {
  if (!_pdvComanda || !_pdvComanda.items?.length) {
    _pdvItems = [];
    renderLeft();
    return;
  }

  for (const item of _pdvComanda.items) {
    await window.electronAPI.delete(`/items-comanda/${item.id}`);
  }
  
  _pdvItems = [];
  await recarregarComanda();
  showToast('PDV limpo!', 'info');
}