let currentSessionData = null;
let chartPresenzeInstance = null;
let chartCertificatiInstance = null;

// Gestore globale del client Supabase
const getSupabase = () => window.supabaseClient || window.supabase;

document.addEventListener('DOMContentLoaded', async () => {
    currentSessionData = await checkAuthAndRedirect('admin');
    if (!currentSessionData) return;

    renderNavbar(currentSessionData.profile);
    await loadAdminDashboard();

    const lessonForm = document.getElementById('form-create-lesson');
    if (lessonForm) {
        lessonForm.addEventListener('submit', handleCreateLesson);
    }
});

async function loadAdminDashboard() {
    await loadStudentsTable();
    await renderAnalytics();
}

async function loadStudentsTable() {
    const sb = getSupabase();
    const { data: profiles, error } = await sb.from('profiles').select('*').eq('is_admin', false);
    const tbody = document.getElementById('table-students-body');
    
    if (!tbody) return;
    tbody.innerHTML = '';

    if (error) {
        console.error("Errore caricamento allieve:", error);
        return;
    }

    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500">Nessuna allieva registrata.</td></tr>`;
        return;
    }

    profiles.forEach(p => {
        // Controllo campo sia in italiano che inglese per sicurezza
        const dataScadenza = p.scadenza_certificato || p.certificato_scadenza;
        const isExpired = dataScadenza ? new Date(dataScadenza) < new Date() : true;
        const dataFormattata = dataScadenza ? new Date(dataScadenza).toLocaleDateString('it-IT') : 'Non presente';

        tbody.innerHTML += `
            <tr class="hover:bg-white/5 transition">
                <td class="py-3 px-2">
                    <img src="${p.avatar_url || 'https://via.placeholder.com/40'}" class="w-9 h-9 rounded-xl object-cover border border-brand-border">
                </td>
                <td class="py-3 px-2 font-bold text-white">${p.nome || ''} ${p.cognome || ''}</td>
                <td class="py-3 px-2 text-xs text-gray-400">${p.email || '-'}<br>${p.telefono || ''}</td>
                <td class="py-3 px-2 text-xs font-semibold ${isExpired ? 'text-brand-pink' : 'text-brand-lime'}">
                    ${dataFormattata}
                </td>
                <td class="py-3 px-2">
                    ${p.certificato_url 
                        ? `<button onclick="downloadCert('${p.certificato_url}')" class="text-brand-cyan hover:underline text-xs font-bold"><i class="fa-solid fa-file-pdf mr-1"></i> PDF</button>` 
                        : '<span class="text-xs text-gray-500">Assente</span>'}
                </td>
            </tr>
        `;
    });
}

async function downloadCert(path) {
    const sb = getSupabase();
    const { data, error } = await sb.storage.from('certificates').createSignedUrl(path, 60);
    if (error) {
        alert("Errore nel download del certificato.");
        return;
    }
    if (data) window.open(data.signedUrl, '_blank');
}

async function handleCreateLesson(e) {
    e.preventDefault();
    const sb = getSupabase();
    
    // Mappatura compatibile sia per campi IT che EN
    const title = document.getElementById('lesson-title').value;
    const datetime = document.getElementById('lesson-datetime').value;
    const capacity = parseInt(document.getElementById('lesson-capacity').value);

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
    const sb = getSupabase();
    const { data: profiles } = await sb.from('profiles').select('*').eq('is_admin', false);
    const { data: lessons } = await sb.from('lessons').select('*, bookings(count)');

    let validi = 0, scaduti = 0;
    if (profiles) {
        profiles.forEach(p => {
            const dataScad = p.scadenza_certificato || p.certificato_scadenza;
            if (!dataScad || new Date(dataScad) < new Date()) {
                scaduti++;
            } else {
                validi++;
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

    const labels = lessons ? lessons.map(l => l.title || l.titolo || 'Lezione') : [];
    const counts = lessons ? lessons.map(l => l.bookings[0]?.count || 0) : [];

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
