let isLoginMode = true;

document.addEventListener('DOMContentLoaded', async () => {
    // Gestione dei click (Event Delegation per evitare problemi di listener)
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'btn-toggle-auth') {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            renderAuthForm();
        }
    });

    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }

    // Renderizza il form iniziale (Login di default)
    renderAuthForm();

    // Controlla la sessione utente in background
    try {
        if (typeof supabase !== 'undefined') {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
                if (profile) {
                    window.location.href = profile.is_admin ? 'pages/dashboard-admin.html' : 'pages/dashboard-student.html';
                }
            }
        }
    } catch (err) {
        console.error("Errore durante la verifica della sessione:", err);
    }
});

function renderAuthForm() {
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const container = document.getElementById('form-fields-container');

    if (!container || !subtitle || !submitBtn || !switchText) return;

    const existingError = document.getElementById('login-error-msg');
    if (existingError) existingError.remove();

    if (isLoginMode) {
        subtitle.innerText = "Accedi per gestire le tue lezioni";
        submitBtn.innerText = "Entra";
        switchText.innerHTML = `Non hai un account? <button type="button" id="btn-toggle-auth" class="text-brand-lime font-bold hover:underline ml-1">Registrati</button>`;
        
        container.innerHTML = `
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
                <input type="email" id="auth-email" required class="w-full px-4 py-3 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
                <input type="password" id="auth-password" required class="w-full px-4 py-3 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
            </div>
        `;
    } else {
        subtitle.innerText = "Inserisci i tuoi dati per registrarti";
        submitBtn.innerText = "Completa Iscrizione";
        switchText.innerHTML = `Hai già un account? <button type="button" id="btn-toggle-auth" class="text-brand-cyan font-bold hover:underline ml-1">Accedi</button>`;
        
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Nome</label>
                    <input type="text" id="signup-nome" required class="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Cognome</label>
                    <input type="text" id="signup-cognome" required class="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Data di Nascita</label>
                    <input type="date" id="signup-data-nascita" required class="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Telefono</label>
                    <input type="tel" id="signup-telefono" required class="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
                <input type="email" id="auth-email" required class="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
                    <input type="password" id="auth-password" required class="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Conferma Password</label>
                    <input type="password" id="signup-confirm-password" required class="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
                </div>
            </div>
        `;
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (isLoginMode) {
        await handleLogin();
    } else {
        await handleSignup();
    }
}

async function handleLogin() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return showAuthError("Credenziali errate o utente inesistente.");

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).single();
    if (profile) {
        window.location.href = profile.is_admin ? 'pages/dashboard-admin.html' : 'pages/dashboard-student.html';
    }
}

async function handleSignup() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (password !== confirmPassword) {
        showAuthError("Le password non coincidono.");
        return;
    }

    const nome = document.getElementById('signup-nome').value.trim();
    const cognome = document.getElementById('signup-cognome').value.trim();
    const dataNascita = document.getElementById('signup-data-nascita').value;
    const telefono = document.getElementById('signup-telefono').value.trim();

    // 1. Registrazione dell'utente su Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return showAuthError(authError.message);

    const userId = authData.user.id;

    // 2. Inserimento del profilo nel database
    const { error: profileError } = await supabase.from('profiles').insert([{
        id: userId,
        nome: nome,
        cognome: cognome,
        data_nascita: dataNascita,
        telefono: telefono,
        email: email,
        is_admin: false
    }]);

    if (profileError) {
        showAuthError("Errore durante il salvataggio del profilo.");
        return;
    }

    alert("Registrazione completata con successo!");
    window.location.href = 'pages/dashboard-student.html';
}

function showAuthError(msg) {
    const form = document.getElementById('auth-form');
    let errDiv = document.getElementById('login-error-msg');
    if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = 'login-error-msg';
        errDiv.className = 'p-3 mb-4 text-xs font-bold text-white bg-brand-pink/20 border border-brand-pink/50 rounded-xl flex items-center gap-2';
        form.prepend(errDiv);
    }
    errDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation text-brand-pink"></i> ${msg}`;
}
