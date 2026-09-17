// CONFIGURAZIONE SUPABASE
const SUPABASE_URL = "https://aatelpatdppxdehbsxmz.supabase.co/rest/v1/"; 
const SUPABASE_ANON_KEY = "sb_publishable_dA9nfW05M1BFCdjRwkWRMA_XM_SxPuV";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
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

// GESTIONE VISTE E TAB (LOGIN / SIGNUP)
function switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const formLogin = document.getElementById('form-login');
    const formSignup = document.getElementById('form-signup');

    if (tab === 'login') {
        formLogin.classList.remove('hidden');
        formSignup.classList.add('hidden');
        tabLogin.className = 'w-1/2 py-2.5 text-center font-bold text-xs uppercase rounded-lg transition-all text-white bg-brand-pink shadow-md';
        tabSignup.className = 'w-1/2 py-2.5 text-center font-bold text-xs uppercase rounded-lg transition-all text-gray-400 hover:text-white';
    } else {
        formLogin.classList.add('hidden');
        formSignup.classList.remove('hidden');
        tabSignup.className = 'w-1/2 py-2.5 text-center font-bold text-xs uppercase rounded-lg transition-all text-white bg-brand-pink shadow-md';
        tabLogin.className = 'w-1/2 py-2.5 text-center font-bold text-xs uppercase rounded-lg transition-all text-gray-400 hover:text-white';
    }
}

function showAuthView() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('student-dashboard').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('nav-links').innerHTML = '';
}

// AUTENTICAZIONE: LOGIN
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert("Errore di accesso: " + error.message);

    currentUser = data.user;
    await loadUserProfile();
}

// AUTENTICAZIONE: REGISTRAZIONE
async function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const nome = document.getElementById('signup-nome').value;
    const cognome = document.getElementById('signup-cognome').value;
    const telefono = document.getElementById('signup-telefono').value;
    const scadenzaCert = document.getElementById('signup-cert-date').value;

    const avatarFile = document.getElementById('signup-avatar').files[0];
    const certFile = document.getElementById('signup-cert-file').files[0];

    // 1. Registrazione Account in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return alert("Errore registrazione: " + authError.message);

    const userId = authData.user.id;
    let avatarUrl = null;
    let certUrl = null;

    // 2. Upload Foto Profilo (Bucket 'avatars')
    if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(filePath, avatarFile);
        if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            avatarUrl = publicUrlData.publicUrl;
        }
    }

    // 3. Upload Certificato Medico (Bucket 'certificates')
    if (certFile) {
        const fileExt = certFile.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('certificates').upload(filePath, certFile);
        if (!uploadErr) {
            certUrl = filePath;
        }
    }

    // 4. Salvataggio Dati Anagrafici nella tabella Profiles
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

    if (profileError) return alert("Errore nel salvataggio profilo: " + profileError.message);

    alert("Registrazione completata con successo!");
    currentUser = authData.user;
    await loadUserProfile();
}

// LOGOUT
async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showAuthView();
}

// CARICA PROFILO UTENTE
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
        statusEl.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fa-solid fa-circle-check"></i> Certificato Valido fino al ${currentProfile.scadenza_certificato}</span>`;
    }

    // Carica Lezioni Disponibili
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
            <div class="bg-brand-dark/60 border border-brand-border rounded-2xl p-4 flex justify-between items-center">
                <div>
                    <p class="font-bold text-white text-base">${lesson.titolo}</p>
                    <p class="text-xs text-gray-400 capitalize"><i class="fa-regular fa-clock mr-1 text-brand-orange"></i>${dateFormatted}</p>
                </div>
                ${isBooked 
                    ? `<button onclick="cancelBooking('${lesson.id}')" class="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold text-xs rounded-xl transition">Annulla</button>`
                    : `<button onclick="bookLesson('${lesson.id}')" class="px-4 py-2 fitness-gradient text-white font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition">Partecipo!</button>`
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

// DASHBOARD ADMIN (ISTRUTTRICE)
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
                <td class="py-3 px-2 text-xs font-semibold ${new Date(p.scadenza_certificato) < new Date() ? 'text-brand-pink' : 'text-emerald-400'}">
                    ${p.scadenza_certificato}
                </td>
                <td class="py-3 px-2">
                    ${p.certificato_url 
                        ? `<button onclick="downloadCert('${p.certificato_url}')" class="text-brand-pink hover:underline text-xs font-bold"><i class="fa-solid fa-file-pdf mr-1"></i> Scarica PDF</button>` 
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
    alert("Lezione creata con successo!");
    document.getElementById('form-create-lesson').reset();
    loadAdminDashboard();
}

// ANALYTICS & GRAFICI (MODALITÀ SCURA)
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

    // 1. Grafico Certificati
    if (chartCertificatiInstance) chartCertificatiInstance.destroy();
    const ctxCert = document.getElementById('chart-certificati').getContext('2d');
    chartCertificatiInstance = new Chart(ctxCert, {
        type: 'doughnut',
        data: {
            labels: ['Validi', 'Scaduti'],
            datasets: [{
                data: [validi, scaduti],
                backgroundColor: ['#10B981', '#FF0055'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#9CA3AF', font: { weight: 'bold' } }
                }
            }
        }
    });

    // 2. Grafico Presenze Lezioni
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
                backgroundColor: '#FF5500',
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
