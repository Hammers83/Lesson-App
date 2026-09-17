let isLoginMode = true;

document.addEventListener('DOMContentLoaded', async () => {
    // Gestione unificata dei click (Event Delegation per evitare problemi di listener)
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

    // Mostra il form iniziale
    renderAuthForm();

    // Controlla la sessione in background senza bloccare la grafica
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
            if (profile) {
                window.location.href = profile.is_admin ? 'pages/dashboard-admin.html' : 'pages/dashboard-student.html';
            }
        }
    } catch (err) {
        console.error("Errore verifica sessione:", err);
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
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Telefono</label>
                <input type="tel" id="signup-telefono" class="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Scadenza Certificato Medico</label>
                <input type="date" id="signup-cert-date" required class="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-xl text-white text-sm focus:outline-none focus:border-brand-cyan">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Foto Profilo</label>
                <input type="file" id="signup-avatar" accept="image/*" class="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-brand-cyan/20 file:text-brand-cyan font-bold">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Certificato Medico (PDF/Foto)</label>
                <input type="file" id="signup-cert-file" accept="application/pdf,image/*" required class="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-brand-cyan/20 file:text-brand-cyan font-bold">
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

    const nome = document.getElementById('signup-nome').value;
    const cognome = document.getElementById('signup-cognome').value;
    const telefono = document.getElementById('signup-telefono').value;
    const scadenzaCert = document.getElementById('signup-cert-date').value;

    const avatarFile = document.getElementById('signup-avatar').files[0];
    const certFile = document.getElementById('signup-cert-file').files[0];

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return showAuthError(authError.message);

    const userId = authData.user.id;
    let avatarUrl = null, certUrl = null;

    if (avatarFile) {
        const filePath = `${userId}/${Date.now()}.${avatarFile.name.split('.').pop()}`;
        const { error: err } = await supabase.storage.from('avatars').upload(filePath, avatarFile);
        if (!err) avatarUrl = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
    }

    if (certFile) {
        const filePath = `${userId}/${Date.now()}.${certFile.name.split('.').pop()}`;
        const { error: err } = await supabase.storage.from('certificates').upload(filePath, certFile);
        if (!err) certUrl = filePath;
    }

    await supabase.from('profiles').insert([{
        id: userId, nome, cognome, email, telefono,
        scadenza_certificato: scadenzaCert,
        avatar_url: avatarUrl, certificato_url: certUrl, is_admin: false
    }]);

    alert("Registrazione completata!");
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
