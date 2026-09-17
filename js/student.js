let currentSessionData = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentSessionData = await checkAuthAndRedirect('student');
    if (!currentSessionData) return;

    renderNavbar(currentSessionData.profile);
    await loadStudentData();
});

async function loadStudentData() {
    const profile = currentSessionData.profile;
    
    document.getElementById('student-welcome').innerText = `Benvenuta, ${profile.nome}!`;
    document.getElementById('student-avatar-img').src = profile.avatar_url || 'https://via.placeholder.com/80';

    const statusEl = document.getElementById('student-cert-status');
    const isExpired = new Date(profile.scadenza_certificato) < new Date();
    
    statusEl.innerHTML = isExpired 
        ? `<span class="text-brand-pink font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Certificato Scaduto (${profile.scadenza_certificato})</span>`
        : `<span class="text-brand-lime font-bold"><i class="fa-solid fa-circle-check"></i> Certificato Valido fino al ${profile.scadenza_certificato}</span>`;

    const { data: lessons } = await supabase.from('lessons').select('*').gte('data_ora', new Date().toISOString()).order('data_ora', { ascending: true });
    const { data: userBookings } = await supabase.from('bookings').select('lesson_id').eq('user_id', profile.id);
    const bookedIds = userBookings ? userBookings.map(b => b.lesson_id) : [];

    const listEl = document.getElementById('student-lessons-list');
    listEl.innerHTML = '';

    if (!lessons || lessons.length === 0) {
        listEl.innerHTML = `<p class="text-sm text-gray-400 col-span-full">Nessuna lezione programmata al momento.</p>`;
        return;
    }

    lessons.forEach(lesson => {
        const isBooked = bookedIds.includes(lesson.id);
        const dateFormatted = new Date(lesson.data_ora).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        listEl.innerHTML += `
            <div class="bg-brand-dark border border-brand-border rounded-2xl p-4 flex justify-between items-center">
                <div>
                    <p class="font-bold text-white text-base">${lesson.titolo}</p>
                    <p class="text-xs text-gray-400 capitalize"><i class="fa-regular fa-clock mr-1 text-brand-cyan"></i>${dateFormatted}</p>
                </div>
                ${isBooked 
                    ? `<button onclick="cancelBooking('${lesson.id}')" class="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition">Annulla</button>`
                    : `<button onclick="bookLesson('${lesson.id}')" class="px-4 py-2 btn-gradient text-black font-bold text-xs rounded-xl shadow-md transition">Partecipo!</button>`
                }
            </div>
        `;
    });
}

async function bookLesson(lessonId) {
    await supabase.from('bookings').insert([{ lesson_id: lessonId, user_id: currentSessionData.profile.id }]);
    loadStudentData();
}

async function cancelBooking(lessonId) {
    await supabase.from('bookings').delete().eq('lesson_id', lessonId).eq('user_id', currentSessionData.profile.id);
    loadStudentData();
}
