let currentSessionData = null;
let chartPresenzeInstance = null;
let chartCertificatiInstance = null;

// Gestore globale del client Supabase
const getSupabase = () => window.supabaseClient || window.supabase;

// Utility per sanificare il testo ed evitare vulnerabilità XSS
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
    currentSessionData = await checkAuthAndRedirect('admin');
    if (!currentSessionData) return;

    if (typeof renderNavbar === 'function') {
        renderNavbar(currentSessionData.profile);
    }
    
    await loadAdminDashboard();
    
    // Inizializza la chat per l'admin
    if (typeof initChat === 'function') {
        await initChat(currentSessionData.profile);
    }

    const lessonForm = document.getElementById('form-create-lesson');
    if (lessonForm) {
        lessonForm.addEventListener('submit', handleCreateLesson);
    }
});

async function loadAdminDashboard() {
    await loadStudentsTable();
    await renderAnalytics();
    await loadAdminLessons();
}

async function loadStudentsTable() {
    const sb = getSupabase();
    const { data: profiles, error } = await sb
        .from('profiles')
        .select('*')
        .eq('is_admin', false)
        .order('nome', { ascending: true });
        
    const tbody = document.getElementById('table-students-body');
    if (!tbody) return;

    if (error) {
        console.error("Errore caricamento allieve:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-brand-pink">Errore nel caricamento dei dati.</td></tr>`;
        return;
    }

    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500">Nessuna allieva registrata.</td></tr>`;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Rendering efficiente tramite map/join per evitare ridisegni multipli del DOM
    tbody.innerHTML = profiles.map(p => {
        const dataScad = p.medical_certificate_expiration || p.scadenza_certificato || p.certificato_scadenza;
        const certUrl = p.medical_certificate_url || p.certificato_url;

        let badgeHtml = `<span class="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-black rounded-full uppercase">Mancante</span>`;

        if (dataScad) {
            const expDate = new Date(dataScad);
            expDate.setHours(23, 59, 59, 999);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            const formattedDate = expDate.toLocaleDateString('it-IT');

            if (diffDays < 0) {
                badgeHtml = `<span class="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-black rounded-full uppercase">Scaduto (${formattedDate})</span>`;
            } else if (diffDays <= 30) {
                badgeHtml = `<span class="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-[10px] font-black rounded-full uppercase">In Scadenza (${formattedDate})</span>`;
            } else {
                badgeHtml = `<span class="px-2 py-1 bg-brand-lime/20 text-brand-lime border border-brand-lime/40 text-[10px] font-black rounded-full uppercase">Valido (${formattedDate})</span>`;
            }
        }

        // Gestione Link/Download Certificato
        let docLinkHtml = `<span class="text-xs text-gray-500">Nessun file</span>`;
        if (certUrl) {
            const sanitizedUrl = escapeHtml(certUrl);
            if (certUrl.startsWith('http://') || certUrl.startsWith('https://')) {
                docLinkHtml = `
                    <a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 bg-brand-card border border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan hover:text-black rounded-lg text-xs font-bold transition inline-flex items-center gap-1">
                        <i class="fa-solid fa-file-pdf"></i> Vedi PDF
                    </a>`;
            } else {
                docLinkHtml = `
                    <button onclick="downloadCert('${sanitizedUrl}')" class="px-2.5 py-1 bg-brand-card border border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan hover:text-black rounded-lg text-xs font-bold transition inline-flex items-center gap-1">
                        <i class="fa-solid fa-file-pdf"></i> Vedi PDF
                    </button>`;
            }
        }

        const avatar = p.avatar_url ? escapeHtml(p.avatar_url) : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nome || 'A')}&background=CCFF00&color=000`;

        return `
            <tr class="hover:bg-white/5 transition">
                <td class="py-3 px-2">
                    <img src="${avatar}" class="w-9 h-9 rounded-xl object-cover border border-brand-border" alt="Avatar">
                </td>
                <td class="py-3 px-2 font-bold text-white">${escapeHtml(p.nome)} ${escapeHtml(p.cognome)}</td>
                <td class="py-3 px-2 text-xs text-gray-400">${escapeHtml(p.email || '-')}<br><span class="text-gray-500">${escapeHtml(p.telefono)}</span></td>
                <td class="py-3 px-2">${badgeHtml}</td>
                <td class="py-3 px-2">${docLinkHtml}</td>
            </tr>
        `;
    }).join('');
}

async function loadAdminLessons() {
    const sb = getSupabase();
    const container = document.getElementById('admin-lessons-container');
    if (!container) return;

    const { data: lessons, error } = await sb
        .from('lessons')
        .select(`
            *,
            bookings (
                profiles ( id, nome, cognome, telefono, email )
            )
        `)
        .order('datetime', { ascending: true });

    if (error || !lessons) {
        console.error("Errore caricamento lezioni:", error);
        container.innerHTML = `<p class="text-xs text-brand-pink">Errore nel caricamento delle lezioni.</p>`;
        return;
    }

    if (lessons.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 col-span-2">Nessuna lezione creata.</p>`;
        return;
    }

    container.innerHTML = lessons.map(lesson => {
        const date = new Date(lesson.datetime);
        const formattedDate = date.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
        const formattedTime = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        
        const iscritti = lesson.bookings ? lesson.bookings.map(b => b.profiles).filter(Boolean) : [];

        return `
            <div class="bg-brand-dark p-5 rounded-2xl border border-brand-border space-y-3">
                <div class="flex justify-between items-center border-b border-brand-border pb-2">
                    <div>
                        <h4 class="text-base font-black text-white">${escapeHtml(lesson.title || 'Lezione')}</h4>
                        <span class="text-xs text-brand-cyan font-bold">${formattedDate} - ${formattedTime}</span>
                    </div>
                    <span class="text-xs bg-brand-card px-2.5 py-1 rounded-lg text-white font-bold border border-brand-border">
                        ${iscritti.length} / ${lesson.capacity || 20} Presenze
                    </span>
                </div>

                <div>
                    <p class="text-xs font-bold text-gray-400 uppercase mb-2">Allieve Prenotate:</p>
                    ${iscritti.length > 0 ? `
                        <ul class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            ${iscritti.map(student => `
                                <li class="text-xs bg-brand-card p-2 rounded-xl flex justify-between items-center border border-brand-border/50">
                                    <span class="font-bold text-white"><i class="fa-solid fa-user text-brand-lime mr-1.5"></i>${escapeHtml(student.nome)} ${escapeHtml(student.cognome)}</span>
                                    <span class="text-[10px] text-gray-400">${escapeHtml(student.telefono || student.email)}</span>
                                </li>
                            `).join('')}
                        </ul>
                    ` : `
                        <p class="text-xs italic text-gray-500">Nessuna prenotazione al momento.</p>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

window.downloadCert = async function(path) {
    const sb = getSupabase();
    const { data, error } = await sb.storage.from('certificates').createSignedUrl(path, 60);
    if (error) {
        alert("Errore nel download del certificato: " + error.message);
        return;
    }
    if (data && data.signedUrl) {
        window.open(data.signedUrl, '_blank');
    }
};

async function handleCreateLesson(e) {
    e.preventDefault();
    const sb = getSupabase();
    
    const titleInput = document.getElementById('lesson-title');
    const datetimeInput = document.getElementById('lesson-datetime');
    const capacityInput = document.getElementById('lesson-capacity');

    const title = titleInput.value.trim();
    const datetime = datetimeInput.value;
    const capacity = parseInt(capacityInput.value, 10);

    if (!title || !datetime || isNaN(capacity)) {
        alert("Compila tutti i campi correttamente.");
        return;
    }

    const { error } = await sb.from('lessons').insert([{ 
        title: title, 
        datetime: datetime, 
        capacity: capacity 
    }]);

    if (error) {
        alert("Errore durante la creazione della lezione: " + error.message);
    } else {
        alert("Lezione creata con successo!");
        document.getElementById('form-create-lesson').reset();
        await loadAdminDashboard();
    }
}

async function renderAnalytics() {
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js non è stato caricato.");
        return;
    }

    const sb = getSupabase();
    const { data: profiles } = await sb.from('profiles').select('*').eq('is_admin', false);
    const { data: lessons } = await sb.from('lessons').select('title, bookings(count)');

    let validi = 0, scaduti = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    if (profiles) {
        profiles.forEach(p => {
            const dataScad = p.medical_certificate_expiration || p.scadenza_certificato || p.certificato_scadenza;
            if (!dataScad) {
                scaduti++;
            } else {
                const expDate = new Date(dataScad);
                expDate.setHours(23, 59, 59, 999);
                if (expDate < today) {
                    scaduti++;
                } else {
                    validi++;
                }
            }
        });
    }

    const chartCertEl = document.getElementById('chart-certificati');
    if (chartCertEl) {
        if (chartCertificatiInstance) chartCertificatiInstance.destroy();
        chartCertificatiInstance = new Chart(chartCertEl.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Validi', 'Scaduti/Assenti'],
                datasets: [{ data: [validi, scaduti], backgroundColor: ['#CCFF00', '#FF007F'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const labels = lessons ? lessons.map(l => l.title || 'Lezione') : [];
    const counts = lessons ? lessons.map(l => (l.bookings && l.bookings[0]) ? l.bookings[0].count : 0) : [];

    const chartPresEl = document.getElementById('chart-presenze');
    if (chartPresEl) {
        if (chartPresenzeInstance) chartPresenzeInstance.destroy();
        chartPresenzeInstance = new Chart(chartPresEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Partecipanti', data: counts, backgroundColor: '#00E5FF', borderRadius: 8 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}
