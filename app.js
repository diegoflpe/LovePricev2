// ============================================
// LOVE PRICE - app.js (versão corrigida)
// ============================================

// --- ESTADO GLOBAL ---
let state = {
    transactions: [],
    budgets: {},
    user: null,
    currentMonth: '2026-10'
};

// ============================================
// INICIALIZAÇÃO - roda assim que o módulo carrega
// ============================================
function initApp() {
    console.log("🚀 initApp() iniciado");
    console.log("firebaseFns disponível?", !!window.firebaseFns);
    console.log("firebaseAuth disponível?", !!window.firebaseAuth);

    const loginScreen = document.getElementById('login-screen');
    const btnLogin = document.getElementById('btn-login');
    const loginErro = document.getElementById('login-erro');

    if (!window.firebaseFns) {
        console.error("❌ Firebase não carregado. Verifique o index.html.");
        return;
    }

    if (!btnLogin) {
        console.error("❌ Botão de login não encontrado!");
        return;
    }

    // --- LOGIN ---
    btnLogin.addEventListener('click', async () => {
        console.log("🖱️ Clique no botão Entrar");
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;

        if (!email || !senha) {
            loginErro.innerText = "Preencha e-mail e senha.";
            return;
        }

        try {
            loginErro.innerText = "Entrando...";
            await window.firebaseFns.signInWithEmailAndPassword(window.firebaseAuth, email, senha);
            // O onAuthStateChanged vai cuidar do resto
        } catch (error) {
            console.error("❌ Erro no login:", error);
            let msg = "Erro ao entrar.";
            if (error.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
            if (error.code === 'auth/user-not-found') msg = "Usuário não encontrado.";
            if (error.code === 'auth/wrong-password') msg = "Senha incorreta.";
            if (error.code === 'auth/invalid-email') msg = "E-mail inválido.";
            if (error.code === 'auth/network-request-failed') msg = "Falha de rede.";
            loginErro.innerText = msg;
        }
    });

    // --- LOGOUT ---
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await window.firebaseFns.signOut(window.firebaseAuth);
        });
    }

    // --- MONITORA AUTENTICAÇÃO ---
    window.firebaseFns.onAuthStateChanged(window.firebaseAuth, async (user) => {
        console.log("🔔 onAuthStateChanged:", user ? user.email : "deslogado");

        if (user) {
            state.user = user;
            loginScreen.style.display = 'none';
            try {
                await loadDataFromCloud();
                setupListeners();
                switchView('dashboard');
            } catch (err) {
                console.error("Erro ao carregar dados:", err);
                alert("Erro ao carregar dados: " + err.message);
            }
        } else {
            state.user = null;
            loginScreen.style.display = 'flex';
        }
    });
}

// ============================================
// LISTENERS DE NAVEGAÇÃO E FORMULÁRIOS
// ============================================
function setupListeners() {
    console.log("🔧 Configurando listeners...");

    // Navegação (sidebar + bottom nav)
    document.querySelectorAll('.nav-item').forEach(item => {
        // Remove listeners antigos
        const clone = item.cloneNode(true);
        item.parentNode.replaceChild(clone, item);
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.dataset.target;
            if (target) switchView(target);
        });
    });

    // Menu mobile
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }

    // Seletor de mês
    const monthSelect = document.getElementById('month-select');
    if (monthSelect) {
        monthSelect.addEventListener('change', (e) => {
            state.currentMonth = e.target.value;
            renderDashboard();
            renderOverview();
        });
    }

    // Formulário de transação
    const formTrans = document.getElementById('form-transacao');
    if (formTrans) {
        formTrans.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newTrans = {
                date: document.getElementById('trans-data').value,
                desc: document.getElementById('trans-desc').value,
                category: document.getElementById('trans-categoria').value,
                value: parseFloat(document.getElementById('trans-valor').value),
                type: document.getElementById('trans-tipo').value
            };

            try {
                await addTransactionToCloud(newTrans);
                e.target.reset();
                renderTransactions();
                renderDashboard();
                renderOverview();
                alert('✅ Transação salva!');
            } catch (error) {
                console.error(error);
                alert('Erro ao salvar: ' + error.message);
            }
        });
    }
}

// ============================================
// BANCO DE DADOS (FIRESTORE)
// ============================================
async function loadDataFromCloud() {
    if (!state.user) return;
    console.log("📥 Carregando dados da nuvem...");

    const transRef = window.firebaseFns.collection(window.firebaseDB, 'users', state.user.uid, 'transactions');
    const snapshot = await window.firebaseFns.getDocs(transRef);

    state.transactions = [];
    snapshot.forEach(d => {
        state.transactions.push({ id: d.id, ...d.data() });
    });
    console.log(`✅ ${state.transactions.length} transações carregadas`);

    // Carregar budgets
    try {
        const budgetRef = window.firebaseFns.doc(window.firebaseDB, 'users', state.user.uid, 'config', 'budgets');
        const budgetSnap = await window.firebaseFns.getDoc(budgetRef);
        if (budgetSnap.exists()) {
            state.budgets = budgetSnap.data();
            console.log("✅ Budgets carregados:", state.budgets);
        } else {
            state.budgets = {
                'Alimentação': 500,
                'Transporte': 400,
                'Saúde': 600,
                'Moradia': 1500,
                'Lazer': 300
            };
            await window.firebaseFns.setDoc(budgetRef, state.budgets);
            console.log("✅ Budgets padrão criados");
        }
    } catch (err) {
        console.warn("Erro ao carregar budgets:", err);
    }

    renderDashboard();
    renderOverview();
    renderTransactions();
}

async function addTransactionToCloud(trans) {
    if (!state.user) throw new Error("Usuário não logado");
    const transRef = window.firebaseFns.collection(window.firebaseDB, 'users', state.user.uid, 'transactions');
    const docRef = await window.firebaseFns.addDoc(transRef, trans);
    trans.id = docRef.id;
    state.transactions.push(trans);
}

async function deleteTransactionFromCloud(id) {
    if (!state.user) return;
    const docRef = window.firebaseFns.doc(window.firebaseDB, 'users', state.user.uid, 'transactions', id);
    await window.firebaseFns.deleteDoc(docRef);
    state.transactions = state.transactions.filter(t => t.id !== id);
}

// ============================================
// NAVEGAÇÃO
// ============================================
function switchView(targetId) {
    console.log("🔄 Trocando para view:", targetId);
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const target = document.getElementById(targetId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.target === targetId) item.classList.add('active');
    });

    const titles = {
        'dashboard': 'Visão Geral',
        'detalhada': 'Controle Detalhado',
        'transacoes': 'Histórico e Adição',
        'faturas': 'Controle de Faturas',
        'gestao': 'Gestão e Cadastros'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = titles[targetId] || '';

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

// ============================================
// LÓGICA DE DADOS
// ============================================
function getMonthData(monthStr) {
    return state.transactions.filter(t => t.date.startsWith(monthStr));
}

function calculateTotals(transactions) {
    let receita = 0, despesa = 0, investimento = 0;
    transactions.forEach(t => {
        if (t.type === 'receita') receita += t.value;
        else if (t.type === 'despesa') despesa += t.value;
        else if (t.type === 'investimento') investimento += t.value;
    });
    return { receita, despesa, investimento, saldo: receita - despesa - investimento };
}

// ============================================
// RENDERIZAÇÃO
// ============================================
function renderDashboard() {
    const monthData = getMonthData(state.currentMonth);
    const totals = calculateTotals(monthData);

    document.getElementById('dash-receita').innerText = `R$ ${totals.receita.toFixed(2)}`;
    document.getElementById('dash-despesa').innerText = `R$ ${totals.despesa.toFixed(2)}`;
    document.getElementById('dash-saldo').innerText = `R$ ${totals.saldo.toFixed(2)}`;

    const comprometido = totals.receita > 0 ? (totals.despesa / totals.receita) * 100 : 0;
    document.getElementById('dash-comprometido').innerText = `${comprometido.toFixed(1)}%`;

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

function renderOverview() {
    const tbody = document.getElementById('overview-body');
    tbody.innerHTML = '';

    const categories = [...new Set(state.transactions.map(t => t.category))];
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const year = state.currentMonth.split('-')[0];

    categories.forEach(cat => {
        const trCat = document.createElement('tr');
        trCat.className = 'category-row';
        trCat.onclick = () => toggleCategory(cat);

        let totalCat = 0;
        let monthCells = '';

        months.forEach(m => {
            const monthStr = `${year}-${m}`;
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

        const subItems = [...new Set(state.transactions.filter(t => t.category === cat).map(t => t.desc))];

        subItems.forEach(sub => {
            const trSub = document.createElement('tr');
            trSub.className = `subcategory-row sub-${cat.replace(/\s/g, '')}`;

            let totalSub = 0;
            let subCells = '';

            months.forEach(m => {
                const monthStr = `${year}-${m}`;
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
        if (row.classList.contains('open')) isOpen = true;
    });
    if (icon) icon.className = isOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-right';
}

function toggleAll(expand) {
    const rows = document.querySelectorAll('.subcategory-row');
    const icons = document.querySelectorAll('.category-row i');
    rows.forEach(row => expand ? row.classList.add('open') : row.classList.remove('open'));
    icons.forEach(icon => icon.className = expand ? 'fas fa-chevron-down' : 'fas fa-chevron-right');
}

function renderTransactions() {
    const tbody = document.querySelector('#tabela-transacoes tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

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

// ============================================
// EXECUTA
// ============================================
initApp();