import { CATEGORIES, VIEW_META } from '../core/config.js';
import { money, dateTime, dateOnly, escapeHtml, categoryOf, sum, localDateKey, monthLabel } from '../core/utils.js';

const categoryOptions = selected => CATEGORIES.map(item => `<option value="${item.id}" ${selected === item.id ? 'selected' : ''}>${item.icon} ${item.name}</option>`).join('');
const transactionTypeLabel = type => type === 'income' ? 'Entrada' : 'Saída';

function statCard(label, value, hint, icon, tone = '') {
  return `<article class="stat-card ${tone}"><div class="stat-head"><span>${label}</span><span class="stat-icon">${icon}</span></div><strong>${value}</strong><small>${hint}</small></article>`;
}

function emptyState(title, description, action = '') {
  return `<div class="empty-state"><div class="empty-icon">⌁</div><strong>${title}</strong><p>${description}</p>${action}</div>`;
}

function transactionRows(transactions, allowEdit = true) {
  if (!transactions.length) return `<tr><td colspan="5" class="table-empty">Nenhuma movimentação registrada.</td></tr>`;
  return transactions.map(item => {
    const category = categoryOf(item.category);
    const sign = item.type === 'income' ? '+' : '−';
    return `<tr>
      <td><div class="table-primary">${escapeHtml(item.description)}</div><small class="table-sub">${category.icon} ${category.name}${item.source === 'purchase' ? ' · Compra' : ''}</small></td>
      <td>${dateTime(item.date)}</td>
      <td><span class="type-pill ${item.type}">${transactionTypeLabel(item.type)}</span></td>
      <td class="amount-cell ${item.type}">${sign} ${money(item.amount)}</td>
      <td>${allowEdit && item.source !== 'purchase' ? `<div class="table-actions"><button class="mini-action" data-action="edit-transaction" data-id="${item.id}" title="Editar">✎</button><button class="mini-action danger" data-action="delete-transaction" data-id="${item.id}" title="Excluir">×</button></div>` : '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join('');
}

export function renderDashboard(data, finance) {
  const today = finance.getTodayTotals();
  const month = finance.getMonthTotals();
  const week = finance.getWeekTotals();
  const balance = finance.getBalance();
  const daily = finance.getDailyExpenses(7);
  const maxDaily = Math.max(1, ...daily.map(item => item.amount));
  const categories = finance.getCategoryExpenses(month.transactions).slice(0, 5);
  const maxCategory = Math.max(1, ...categories.map(item => item.amount));
  const recent = data.transactions.slice(0, 5);
  const todayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return `
    <div class="welcome-row"><div><span class="eyebrow">${todayLabel.toUpperCase()}</span><h2>Seu dinheiro, em perspectiva.</h2><p class="muted">Acompanhe suas compras e movimentações em um só lugar.</p></div><button class="button primary" data-action="go-shopping">＋ Nova compra</button></div>
    <div class="stats-grid">
      ${statCard('Saldo disponível', money(balance), 'Entradas menos saídas registradas', '◉', 'stat-highlight')}
      ${statCard('Gastos do mês', money(month.expenses), 'Despesas financeiras neste mês', '↘')}
      ${statCard('Gastos da semana', money(week.expenses), 'De segunda-feira até hoje', '▦')}
      ${statCard('Gastos de hoje', money(today.expenses), 'Saídas registradas hoje', '⌁')}
    </div>
    <div class="dashboard-grid">
      <section class="panel chart-panel"><div class="panel-heading"><div><h3>Despesas dos últimos 7 dias</h3><p>Valores lançados no controle financeiro</p></div><span class="panel-icon">▥</span></div>
        <div class="bar-chart">${daily.map(item => `<div class="bar-column"><div class="bar-value">${item.amount ? money(item.amount) : '—'}</div><div class="bar-track"><div class="bar-fill" style="height:${Math.max(item.amount ? 5 : 0, (item.amount / maxDaily) * 100)}%"></div></div><small>${escapeHtml(item.label)}</small></div>`).join('')}</div>
      </section>
      <section class="panel"><div class="panel-heading"><div><h3>Gastos por categoria</h3><p>Distribuição do mês atual</p></div><span class="panel-icon">◌</span></div>
        ${categories.length ? `<div class="category-breakdown">${categories.map(item => { const cat = categoryOf(item.category); return `<div class="category-line"><div class="category-line-label"><span>${cat.icon} ${cat.name}</span><b>${money(item.amount)}</b></div><div class="progress-track"><i style="width:${(item.amount / maxCategory) * 100}%"></i></div></div>`; }).join('')}</div>` : emptyState('Sem despesas neste mês','As categorias aparecerão aqui quando você registrar saídas.')}
      </section>
    </div>
    <section class="panel table-panel"><div class="panel-heading"><div><h3>Movimentações recentes</h3><p>Últimos lançamentos financeiros</p></div><button class="button subtle small" data-view="finance">Ver tudo <span>→</span></button></div>
      <div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Data</th><th>Tipo</th><th>Valor</th><th></th></tr></thead><tbody>${transactionRows(recent, false)}</tbody></table></div>
    </section>
    <div class="notice-line"><span>ⓘ</span> Listas salvas no supermercado não alteram o saldo. Uma compra só entra no financeiro quando você finaliza e ativa essa opção.</div>
  `;
}

export function renderShopping(data) {
  const cart = data.activeCart;
  const cartTotal = sum(cart, item => item.unitPrice * item.quantity);
  const products = data.products;
  const saved = data.purchases.filter(item => item.status === 'saved').slice(0, 4);
  const completed = data.purchases.filter(item => item.status === 'completed').slice(0, 5);
  return `
    <div class="page-intro"><div><h2>Frente de caixa</h2><p>Selecione produtos, ajuste quantidades e finalize ou salve sua lista.</p></div><button class="button primary" data-action="add-product">＋ Cadastrar produto</button></div>
    <div class="shopping-layout">
      <section class="catalog-area">
        <div class="catalog-toolbar"><label class="search-field"><span>⌕</span><input id="shoppingSearch" type="search" placeholder="Buscar produto no catálogo..."></label><select id="shoppingCategory" class="select-control"><option value="all">Todas as categorias</option>${categoryOptions('')}</select></div>
        <div class="product-grid" id="shoppingProducts">${products.length ? products.map(product => renderProductTile(product)).join('') : emptyState('Seu catálogo está vazio','Cadastre produtos para montar o carrinho.','<button class="button primary" data-action="add-product">Cadastrar primeiro produto</button>')}</div>
      </section>
      <aside class="cart-panel panel">
        <div class="cart-title"><div><h3>🛒 Carrinho atual</h3><p>${cart.length} produto(s) diferente(s)</p></div><span class="cart-count">${cart.reduce((n, item) => n + Number(item.quantity), 0)}</span></div>
        <div class="cart-items">${cart.length ? cart.map(item => `<div class="cart-item"><div class="cart-item-main"><div><strong>${escapeHtml(item.name)}</strong><small>${money(item.unitPrice)} / ${escapeHtml(item.unit || 'un')}</small></div><button class="mini-action danger" data-action="remove-cart-item" data-id="${item.id}" title="Remover">×</button></div><div class="cart-item-bottom"><label class="quantity-control"><span>Qtd.</span><input type="number" min="0.001" step="0.001" value="${item.quantity}" data-cart-quantity="${item.id}"></label><b>${money(item.unitPrice * item.quantity)}</b></div></div>`).join('') : `<div class="cart-empty"><span>🛍️</span><b>Nenhum produto adicionado</b><small>Escolha um produto no catálogo ao lado.</small></div>`}</div>
        <div class="cart-summary"><div><span>Subtotal</span><b>${money(cartTotal)}</b></div><div><span>Descontos</span><b>—</b></div><div class="cart-total"><span>Total</span><strong>${money(cartTotal)}</strong></div>
          <button class="button primary full" data-action="finalize-purchase" ${cart.length ? '' : 'disabled'}>Finalizar compra</button>
          <button class="button outline full" data-action="save-list" ${cart.length ? '' : 'disabled'}>Salvar lista sem lançar gasto</button>
          ${cart.length ? '<button class="text-button danger-text" data-action="clear-cart">Limpar carrinho</button>' : ''}
        </div>
      </aside>
    </div>
    <div class="two-column-panels">
      <section class="panel"><div class="panel-heading"><div><h3>Listas salvas</h3><p>Planejamento, sem débito financeiro</p></div><span class="panel-icon">▤</span></div>${saved.length ? saved.map(item => `<div class="saved-row"><div><b>${escapeHtml(item.name)}</b><small>${dateTime(item.createdAt)} · ${item.items.length} itens · ${money(item.total)}</small></div><div class="row-actions"><button class="button subtle small" data-action="load-list" data-id="${item.id}">Abrir</button><button class="mini-action danger" data-action="delete-purchase" data-id="${item.id}">×</button></div></div>`).join('') : `<p class="muted small-copy">Nenhuma lista salva no momento.</p>`}</section>
      <section class="panel"><div class="panel-heading"><div><h3>Compras finalizadas</h3><p>Histórico do supermercado</p></div><span class="panel-icon">✓</span></div>${completed.length ? completed.map(item => `<div class="saved-row"><div><b>${escapeHtml(item.name)}</b><small>${dateTime(item.finalizedAt)} · ${item.items.length} itens</small></div><div class="saved-total"><b>${money(item.total)}</b><button class="mini-action" data-action="purchase-report" data-id="${item.id}" title="Ver relatório">▤</button><button class="mini-action danger" data-action="delete-purchase" data-id="${item.id}" title="Excluir">×</button></div></div>`).join('') : `<p class="muted small-copy">As compras finalizadas aparecerão aqui.</p>`}</section>
    </div>
  `;
}

function renderProductTile(product) {
  const category = categoryOf(product.category);
  return `<article class="product-tile"><div class="product-tile-top"><span class="category-bubble" style="--bubble:${category.color}">${category.icon}</span><span class="product-category">${category.name}</span></div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.unit || 'un')}</small><div class="product-tile-bottom"><b>${money(product.price)}</b><button class="add-to-cart" data-action="add-to-cart" data-id="${product.id}" title="Adicionar ao carrinho">＋</button></div></article>`;
}

export function renderProducts(data) {
  return `<div class="page-intro"><div><h2>Catálogo de produtos</h2><p>Cadastre e atualize nome, categoria, unidade e preço de referência.</p></div><button class="button primary" data-action="add-product">＋ Novo produto</button></div>
    <div class="panel"><div class="catalog-toolbar"><label class="search-field"><span>⌕</span><input id="productSearch" type="search" placeholder="Buscar no catálogo..."></label><select class="select-control" id="productCategory"><option value="all">Todas as categorias</option>${categoryOptions('')}</select></div>
      <div class="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Unidade</th><th>Atualizado em</th><th>Ações</th></tr></thead><tbody id="productTableBody">${data.products.length ? data.products.map(product => { const cat = categoryOf(product.category); return `<tr><td><div class="table-primary">${escapeHtml(product.name)}</div></td><td>${cat.icon} ${cat.name}</td><td><b>${money(product.price)}</b></td><td>${escapeHtml(product.unit || 'un')}</td><td>${dateOnly(product.updatedAt)}</td><td><div class="table-actions"><button class="mini-action" data-action="edit-product" data-id="${product.id}">✎</button><button class="mini-action danger" data-action="delete-product" data-id="${product.id}">×</button></div></td></tr>`; }).join('') : '<tr><td colspan="6" class="table-empty">Nenhum produto cadastrado.</td></tr>'}</tbody></table></div>
    </div>`;
}

export function renderFinance(data, finance) {
  const month = finance.getMonthTotals();
  const balance = finance.getBalance();
  return `<div class="page-intro"><div><h2>Entradas e saídas</h2><p>Registre receitas e despesas manuais. Compras do supermercado aparecem aqui somente quando lançadas no financeiro.</p></div></div>
    <div class="stats-grid three-stats">${statCard('Saldo atual', money(balance), 'Resultado acumulado', '◉', 'stat-highlight')}${statCard('Entradas do mês', money(month.income), 'Receitas registradas', '↗', 'stat-positive')}${statCard('Saídas do mês', money(month.expenses), 'Despesas registradas', '↘', 'stat-negative')}</div>
    <div class="finance-grid"><section class="panel"><div class="panel-heading"><div><h3>Nova movimentação</h3><p>Adicione uma entrada ou uma despesa</p></div><span class="panel-icon">＋</span></div>
      <form class="form-grid" data-form="transaction"><label class="field full-field">Tipo<select name="type" required><option value="expense">Saída / despesa</option><option value="income">Entrada / receita</option></select></label><label class="field full-field">Descrição<input name="description" required maxlength="90" placeholder="Ex.: Conta de energia"></label><label class="field">Valor (R$)<input name="amount" required type="number" min="0.01" step="0.01" placeholder="0,00"></label><label class="field">Categoria<select name="category">${categoryOptions('outros')}</select></label><label class="field full-field">Data e horário<input name="date" type="datetime-local" value="${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}" required></label><label class="field full-field">Observações<textarea name="notes" rows="2" maxlength="300" placeholder="Opcional"></textarea></label><button class="button primary full-field" type="submit">Salvar movimentação</button></form>
    </section><section class="panel"><div class="panel-heading"><div><h3>Resumo do mês</h3><p>${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())}</p></div><span class="panel-icon">▥</span></div><div class="month-summary"><div><span>Entradas</span><b class="income-text">${money(month.income)}</b></div><div><span>Despesas</span><b class="expense-text">${money(month.expenses)}</b></div><div><span>Resultado</span><b>${money(month.income - month.expenses)}</b></div></div><div class="notice-line compact"><span>ⓘ</span> O saldo é calculado pelas movimentações registradas. Listas salvas não entram nesta conta.</div></section></div>
    <section class="panel table-panel"><div class="panel-heading"><div><h3>Histórico financeiro</h3><p>Movimentações mais recentes</p></div><span class="muted small-copy">${data.transactions.length} registro(s)</span></div><div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Data</th><th>Tipo</th><th>Valor</th><th>Ações</th></tr></thead><tbody>${transactionRows(data.transactions, true)}</tbody></table></div></section>`;
}

export function renderCalendar(data, monthCursor) {
  const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - ((firstDay.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const totalsByDate = new Map();
  for (const transaction of data.transactions.filter(item => item.type === 'expense')) {
    const key = localDateKey(new Date(transaction.date));
    totalsByDate.set(key, (totalsByDate.get(key) || 0) + transaction.amount);
  }
  const monthExpenses = data.transactions.filter(item => item.type === 'expense' && new Date(item.date).getMonth() === monthCursor.getMonth() && new Date(item.date).getFullYear() === monthCursor.getFullYear());
  return `<div class="page-intro"><div><h2>Calendário financeiro</h2><p>Visualize em quais dias as despesas foram registradas.</p></div></div>
    <section class="panel calendar-panel"><div class="calendar-toolbar"><button class="icon-button" data-action="calendar-prev" aria-label="Mês anterior">‹</button><h3>${monthLabel(monthCursor)}</h3><button class="icon-button" data-action="calendar-next" aria-label="Próximo mês">›</button><button class="button subtle small" data-action="calendar-today">Hoje</button></div>
      <div class="calendar-grid calendar-weekdays">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => `<div>${day}</div>`).join('')}</div>
      <div class="calendar-grid">${days.map(date => { const key = localDateKey(date); const total = totalsByDate.get(key) || 0; return `<button class="calendar-day ${date.getMonth() !== monthCursor.getMonth() ? 'out-month' : ''} ${key === localDateKey() ? 'is-today' : ''}" data-action="calendar-day" data-date="${key}"><span>${date.getDate()}</span>${total ? `<small>${money(total)}</small><i></i>` : ''}</button>`; }).join('')}</div>
      <div class="calendar-legend"><span><i></i> Dia com despesa registrada</span><span>Selecione um dia para ver os detalhes.</span></div>
    </section>
    <section class="panel table-panel"><div class="panel-heading"><div><h3>Despesas do mês</h3><p>${monthExpenses.length} lançamento(s)</p></div><b>${money(sum(monthExpenses))}</b></div><div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Data</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${monthExpenses.length ? monthExpenses.map(item => `<tr><td>${escapeHtml(item.description)}</td><td>${dateTime(item.date)}</td><td>${categoryOf(item.category).icon} ${categoryOf(item.category).name}</td><td class="amount-cell expense">− ${money(item.amount)}</td></tr>`).join('') : '<tr><td colspan="4" class="table-empty">Nenhuma despesa neste mês.</td></tr>'}</tbody></table></div></section>`;
}

export function renderReports(data, finance, period = 'month') {
  const now = new Date();
  let start; let label;
  if (period === 'today') { start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); label = 'Hoje'; }
  else if (period === 'week') { start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0); label = 'Esta semana'; }
  else if (period === 'year') { start = new Date(now.getFullYear(), 0, 1); label = 'Este ano'; }
  else { start = new Date(now.getFullYear(), now.getMonth(), 1); label = 'Este mês'; }
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const totals = finance.getTotals(start, end);
  const categories = finance.getCategoryExpenses(totals.transactions);
  const max = Math.max(1, ...categories.map(item => item.amount));
  const purchases = data.purchases.filter(item => item.status === 'completed' && new Date(item.finalizedAt) >= start && new Date(item.finalizedAt) <= end);
  return `<div class="page-intro"><div><h2>Relatórios financeiros</h2><p>Consulte gastos por período e acompanhe as categorias com maior participação.</p></div><button class="button outline" data-action="export-finance-csv">⇩ Exportar CSV</button></div>
    <div class="period-tabs">${[['today','Dia'],['week','Semana'],['month','Mês'],['year','Ano']].map(([id, title]) => `<button class="period-tab ${period === id ? 'active' : ''}" data-action="report-period" data-period="${id}">${title}</button>`).join('')}</div>
    <div class="report-period-label">${label} <span>· ${dateOnly(start)} até ${dateOnly(end)}</span></div>
    <div class="stats-grid three-stats">${statCard('Entradas', money(totals.income), 'No período selecionado', '↗', 'stat-positive')}${statCard('Despesas', money(totals.expenses), 'No período selecionado', '↘', 'stat-negative')}${statCard('Resultado', money(totals.balance), 'Entradas menos despesas', '◉', 'stat-highlight')}</div>
    <div class="reports-grid"><section class="panel"><div class="panel-heading"><div><h3>Despesas por categoria</h3><p>Somente saídas financeiras</p></div></div>${categories.length ? `<div class="category-breakdown">${categories.map(item => { const cat = categoryOf(item.category); return `<div class="category-line"><div class="category-line-label"><span>${cat.icon} ${cat.name}</span><b>${money(item.amount)}</b></div><div class="progress-track"><i style="width:${item.amount / max * 100}%"></i></div></div>`; }).join('')}</div>` : emptyState('Sem despesas no período','Quando houver movimentações, o detalhamento será exibido aqui.')}</section>
      <section class="panel"><div class="panel-heading"><div><h3>Compras de supermercado</h3><p>Compras finalizadas, com ou sem vínculo financeiro</p></div></div><div class="purchase-summary"><strong>${purchases.length}</strong><span>compra(s) finalizada(s)</span><b>${money(sum(purchases))}</b><small>Valor total no módulo de supermercado</small></div><div class="notice-line compact">Compras não lançadas no financeiro aparecem neste relatório de supermercado, mas não compõem as despesas bancárias.</div></section></div>
    <section class="panel table-panel"><div class="panel-heading"><div><h3>Movimentações do período</h3><p>${totals.transactions.length} registro(s)</p></div><strong>${money(totals.expenses)} em saídas</strong></div><div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Data</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>${transactionRows(totals.transactions, false)}</tbody></table></div></section>`;
}

export function renderCredentials(credentials) {
  const entries = credentials.entries;
  return `<div class="page-intro"><div><h2>Cofre de credenciais</h2><p>Guarde dados de acesso e códigos de recuperação em um cofre separado e criptografado.</p></div><button class="button primary" data-action="add-credential">＋ Nova credencial</button></div>
    <div class="security-banner"><span class="security-banner-icon">▣</span><div><b>Conteúdo protegido por criptografia</b><p>As credenciais são criptografadas separadamente dos dados financeiros. A exclusão de uma credencial exige o código mestre.</p></div></div>
    <div class="credential-grid">${entries.length ? entries.map(item => `<article class="credential-card"><div class="credential-card-head"><div class="credential-logo">${escapeHtml((item.service || 'C').slice(0,1).toUpperCase())}</div><div><b>${escapeHtml(item.service)}</b><small>${escapeHtml(item.email || item.username || 'Sem usuário informado')}</small></div><span class="credential-lock">▣</span></div><div class="credential-meta"><span>Senha</span><b>••••••••••••</b></div><div class="credential-meta"><span>Código de recuperação</span><b>${item.recoveryCode ? '••••••••' : 'Não cadastrado'}</b></div><div class="credential-meta"><span>Chave 2FA</span><b>${item.totpSecret ? '••••••••' : 'Não cadastrada'}</b></div><div class="credential-actions"><button class="button subtle small" data-action="edit-credential" data-id="${item.id}">Abrir / editar</button><button class="mini-action danger" data-action="delete-credential" data-id="${item.id}" title="Excluir com código mestre">×</button></div></article>`).join('') : emptyState('Cofre vazio','Adicione contas, e-mails, códigos de recuperação e chaves de autenticação.')}</div>`;
}

export function renderSettings(data) {
  return `<div class="page-intro"><div><h2>Preferências e segurança</h2><p>Gerencie seus dados locais, bloqueio automático e cópias de segurança.</p></div></div>
    <div class="settings-grid"><section class="panel"><div class="panel-heading"><div><h3>Perfil local</h3><p>Informações exibidas somente neste dispositivo</p></div></div><form class="form-grid" data-form="profile"><label class="field full-field">E-mail de referência<input name="email" type="email" maxlength="150" value="${escapeHtml(data.settings.email || '')}" placeholder="seuemail@exemplo.com"></label><label class="field full-field">Bloqueio automático<select name="autoLockMinutes"><option value="5" ${data.settings.autoLockMinutes === 5 ? 'selected' : ''}>5 minutos</option><option value="10" ${data.settings.autoLockMinutes === 10 ? 'selected' : ''}>10 minutos</option><option value="15" ${data.settings.autoLockMinutes === 15 ? 'selected' : ''}>15 minutos</option><option value="30" ${data.settings.autoLockMinutes === 30 ? 'selected' : ''}>30 minutos</option></select></label><button class="button primary full-field" type="submit">Salvar preferências</button></form></section>
    <section class="panel"><div class="panel-heading"><div><h3>Alterar senha-mestra</h3><p>Os dados serão recriptografados com a nova senha.</p></div><span class="panel-icon">⌑</span></div><form class="form-grid" data-form="change-password"><label class="field full-field">Nova senha-mestra<input name="newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required placeholder="Mínimo de 12 caracteres"></label><label class="field full-field">Confirmar nova senha<input name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label class="field full-field">Código mestre atual<input name="masterCode" type="password" required autocomplete="off"></label><button class="button outline full-field" type="submit">Atualizar senha e recriptografar</button></form></section>
    <section class="panel"><div class="panel-heading"><div><h3>Alterar código mestre</h3><p>Usado para autorizar exclusões sensíveis.</p></div><span class="panel-icon">⌘</span></div><form class="form-grid" data-form="change-master-code"><label class="field full-field">Novo código mestre<input name="newCode" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><label class="field full-field">Confirmar novo código<input name="confirmCode" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><label class="field full-field">Código mestre atual<input name="currentCode" type="password" required autocomplete="off"></label><button class="button outline full-field" type="submit">Atualizar código mestre</button></form></section>
    <section class="panel"><div class="panel-heading"><div><h3>Backup criptografado</h3><p>O arquivo exportado contém dados cifrados, não texto legível.</p></div><span class="panel-icon">⇩</span></div><div class="backup-actions"><button class="button outline full" data-action="export-backup">⇩ Exportar backup</button><label class="button subtle full file-button">⇧ Importar backup<input id="backupFile" type="file" accept="application/json,.json" hidden></label></div><p class="muted small-copy">Guarde o arquivo em local seguro. Para restaurar, importe o backup e entre com a senha-mestra usada quando ele foi criado.</p></section>
    <section class="panel danger-panel"><div class="panel-heading"><div><h3>Limpar dados operacionais</h3><p>Remove produtos, listas, compras, movimentações e preferências locais.</p></div><span class="panel-icon">⚠</span></div><div class="notice-line compact"><span>ⓘ</span> O cofre de credenciais e os dados de autenticação serão preservados. Esta operação não pode ser desfeita sem um backup.</div><button class="button danger-button full" data-action="clear-operational-data">Limpar dados operacionais</button></section></div>
    <div class="settings-footnote"><b>Segurança local:</b> a senha-mestra não é salva. A chave de criptografia existe apenas na memória enquanto o aplicativo está desbloqueado. Limpar os dados do navegador, perder a senha-mestra ou apagar o backup pode tornar os dados irrecuperáveis.</div>`;
}

export function pageTitle(view) { return VIEW_META[view] || VIEW_META.dashboard; }

export function renderProductForm(product = null) {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><div><span class="eyebrow">CATÁLOGO</span><h2 id="modalTitle">${product ? 'Editar produto' : 'Cadastrar produto'}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Fechar">×</button></div><form class="form-grid" data-form="product" data-id="${product?.id || ''}"><label class="field full-field">Nome do produto<input name="name" required maxlength="90" value="${escapeHtml(product?.name || '')}" placeholder="Ex.: Arroz 5 kg"></label><label class="field">Categoria<select name="category">${categoryOptions(product?.category || 'comida')}</select></label><label class="field">Preço (R$)<input name="price" type="number" min="0" step="0.01" required value="${product?.price ?? ''}" placeholder="0,00"></label><label class="field full-field">Unidade<input name="unit" maxlength="20" value="${escapeHtml(product?.unit || 'un')}" placeholder="un, kg, L, pacote..."></label><div class="modal-actions full-field"><button type="button" class="button subtle" data-action="close-modal">Cancelar</button><button class="button primary" type="submit">${product ? 'Salvar alterações' : 'Cadastrar produto'}</button></div></form></section></div>`;
}

export function renderCredentialForm(entry = null) {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><div><span class="eyebrow">COFRE CRIPTOGRAFADO</span><h2 id="modalTitle">${entry ? 'Editar credencial' : 'Nova credencial'}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Fechar">×</button></div><form class="form-grid" data-form="credential" data-id="${entry?.id || ''}"><label class="field full-field">Serviço / identificação<input name="service" required maxlength="90" value="${escapeHtml(entry?.service || '')}" placeholder="Ex.: E-mail pessoal"></label><label class="field full-field">E-mail / usuário<input name="email" maxlength="150" value="${escapeHtml(entry?.email || '')}" placeholder="Login ou e-mail"></label><label class="field full-field">Senha<input name="password" type="password" maxlength="300" autocomplete="new-password" value="${escapeHtml(entry?.password || '')}" placeholder="Senha da conta"></label><label class="field full-field">Código de recuperação<input name="recoveryCode" type="password" maxlength="500" autocomplete="off" value="${escapeHtml(entry?.recoveryCode || '')}" placeholder="Código secreto de recuperação"></label><label class="field full-field">Chave de autenticação de dois fatores (2FA)<input name="totpSecret" type="password" maxlength="300" autocomplete="off" value="${escapeHtml(entry?.totpSecret || '')}" placeholder="Chave secreta 2FA, se houver"></label><label class="field full-field">Observações<textarea name="notes" rows="2" maxlength="500">${escapeHtml(entry?.notes || '')}</textarea></label><div class="notice-line compact full-field">Os campos deste cofre são criptografados. Não compartilhe o código mestre.</div><div class="modal-actions full-field"><button type="button" class="button subtle" data-action="close-modal">Cancelar</button><button class="button primary" type="submit">Salvar no cofre</button></div></form></section></div>`;
}

export function renderTransactionEditForm(item) {
  const date = new Date(item.date);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true"><div class="modal-header"><div><span class="eyebrow">MOVIMENTAÇÃO</span><h2>Editar lançamento</h2></div><button class="icon-button" data-action="close-modal">×</button></div><form class="form-grid" data-form="edit-transaction" data-id="${item.id}"><label class="field full-field">Descrição<input name="description" required value="${escapeHtml(item.description)}"></label><label class="field">Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required value="${item.amount}"></label><label class="field">Categoria<select name="category">${categoryOptions(item.category)}</select></label><label class="field full-field">Data e horário<input name="date" type="datetime-local" value="${localDate}" required></label><label class="field full-field">Observações<textarea name="notes" rows="2">${escapeHtml(item.notes || '')}</textarea></label><div class="modal-actions full-field"><button type="button" class="button subtle" data-action="close-modal">Cancelar</button><button class="button primary" type="submit">Salvar</button></div></form></section></div>`;
}

export function renderFinalizeForm(total) {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true"><div class="modal-header"><div><span class="eyebrow">FECHAMENTO DE CAIXA</span><h2>Finalizar compra</h2></div><button class="icon-button" data-action="close-modal">×</button></div><form class="form-grid" data-form="finalize-purchase"><label class="field full-field">Identificação da compra<input name="name" maxlength="90" value="Compra de supermercado"></label><div class="checkout-total full-field"><span>Total da compra</span><strong>${money(total)}</strong></div><label class="checkbox-field full-field"><input type="checkbox" name="addToFinance"><span><b>Lançar como despesa no controle financeiro</b><small>Ao marcar, o valor será descontado do saldo registrado. Desmarcado, ficará somente no histórico do supermercado.</small></span></label><div class="modal-actions full-field"><button type="button" class="button subtle" data-action="close-modal">Voltar</button><button class="button primary" type="submit">Confirmar compra</button></div></form></section></div>`;
}

export function renderMasterCodeForm(title, description, action, extra = '') {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card compact-modal" role="dialog" aria-modal="true"><div class="modal-header"><div><span class="eyebrow">AUTORIZAÇÃO</span><h2>${title}</h2></div><button class="icon-button" data-action="close-modal">×</button></div><p class="muted">${description}</p><form class="form-grid" data-form="${action}" ${extra}><label class="field full-field">Código mestre<input name="masterCode" type="password" autocomplete="off" required></label><div class="modal-actions full-field"><button type="button" class="button subtle" data-action="close-modal">Cancelar</button><button class="button danger-button" type="submit">Confirmar</button></div></form></section></div>`;
}

export function renderPurchaseReport(purchase) {
  const rows = purchase.items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${money(item.unitPrice)}</td><td>${item.quantity} ${escapeHtml(item.unit || 'un')}</td><td>${money(item.subtotal)}</td></tr>`).join('');
  const when = purchase.finalizedAt || purchase.createdAt;
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card report-modal" role="dialog" aria-modal="true"><div class="modal-header no-print"><div><span class="eyebrow">COMPROVANTE LOCAL</span><h2>Relatório da compra</h2></div><button class="icon-button" data-action="close-modal">×</button></div><div class="purchase-print" id="purchasePrint"><div class="print-heading"><h1>Mercado & Finanças</h1><h2>${escapeHtml(purchase.name)}</h2><p>Data e horário: <b>${dateTime(when)}</b></p><p>Status: <b>${purchase.status === 'completed' ? 'Compra finalizada' : 'Lista salva'}</b></p>${purchase.status === 'completed' ? `<p>Financeiro: <b>${purchase.addedToFinance ? 'Despesa registrada' : 'Não vinculada ao financeiro'}</b></p>` : ''}</div><table class="print-table"><thead><tr><th>Produto</th><th>Preço unit.</th><th>Quantidade</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">TOTAL</td><td>${money(purchase.total)}</td></tr></tfoot></table><p class="print-footer">Relatório gerado localmente em ${dateTime(new Date())}</p></div><div class="modal-actions no-print"><button class="button subtle" data-action="close-modal">Fechar</button><button class="button primary" data-action="print-purchase">Imprimir / Salvar PDF</button></div></section></div>`;
}
