// CONFIGURAZIONE SUPABASE
const SUPABASE_URL = "https://aatelpatdppxdehbsxmz.supabase.co/rest/v1/"; 
const SUPABASE_ANON_KEY = "sb_publishable_dA9nfW05M1BFCdjRwkWRMA_XM_SxPuV";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let isLoginMode = true; // Modalità iniziale: LOGIN
let chartPresenzeInstance = null;
let chartCertificatiInstance = null;

// INIZIALIZZAZIONE STATO
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
    } else {
        showAuthView();
    }
});

// PASSAGGIO FLUIDO LOGIN <-> REGISTRAZIONE
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    
    // Rimuove messaggi d'errore precedenti
    const existingError = document.getElementById('login-error-msg');
    if (existingError) existingError.remove();

    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const container = document.getElementById('form-fields-container');

    if (isLoginMode) {
        // Modalità LOGIN
        subtitle.innerText = "Accedi per gestire le tue lezioni";
        submitBtn.innerText = "Entra";
        switchText.innerHTML = `Non hai un account? <button type="button" onclick="toggleAuthMode()" class="text-brand-lime font-bold hover:underline ml-1">Registrati</button>`;
        
        container.innerHTML = `
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1.5">Email</label>
                <input type="email" id="auth-email" required class="w-full px-4 py-3 bg-brand-dark/90 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-cyan focus:outline-none text-white text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1.5">Password</label>
                <input type="password" id="auth-password" required class="w-full px-4 py-3 bg-brand-dark/90 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-cyan focus:outline-none text-white text-sm">
            </div>
        `;
    } else {
        // Modalità REGISTRAZIONE CON DOPPIA PASSWORD
        subtitle.innerText = "Inserisci i tuoi dati per registrarti";
        submitBtn.innerText = "Completa Iscrizione";
        switchText.innerHTML = `Hai già un account? <button type="button" onclick="toggleAuthMode()" class="text-brand-cyan font-bold hover:underline ml-1">Accedi</button>`;
        
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Nome</label>
                    <input type="text" id="signup-nome" required class="w-full px-3 py-2.5 bg-brand-dark/90 border border-brand-border rounded-xl text-white text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Cognome</label>
                    <input type="text" id="signup-cognome" required class="w-full px-3 py-2.5 bg-brand-dark/90 border border-brand-border rounded-xl text-white text-sm">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
                <input type="email" id="auth-email" required class="w-full px-3 py-2.5 bg-brand-dark/90 border border-brand-border rounded-xl text-white text-sm">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
                    <input type="password" id="auth-password" required class="w-full px-3 py-2.5 bg-brand-dark/90 border border-brand-border rounded-xl text-white text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Conferma Password</label>
                    <input type="password" id="signup-confirm-password" required class="w-full px-3 py-2.5 bg-brand-dark/90 border border-brand-border rounded-xl text-white text-sm">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Telefono</label>
                <input type="tel" id="signup-telefono" class="w-full px-3 py-2.5 bg-brand-dark/90 border border-brand-border rounded-xl text-white text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Scadenza Certificato Medico</label>
                <input type="date" id="signup-cert-date" required class="w-full px-3 py-2.5 bg-brand-dark/90 border border-brand-border rounded-xl text-white text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Foto Profilo</label>
                <input type="file" id="signup-avatar" accept="image/*" class="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-cyan/20 file:text-brand-cyan file:font-bold">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Certificato Medico (PDF/Foto)</label>
                <input type="file" id="signup-cert-file" accept="application/pdf,image/*" required class="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-cyan/20 file:text-brand-cyan file:font-bold">
            </div>
        `;
    }
}

// INVIA FORM (LOGIN O REGISTRAZIONE)
async function handleAuthSubmit(e) {
    e.preventDefault();

    if (isLoginMode) {
        await handleLogin();
    } else {
        await handleSignup();
    }
}

// ESECUZIONE LOGIN
async function handleLogin() {
    const existingError = document.getElementById('login-error-msg');
    if (existingError) existingError.remove();

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        showAuthError("Email o password errate. Verificale o registrati.");
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

    if (profileError || !profile) {
        await supabase.auth.signOut();
        showAuthError("Profilo allieva non trovato. Contatta l'istruttrice.");
        return;
    }

    currentUser = data.user;
    await loadUserProfile();
}

// ESECUZIONE REGISTRAZIONE CON CONTROLLO DOPPIA PASSWORD
async function handleSignup() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    // CONTROLLO CORRISPONDENZA PASSWORD
    if (password !== confirmPassword) {
        showAuthError("Le password inserite non coincidono. Riprova.");
        return;
    }

    const nome = document.getElementById('signup-nome').value;
    const cognome = document.getElementById('signup-cognome').value;
    const telefono = document.getElementById('signup-telefono').value;
    const scadenzaCert = document.getElementById('signup-cert-date').value;

    const avatarFile = document.getElementById('signup-avatar').files[0];
    const certFile = document.getElementById('signup-cert-file').files[0];

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return showAuthError("Errore registrazione: " + authError.message);

    const userId = authData.user.id;
    let avatarUrl = null;
    let certUrl = null;

    if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(filePath, avatarFile);
        if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            avatarUrl = publicUrlData.publicUrl;
        }
    }

    if (certFile) {
        const fileExt = certFile.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('certificates').upload(filePath, certFile);
        if (!uploadErr) certUrl = filePath;
    }

    const { error: profileError } = await supabase.from('profiles').insert([{
        id: userId,
        nome,
        cognome,
        email,
        telefono,
        scadenza_certificato: scadenzaCert,
        avatar_url: avatarUrl,
        certificato_url: certUrl,
        is_admin: false
    }]);

    if (profileError) return showAuthError("Errore nel salvataggio profilo: " + profileError.message);

    alert("Registrazione completata!");
    currentUser = authData.user;
    await loadUserProfile();
}

function showAuthError(message) {
    const form = document.getElementById('auth-form');
    const existingError = document.getElementById('login-error-msg');
    if (existingError) existingError.remove();

    const errorDiv = document.createElement('div');
    errorDiv.id = 'login-error-msg';
    errorDiv.className = 'p-3 mb-4 text-xs font-bold text-white bg-brand-pink/20 border border-brand-pink/50 rounded-xl flex items-center gap-2 animate-pulse';
    errorDiv.innerHTML = `
        <i class="fa-solid fa-circle-exclamation text-brand-pink text-base"></i>
        <span>${message}</span>
    `;
    form.prepend(errorDiv);
}

function showAuthView() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('student-dashboard').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('nav-links').innerHTML = '';
}

// LOGOUT
async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showAuthView();
}

// CARICAMENTO PROFILO
async function loadUserProfile() {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (error || !data) return showAuthView();

    currentProfile = data;
    renderNavbar();

    if (currentProfile.is_admin) {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('student-dashboard').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        await loadAdminDashboard();
    } else {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
        await loadStudentDashboard();
    }
}

function renderNavbar() {
    document.getElementById('nav-links').innerHTML = `
        <span class="text-xs font-bold uppercase tracking-wider text-gray-300">Ciao, ${currentProfile.nome}</span>
        <button onclick="handleLogout()" class="bg-brand-pink/20 hover:bg-brand-pink text-brand-pink hover:text-white border border-brand-pink/40 text-xs font-bold py-1.5 px-4 rounded-xl transition">
            Esci
        </button>
    `;
}

// DASHBOARD ALLIEVA
async function loadStudentDashboard() {
    document.getElementById('student-welcome').innerText = `Benvenuta, ${currentProfile.nome}!`;
    document.getElementById('student-avatar-img').src = currentProfile.avatar_url || 'https://via.placeholder.com/80';

    const scadenza = new Date(currentProfile.scadenza_certificato);
    const oggi = new Date();
    const statusEl = document.getElementById('student-cert-status');

    if (scadenza < oggi) {
        statusEl.innerHTML = `<span class="text-brand-pink font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Certificato Scaduto (${currentProfile.scadenza_certificato})</span>`;
    } else {
        statusEl.innerHTML = `<span class="text-brand-lime font-bold"><i class="fa-solid fa-circle-check"></i> Certificato Valido fino al ${currentProfile.scadenza_certificato}</span>`;
    }

    const { data: lessons } = await supabase.from('lessons').select('*').gte('data_ora', new Date().toISOString()).order('data_ora', { ascending: true });
    const { data: userBookings } = await supabase.from('bookings').select('lesson_id').eq('user_id', currentUser.id);
    const bookedLessonIds = userBookings ? userBookings.map(b => b.lesson_id) : [];

    const listEl = document.getElementById('student-lessons-list');
    listEl.innerHTML = '';

    if (!lessons || lessons.length === 0) {
        listEl.innerHTML = `<p class="text-sm text-gray-400 col-span-full">Nessuna lezione programmata al momento.</p>`;
        return;
    }

    lessons.forEach(lesson => {
        const isBooked = bookedLessonIds.includes(lesson.id);
        const dateFormatted = new Date(lesson.data_ora).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        listEl.innerHTML += `
            <div class="bg-brand-dark/80 border border-brand-border rounded-2xl p-4 flex justify-between items-center">
                <div>
                    <p class="font-bold text-white text-base">${lesson.titolo}</p>
                    <p class="text-xs text-gray-400 capitalize"><i class="fa-regular fa-clock mr-1 text-brand-cyan"></i>${dateFormatted}</p>
                </div>
                ${isBooked 
                    ? `<button onclick="cancelBooking('${lesson.id}')" class="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition">Annulla</button>`
                    : `<button onclick="bookLesson('${lesson.id}')" class="px-4 py-2 btn-gradient text-black font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition">Partecipo!</button>`
                }
            </div>
        `;
    });
}

async function bookLesson(lessonId) {
    await supabase.from('bookings').insert([{ lesson_id: lessonId, user_id: currentUser.id }]);
    loadStudentDashboard();
}

async function cancelBooking(lessonId) {
    await supabase.from('bookings').delete().eq('lesson_id', lessonId).eq('user_id', currentUser.id);
    loadStudentDashboard();
}

// DASHBOARD ADMIN
async function loadAdminDashboard() {
    await loadStudentsTable();
    await renderAdminAnalytics();
}

async function loadStudentsTable() {
    const { data: profiles } = await supabase.from('profiles').select('*').eq('is_admin', false);
    const tbody = document.getElementById('table-students-body');
    tbody.innerHTML = '';

    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500">Nessuna allieva registrata.</td></tr>`;
        return;
    }

    profiles.forEach(p => {
        tbody.innerHTML += `
            <tr class="hover:bg-white/5 transition">
                <td class="py-3 px-2">
                    <img src="${p.avatar_url || 'https://via.placeholder.com/40'}" class="w-9 h-9 rounded-xl object-cover border border-brand-border">
                </td>
                <td class="py-3 px-2 font-bold text-white">${p.nome} ${p.cognome}</td>
                <td class="py-3 px-2 text-xs text-gray-400">${p.email}<br>${p.telefono || ''}</td>
                <td class="py-3 px-2 text-xs font-semibold ${new Date(p.scadenza_certificato) < new Date() ? 'text-brand-pink' : 'text-brand-lime'}">
                    ${p.scadenza_certificato}
                </td>
                <td class="py-3 px-2">
                    ${p.certificato_url 
                        ? `<button onclick="downloadCert('${p.certificato_url}')" class="text-brand-cyan hover:underline text-xs font-bold"><i class="fa-solid fa-file-pdf mr-1"></i> Scarica PDF</button>` 
                        : '<span class="text-xs text-gray-500">Assente</span>'}
                </td>
            </tr>
        `;
    });
}

async function downloadCert(path) {
    const { data } = await supabase.storage.from('certificates').createSignedUrl(path, 60);
    if (data) window.open(data.signedUrl, '_blank');
}

async function handleCreateLesson(e) {
    e.preventDefault();
    const titolo = document.getElementById('lesson-title').value;
    const data_ora = document.getElementById('lesson-datetime').value;
    const capienza_massima = document.getElementById('lesson-capacity').value;

    await supabase.from('lessons').insert([{ titolo, data_ora, capienza_massima }]);
    alert("Lezione creata!");
    document.getElementById('form-create-lesson').reset();
    loadAdminDashboard();
}

// ANALYTICS & GRAFICI
async function renderAdminAnalytics() {
    const { data: profiles } = await supabase.from('profiles').select('*').eq('is_admin', false);
    const { data: lessons } = await supabase.from('lessons').select('*, bookings(count)');

    const oggi = new Date();
    let validi = 0, scaduti = 0;
    
    if (profiles) {
        profiles.forEach(p => {
            if (new Date(p.scadenza_certificato) < oggi) scaduti++;
            else validi++;
        });
    }

    if (chartCertificatiInstance) chartCertificatiInstance.destroy();
    const ctxCert = document.getElementById('chart-certificati').getContext('2d');
    chartCertificatiInstance = new Chart(ctxCert, {
        type: 'doughnut',
        data: {
            labels: ['Validi', 'Scaduti'],
            datasets: [{
                data: [validi, scaduti],
                backgroundColor: ['#CCFF00', '#FF007F'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#9CA3AF', font: { weight: 'bold' } } }
            }
        }
    });

    const labels = lessons ? lessons.map(l => l.titolo) : [];
    const counts = lessons ? lessons.map(l => l.bookings[0]?.count || 0) : [];

    if (chartPresenzeInstance) chartPresenzeInstance.destroy();
    const ctxPres = document.getElementById('chart-presenze').getContext('2d');
    chartPresenzeInstance = new Chart(ctxPres, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Partecipanti',
                data: counts,
                backgroundColor: '#00E5FF',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#9CA3AF' }, grid: { display: false } },
                y: { ticks: { color: '#9CA3AF', stepSize: 1 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            },
            plugins: {
                legend: { labels: { color: '#9CA3AF' } }
            }
        }
    });
}
