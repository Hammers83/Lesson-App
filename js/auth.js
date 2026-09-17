let isLoginMode = true;

document.addEventListener('DOMContentLoaded', async () => {
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

    renderAuthForm();

    // Controlla la sessione all'avvio
try {
    if (window.supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();
            
            if (profile) {
                window.location.href = profile.is_admin ? 'pages/dashboard-admin.html' : 'pages/dashboard-student.html';
            }
        }
    }
} catch (err) {
    console.error("Errore verifica sessione:", err);
}

function renderAuthForm() {
    const headerTitle = document.getElementById('form-header-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const container = document.getElementById('form-fields-container');

    if (!container || !subtitle || !submitBtn || !switchText) return;

    const existingError = document.getElementById('login-error-msg');
    if (existingError) existingError.remove();

    if (isLoginMode) {
        headerTitle.innerText = "Accedi";
        subtitle.innerText = "Inserisci le tue credenziali per accedere";
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
        headerTitle.innerText = "Registrazione Allieva";
        subtitle.innerText = "Iscriviti per accedere ai corsi di Zumba con Angelo";
        submitBtn.innerText = "Completa Registrazione";
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

            <!-- Data di nascita disposta sopra al Telefono -->
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Data di Nascita</label>
                <input type="date" id="signup-data-nascita" required class="w-full px-4 py-2.5 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Telefono</label>
                <input type="tel" id="signup-telefono" required placeholder="+39 333 0000000" class="w-full px-4 py-2.5 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
                <input type="email" id="auth-email" required class="w-full px-4 py-2.5 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
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

// Funzione di Login
async function handleLogin() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return showAuthError("Credenziali errate o utente non trovato.");

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('is_admin')
        .eq('id', data.user.id)
        .single();

    if (profile) {
        window.location.href = profile.is_admin ? 'pages/dashboard-admin.html' : 'pages/dashboard-student.html';
    }
}

// Funzione di Registrazione
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

    // 1. Registrazione dell'utente
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { nome: nome, cognome: cognome }
        }
    });

    if (authError) return showAuthError(authError.message);
    if (!authData.user) return showAuthError("Errore durante la creazione dell'utente.");

    // 2. Inserimento record nella tabella profiles
    const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert([{
            id: authData.user.id,
            nome: nome,
            cognome: cognome,
            data_nascita: dataNascita,
            telefono: telefono,
            email: email,
            is_admin: false
        }]);

    if (profileError) {
        showAuthError("Errore nel salvataggio del profilo: " + profileError.message);
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
