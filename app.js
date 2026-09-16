// --- ESTADO GLOBAL ---
let state = {
    transactions: JSON.parse(localStorage.getItem('lp_transactions')) || [
        // Dados de exemplo iniciais
        { id: 1, date: '2026-10-05', desc: 'Salário Diego', category: 'Receitas', value: 4168.00, type: 'receita' },
        { id: 2, date: '2026-10-10', desc: 'Supermercado', category: 'Alimentação', value: 350.00, type: 'despesa' },
        { id: 3, date: '2026-10-12', desc: 'Gasolina', category: 'Transporte', value: 150.00, type: 'despesa' },
        { id: 4, date: '2026-10-15', desc: 'Plano de Saúde', category: 'Saúde', value: 462.77, type: 'despesa' },
        { id: 5, date: '2026-10-20', desc: 'Investimento CDB', category: 'Investimentos', value: 500.00, type: 'investimento' }
    ],
    budgets: JSON.parse(localStorage.getItem('lp_budgets')) || {
        'Alimentação': 500,
        'Transporte': 400,
        'Saúde': 600,
        'Moradia': 1500,
        'Lazer': 300
    },
    currentMonth: '2026-10'
};

// --- FUNÇÕES DE NAVEGAÇÃO ---
function switchView(targetId) {
    // Esconde todas as views
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    // Mostra a view alvo
    document.getElementById(targetId).classList.add('active');
    
    // Atualiza classes ativas nos menus
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if(item.dataset.target === targetId) item.classList.add('active');
    });

    // Atualiza o título
    const titles = {
        'dashboard': 'Visão Geral',
        'detalhada': 'Controle Detalhado',
        'transacoes': 'Histórico e Adição',
        'faturas': 'Controle de Faturas',
        'gestao': 'Gestão e Cadastros'
    };
    document.getElementById('page-title').innerText = titles[targetId];

    // Se for mobile, fecha o menu sidebar
    document.getElementById('sidebar').classList.remove('open');

    // Renderiza a tela específica
    if(targetId === 'dashboard') renderDashboard();
    if(targetId === 'detalhada') renderOverview();
    if(targetId === 'transacoes') renderTransactions();
    if(targetId === 'faturas') renderInvoices();
}

// --- LÓGICA DE DADOS ---
function saveData() {
    localStorage.setItem('lp_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('lp_budgets', JSON.stringify(state.budgets));
}

function getMonthData(monthStr) {
    return state.transactions.filter(t => t.date.startsWith(monthStr));
}

function calculateTotals(transactions) {
    let receita = 0, despesa = 0, investimento = 0;
    transactions.forEach(t => {
        if(t.type === 'receita') receita += t.value;
        else if(t.type === 'despesa') despesa += t.value;
        else if(t.type === 'investimento') investimento += t.value;
    });
    return { receita, despesa, investimento, saldo: receita - despesa - investimento };
}

// --- RENDERIZAÇÃO: DASHBOARD ---
function renderDashboard() {
    const monthData = getMonthData(state.currentMonth);
    const totals = calculateTotals(monthData);

    document.getElementById('dash-receita').innerText = `R$ ${totals.receita.toFixed(2)}`;
    document.getElementById('dash-despesa').innerText = `R$ ${totals.despesa.toFixed(2)}`;
    document.getElementById('dash-saldo').innerText = `R$ ${totals.saldo.toFixed(2)}`;
    
    const comprometido = totals.receita > 0 ? (totals.despesa / totals.receita) * 100 : 0;
    document.getElementById('dash-comprometido').innerText = `${comprometido.toFixed(1)}%`;

    // Tabela de Categorias
    const tbody = document.getElementById('dashboard-categorias');
    tbody.innerHTML = '';

    const gastosPorCategoria = {};
    monthData.filter(t => t.type === 'despesa').forEach(t => {
        gastosPorCategoria[t.category] = (gastosPorCategoria[t.category] || 0) + t.value;
    });

    for (const [cat, gasto] of Object.entries(gastosPorCategoria)) {
        const orcado = state.budgets[cat] || 0;
        const disponivel = orcado - gasto;
        const percent = orcado > 0 ? (gasto / orcado) * 100 : 0;
        
        let statusColor = 'green';
        if (percent > 100) statusColor = 'red';
        else if (percent > 80) statusColor = 'orange';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cat}</td>
            <td>R$ ${orcado.toFixed(2)}</td>
            <td>R$ ${gasto.toFixed(2)}</td>
            <td style="color: ${disponivel < 0 ? 'red' : 'green'}">R$ ${disponivel.toFixed(2)}</td>
            <td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${statusColor}"></span> ${percent.toFixed(0)}%</td>
        `;
        tbody.appendChild(tr);
    }
}

// --- RENDERIZAÇÃO: DETALHADA (OVERVIEW) ---
function renderOverview() {
    const tbody = document.getElementById('overview-body');
    tbody.innerHTML = '';

    // Agrupar por Categoria e depois por Mês
    const categories = [...new Set(state.transactions.map(t => t.category))];
    
    // Meses do ano de 2026
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];

    categories.forEach(cat => {
        // Linha da Categoria (Pai)
        const trCat = document.createElement('tr');
        trCat.className = 'category-row';
        trCat.onclick = () => toggleCategory(cat);
        
        let totalCat = 0;
        let monthCells = '';

        months.forEach(m => {
            const monthStr = `2026-${m}`;
            const val = state.transactions
                .filter(t => t.category === cat && t.date.startsWith(monthStr))
                .reduce((acc, curr) => acc + (curr.type === 'receita' ? curr.value : -curr.value), 0);
            totalCat += val;
            monthCells += `<td>${val !== 0 ? 'R$ ' + val.toFixed(2) : '-'}</td>`;
        });

        trCat.innerHTML = `
            <td><i class="fas fa-chevron-right" id="icon-${cat.replace(/\s/g, '')}"></i> ${cat}</td>
            ${monthCells}
            <td><strong>R$ ${totalCat.toFixed(2)}</strong></td>
        `;
        tbody.appendChild(trCat);

        // Linhas de Subcategorias (Filhos) - Aqui usamos a descrição como subcategoria
        const subItems = [...new Set(state.transactions.filter(t => t.category === cat).map(t => t.desc))];
        
        subItems.forEach(sub => {
            const trSub = document.createElement('tr');
            trSub.className = `subcategory-row sub-${cat.replace(/\s/g, '')}`;
            
            let totalSub = 0;
            let subCells = '';

            months.forEach(m => {
                const monthStr = `2026-${m}`;
                const val = state.transactions
                    .filter(t => t.category === cat && t.desc === sub && t.date.startsWith(monthStr))
                    .reduce((acc, curr) => acc + (curr.type === 'receita' ? curr.value : -curr.value), 0);
                totalSub += val;
                subCells += `<td>${val !== 0 ? 'R$ ' + val.toFixed(2) : '-'}</td>`;
            });

            trSub.innerHTML = `
                <td>${sub}</td>
                ${subCells}
                <td>R$ ${totalSub.toFixed(2)}</td>
            `;
            tbody.appendChild(trSub);
        });
    });
}

function toggleCategory(catId) {
    const safeId = catId.replace(/\s/g, '');
    const rows = document.querySelectorAll(`.sub-${safeId}`);
    const icon = document.getElementById(`icon-${safeId}`);
    
    let isOpen = false;
    rows.forEach(row => {
        row.classList.toggle('open');
        if(row.classList.contains('open')) isOpen = true;
    });

    if(icon) {
        icon.className = isOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-right';
    }
}

function toggleAll(expand) {
    const rows = document.querySelectorAll('.subcategory-row');
    const icons = document.querySelectorAll('.category-row i');
    
    rows.forEach(row => {
        if(expand) row.classList.add('open');
        else row.classList.remove('open');
    });

    icons.forEach(icon => {
        icon.className = expand ? 'fas fa-chevron-down' : 'fas fa-chevron-right';
    });
}

// --- RENDERIZAÇÃO: TRANSAÇÕES ---
function renderTransactions() {
    const tbody = document.querySelector('#tabela-transacoes tbody');
    tbody.innerHTML = '';

    // Ordenar por data decrescente
    const sorted = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(t => {
        const tr = document.createElement('tr');
        const color = t.type === 'receita' ? 'green' : (t.type === 'investimento' ? 'blue' : 'red');
        const signal = t.type === 'receita' ? '+' : '-';
        
        tr.innerHTML = `
            <td>${t.date.split('-').reverse().join('/')}</td>
            <td>${t.desc}</td>
            <td>${t.category}</td>
            <td class="${color}">${signal} R$ ${t.value.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- RENDERIZAÇÃO: FATURAS ---
function renderInvoices() {
    const container = document.getElementById('lista-faturas');
    container.innerHTML = `
        <div style="padding: 15px; border-bottom: 1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>Cartão Nubank</strong><br>
                <small>Vencimento: Dia 01</small>
            </div>
            <div style="text-align:right;">
                <strong>R$ 1.234,56</strong><br>
                <span style="color: red; font-size: 0.8rem;">Pendente</span>
            </div>
            <button onclick="alert('Fatura Paga!')" style="padding: 5px 10px; font-size: 0.8rem;">Pagar</button>
        </div>
        <div style="padding: 15px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>Cartão Mercado Pago</strong><br>
                <small>Vencimento: Dia 17</small>
            </div>
            <div style="text-align:right;">
                <strong>R$ 450,00</strong><br>
                <span style="color: green; font-size: 0.8rem;">Pago</span>
            </div>
            <button disabled style="padding: 5px 10px; font-size: 0.8rem; background:#ccc;">Pago</button>
        </div>
    `;
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(e.currentTarget.dataset.target);
        });
    });

    // Menu Mobile
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Mudar Mês
    document.getElementById('month-select').addEventListener('change', (e) => {
        state.currentMonth = e.target.value;
        renderDashboard();
    });

    // Adicionar Transação
    document.getElementById('form-transacao').addEventListener('submit', (e) => {
        e.preventDefault();
        const newTrans = {
            id: Date.now(),
            date: document.getElementById('trans-data').value,
            desc: document.getElementById('trans-desc').value,
            category: document.getElementById('trans-categoria').value,
            value: parseFloat(document.getElementById('trans-valor').value),
            type: document.getElementById('trans-tipo').value
        };
        state.transactions.push(newTrans);
        saveData();
        e.target.reset();
        renderTransactions();
        alert('Transação adicionada com sucesso!');
    });

    // Inicialização
    switchView('dashboard');
});