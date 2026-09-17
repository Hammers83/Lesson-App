// CONFIGURAZIONE SUPABASE
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co"; // Sostituisci
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";                 // Sostituisci

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

// GESTIONE VISTE E TAB
function switchAuthTab(tab) {
    if (tab === 'login') {
        document.getElementById('form-login').classList.remove('hidden');
        document.getElementById('form-signup').classList.add('hidden');
        document.getElementById('tab-login').className = 'w-1/2 py-2 text-center font-semibold text-rose-600 border-b-2 border-rose-600';
        document.getElementById('tab-signup').className = 'w-1/2 py-2 text-center font-semibold text-gray-400 border-b-2 border-transparent';
    } else {
        document.getElementById('form-login').classList.add('hidden');
        document.getElementById('form-signup').classList.remove('hidden');
        document.getElementById('tab-signup').className = 'w-1/2 py-2 text-center font-semibold text-rose-600 border-b-2 border-rose-600';
        document.getElementById('tab-login').className = 'w-1/2 py-2 text-center font-semibold text-gray-400 border-b-2 border-transparent';
    }
}

function showAuthView() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('student-dashboard').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('nav-links').innerHTML = '';
}

// LOGIN & SIGNUP
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert("Errore di accesso: " + error.message);

    currentUser = data.user;
    await loadUserProfile();
}

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

    // Registra Utente in Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return alert("Errore registrazione: " + authError.message);

    const userId = authData.user.id;
    let avatarUrl = null;
    let certUrl = null;

    // Upload Foto Profilo
    if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;
        await supabase.storage.from('avatars').upload(filePath, avatarFile);
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = publicUrlData.publicUrl;
    }

    // Upload Certificato Medico
    if (certFile) {
        const fileExt = certFile.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;
        await supabase.storage.from('certificates').upload(filePath, certFile);
        certUrl = filePath;
    }

    // Salva Dati Anagrafici nel Database
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
        <span class="text-sm font-medium">Ciao, ${currentProfile.nome}</span>
        <button onclick="handleLogout()" class="bg-white/20 hover:bg-white/30 text-white text-xs py-1 px-3 rounded-full border border-white/40">Esci</button>
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
        statusEl.innerHTML = `<span class="text-red-600 font-bold"><i class="fa-solid fa-circle-exclamation"></i> Certificato Medico Scaduto (${currentProfile.scadenza_certificato})</span>`;
    } else {
        statusEl.innerHTML = `<span class="text-emerald-600 font-bold"><i class="fa-solid fa-circle-check"></i> Certificato Valido fino al ${currentProfile.scadenza_certificato}</span>`;
    }

    // Carica Lezioni
    const { data: lessons } = await supabase.from('lessons').select('*').gte('data_ora', new Date().toISOString()).order('data_ora', { ascending: true });
    const { data: userBookings } = await supabase.from('bookings').select('lesson_id').eq('user_id', currentUser.id);
    const bookedLessonIds = userBookings ? userBookings.map(b => b.lesson_id) : [];

    const listEl = document.getElementById('student-lessons-list');
    listEl.innerHTML = '';

    lessons.forEach(lesson => {
        const isBooked = bookedLessonIds.includes(lesson.id);
        const dateFormatted = new Date(lesson.data_ora).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        listEl.innerHTML += `
            <div class="border rounded-xl p-4 flex justify-between items-center bg-gray-50">
                <div>
                    <p class="font-bold text-gray-800">${lesson.titolo}</p>
                    <p class="text-xs text-gray-500">${dateFormatted}</p>
                </div>
                ${isBooked 
                    ? `<button onclick="cancelBooking('${lesson.id}')" class="px-3 py-1 bg-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-300">Annulla</button>`
                    : `<button onclick="bookLesson('${lesson.id}')" class="px-3 py-1 bg-rose-600 text-white font-bold text-xs rounded-lg hover:bg-rose-700">Partecipo!</button>`
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

// DASHBOARD ADMIN & CHART.JS
async function loadAdminDashboard() {
    await loadStudentsTable();
    await renderAdminAnalytics();
}

async function loadStudentsTable() {
    const { data: profiles } = await supabase.from('profiles').select('*').eq('is_admin', false);
    const tbody = document.getElementById('table-students-body');
    tbody.innerHTML = '';

    profiles.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td class="py-2"><img src="${p.avatar_url || 'https://via.placeholder.com/40'}" class="w-8 h-8 rounded-full object-cover"></td>
                <td class="py-2 font-medium">${p.nome} ${p.cognome}</td>
                <td class="py-2 text-xs">${p.email}<br>${p.telefono || ''}</td>
                <td class="py-2">${p.scadenza_certificato}</td>
                <td class="py-2">
                    ${p.certificato_url ? `<button onclick="downloadCert('${p.certificato_url}')" class="text-rose-600 hover:underline text-xs"><i class="fa-solid fa-file-pdf"></i> Scarica PDF</button>` : 'Nessuno'}
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
    loadAdminDashboard();
}

async function renderAdminAnalytics() {
    const { data: profiles } = await supabase.from('profiles').select('*').eq('is_admin', false);
    const { data: lessons } = await supabase.from('lessons').select('*, bookings(count)');

    // 1. Chart Certificati Medici
    const oggi = new Date();
    let validi = 0, scaduti = 0;
    profiles.forEach(p => {
        if (new Date(p.scadenza_certificato) < oggi) scaduti++;
        else validi++;
    });

    if (chartCertificatiInstance) chartCertificatiInstance.destroy();
    const ctxCert = document.getElementById('chart-certificati').getContext('2d');
    chartCertificatiInstance = new Chart(ctxCert, {
        type: 'doughnut',
        data: {
            labels: ['Validi', 'Scaduti'],
            datasets: [{ data: [validi, scaduti], backgroundColor: ['#10B981', '#EF4444'] }]
        }
    });

    // 2. Chart Presenze per Lezione
    const labels = lessons.map(l => l.titolo + ' (' + new Date(l.data_ora).toLocaleDateString('it-IT') + ')');
    const counts = lessons.map(l => l.bookings[0]?.count || 0);

    if (chartPresenzeInstance) chartPresenzeInstance.destroy();
    const ctxPres = document.getElementById('chart-presenze').getContext('2d');
    chartPresenzeInstance = new Chart(ctxPres, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Iscritti', data: counts, backgroundColor: '#FF0844' }]
        },
        options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}
