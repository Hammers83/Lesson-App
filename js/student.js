let currentSessionData = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica che l'utente sia loggato (ruolo allieva)
    const authData = await checkAuthAndRedirect('student');
    if (!authData) return;

    // 2. Render della Navbar
    renderNavbar(authData.profile);

    // 3. Carica i dati del profilo e la lista delle lezioni
    renderStudentProfile(authData.profile);
    await loadAvailableLessons(authData.user.id);

    // Inizializza la chat per l'allieva
    if (typeof initChat === 'function') {
        await initChat(authData.profile);
    }
});

// Mostra i dati del profilo (Nome, Saluto e Stato Certificato)
function renderStudentProfile(profile) {
    const welcomeEl = document.getElementById('student-welcome');
    const certStatusEl = document.getElementById('student-cert-status');
    const avatarEl = document.getElementById('student-avatar-img');

    if (welcomeEl) {
        welcomeEl.innerText = `Ciao, ${profile.nome || 'Allieva'}!`;
    }

    if (avatarEl) {
        // Genera un avatar dinamico basato sul nome se non presente
        const initial = profile.nome ? profile.nome.charAt(0).toUpperCase() : 'Z';
        avatarEl.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${initial}&background=CCFF00&color=000`;
    }

    if (certStatusEl) {
        if (profile.certificato_scadenza) {
            const scadenza = new Date(profile.certificato_scadenza);
            const oggi = new Date();
            if (scadenza > oggi) {
                certStatusEl.innerHTML = `<span class="text-brand-lime font-bold"><i class="fa-solid fa-circle-check"></i> Certificato Medico Valido</span> (Scadenza: ${scadenza.toLocaleDateString('it-IT')})`;
            } else {
                certStatusEl.innerHTML = `<span class="text-brand-pink font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Certificato Scaduto</span> (${scadenza.toLocaleDateString('it-IT')})`;
            }
        } else {
            certStatusEl.innerHTML = `<span class="text-gray-400 font-bold"><i class="fa-solid fa-circle-info"></i> Certificato Medico Non Caricato</span>`;
        }
    }
}

/* 21-09-26 funzione lezione vecchia
// Carica le lezioni e verifica se l'allieva è già prenotata
async function loadAvailableLessons(userId) {
    const lessonsListContainer = document.getElementById('student-lessons-list');
    if (!lessonsListContainer) return;

    // Recupera le lezioni dal database
    const { data: lessons, error: lessonsError } = await window.supabaseClient
        .from('lessons')
        .select('*')
        .order('datetime', { ascending: true });

    if (lessonsError) {
        lessonsListContainer.innerHTML = `<p class="text-xs text-brand-pink">Errore nel caricamento delle lezioni.</p>`;
        return;
    }

    if (!lessons || lessons.length === 0) {
        lessonsListContainer.innerHTML = `<p class="text-xs text-gray-400">Nessuna lezione programmata al momento.</p>`;
        return;
    }

    // Recupera le prenotazioni effettuate da questa allieva
    const { data: bookings } = await window.supabaseClient
        .from('bookings')
        .select('lesson_id')
        .eq('user_id', userId);

    const bookedLessonIds = bookings ? bookings.map(b => b.lesson_id) : [];

    // Render delle schede lezioni
    lessonsListContainer.innerHTML = lessons.map(lesson => {
        const isBooked = bookedLessonIds.includes(lesson.id);
        const lessonDate = new Date(lesson.datetime);
        const formattedDate = lessonDate.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
        const formattedTime = lessonDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="bg-brand-dark p-5 rounded-2xl border border-brand-border flex flex-col justify-between space-y-4">
                <div>
                    <div class="flex justify-between items-start">
                        <span class="text-[10px] uppercase font-bold text-brand-cyan tracking-wider">${formattedDate} - ${formattedTime}</span>
                        <span class="text-[10px] bg-brand-card px-2 py-0.5 rounded-full text-gray-300 font-bold border border-brand-border">
                            Max ${lesson.capacity || 20} posti
                        </span>
                    </div>
                    <h4 class="text-base font-black text-white mt-2">${lesson.title || 'Zumba Fitness'}</h4>
                </div>

                <div>
                    ${isBooked ? `
                        <button onclick="cancelBooking('${lesson.id}', '${userId}')" class="w-full py-2.5 bg-brand-pink/20 hover:bg-brand-pink text-brand-pink hover:text-white border border-brand-pink/40 text-xs font-bold rounded-xl transition">
                            <i class="fa-solid fa-xmark"></i> Annulla Prenotazione
                        </button>
                    ` : `
                        <button onclick="bookLesson('${lesson.id}', '${userId}')" class="w-full py-2.5 btn-gradient text-black font-black text-xs uppercase rounded-xl shadow-md hover:opacity-90 transition">
                            <i class="fa-solid fa-plus"></i> Prenota Posto
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// Funzione per effettuare la prenotazione
async function bookLesson(lessonId, userId) {
    const { error } = await window.supabaseClient
        .from('bookings')
        .insert([{ lesson_id: lessonId, user_id: userId }]);

    if (error) {
        alert("Errore durante la prenotazione: " + error.message);
    } else {
        await loadAvailableLessons(userId);
    }
}

// Funzione per cancellare la prenotazione
async function cancelBooking(lessonId, userId) {
    const { error } = await window.supabaseClient
        .from('bookings')
        .delete()
        .eq('lesson_id', lessonId)
        .eq('user_id', userId);

    if (error) {
        alert("Errore durante la cancellazione: " + error.message);
    } else {
        await loadAvailableLessons(userId);
    }
} */

async function loadAvailableLessons(userId) {
    const sb = window.supabaseClient;
    const container = document.getElementById('student-lessons-list');
    if (!container) return;

    // 1. Prendi tutte le lezioni future con il conteggio delle prenotazioni
    const { data: lessons, error } = await sb
        .from('lessons')
        .select('*, bookings(user_id)')
        .order('datetime', { ascending: true });

    if (error || !lessons) {
        container.innerHTML = `<p class="text-xs text-brand-pink">Errore nel caricamento delle lezioni.</p>`;
        return;
    }

    if (lessons.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400">Nessuna lezione in programma.</p>`;
        return;
    }

    // 2. Genera le schede
    container.innerHTML = lessons.map(lesson => {
        const bookingsList = lesson.bookings || [];
        const isBooked = bookingsList.some(b => b.user_id === userId);
        const bookedCount = bookingsList.length;
        const capacity = lesson.capacity || 20;
        const isFull = bookedCount >= capacity;

        const date = new Date(lesson.datetime);
        const formattedDate = date.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
        const formattedTime = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="bg-brand-dark p-5 rounded-2xl border border-brand-border flex flex-col justify-between space-y-4">
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs uppercase font-bold text-brand-cyan">${formattedDate} - ${formattedTime}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${isFull ? 'bg-brand-pink/20 text-brand-pink border border-brand-pink/40' : 'bg-brand-lime/20 text-brand-lime border border-brand-lime/40'}">
                            ${bookedCount}/${capacity} Posti
                        </span>
                    </div>
                    <h4 class="text-base font-black text-white">${lesson.title}</h4>
                </div>

                <div>
                    ${isBooked ? `
                        <button onclick="toggleBooking(${lesson.id}, '${userId}', true)" class="w-full py-2.5 bg-brand-pink/20 hover:bg-brand-pink text-brand-pink hover:text-white border border-brand-pink/40 text-xs font-bold rounded-xl transition">
                            <i class="fa-solid fa-xmark mr-1"></i> Annulla Prenotazione
                        </button>
                    ` : `
                        <button onclick="toggleBooking(${lesson.id}, '${userId}', false)" ${isFull ? 'disabled' : ''} class="w-full py-2.5 ${isFull ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'btn-gradient text-black font-black'} text-xs uppercase rounded-xl transition">
                            <i class="fa-solid fa-check mr-1"></i> ${isFull ? 'Sold Out' : 'Prenota Posto'}
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// Funzione Unificata per Prenotare / Disdire
async function toggleBooking(lessonId, userId, isBooked) {
    const sb = window.supabaseClient;
    if (isBooked) {
        await sb.from('bookings').delete().eq('lesson_id', lessonId).eq('user_id', userId);
    } else {
        await sb.from('bookings').insert([{ lesson_id: lessonId, user_id: userId }]);
    }
    await loadAvailableLessons(userId);
}
