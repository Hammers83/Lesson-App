let currentSessionData = null;
let chartPresenzeInstance = null;
let chartCertificatiInstance = null;

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
    const { data: profiles } = await supabase.from('profiles').select('*').eq('is_admin', false);
    const tbody = document.getElementById('table-students-body');
    tbody.innerHTML = '';

    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500">Nessuna allieva registrata.</td></tr>`;
        return;
    }

    profiles.forEach(p => {
        const isExpired = new Date(p.scadenza_certificato) < new Date();
        tbody.innerHTML += `
            <tr class="hover:bg-white/5 transition">
                <td class="py-3 px-2">
                    <img src="${p.avatar_url || 'https://via.placeholder.com/40'}" class="w-9 h-9 rounded-xl object-cover border border-brand-border">
                </td>
                <td class="py-3 px-2 font-bold text-white">${p.nome} ${p.cognome}</td>
                <td class="py-3 px-2 text-xs text-gray-400">${p.email}<br>${p.telefono || ''}</td>
                <td class="py-3 px-2 text-xs font-semibold ${isExpired ? 'text-brand-pink' : 'text-brand-lime'}">
                    ${p.scadenza_certificato}
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

async function renderAnalytics() {
    const { data: profiles } = await supabase.from('profiles').select('*').eq('is_admin', false);
    const { data: lessons } = await supabase.from('lessons').select('*, bookings(count)');

    let validi = 0, scaduti = 0;
    if (profiles) {
        profiles.forEach(p => {
            if (new Date(p.scadenza_certificato) < new Date()) scaduti++;
            else validi++;
        });
    }

    if (chartCertificatiInstance) chartCertificatiInstance.destroy();
    chartCertificatiInstance = new Chart(document.getElementById('chart-certificati').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Validi', 'Scaduti'],
            datasets: [{ data: [validi, scaduti], backgroundColor: ['#CCFF00', '#FF007F'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const labels = lessons ? lessons.map(l => l.titolo) : [];
    const counts = lessons ? lessons.map(l => l.bookings[0]?.count || 0) : [];

    if (chartPresenzeInstance) chartPresenzeInstance.destroy();
    chartPresenzeInstance = new Chart(document.getElementById('chart-presenze').getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Partecipanti', data: counts, backgroundColor: '#00E5FF', borderRadius: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
