let currentSessionData = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica che l'utente sia loggato (ruolo allieva)
    const authData = await checkAuthAndRedirect('student');
    if (!authData) return;

    currentSessionData = authData;

    // 2. Render della Navbar
    renderNavbar(authData.profile);

    // 3. Carica i dati del profilo e gestisci lo stato del certificato
    renderStudentProfile(authData.profile);
    checkCertificateStatus(authData.profile);
    initCertUploadForm(authData.user);

    // 4. Inizializza Sistema Notifiche
    await initNotifications(authData.user.id);
    checkCertExpirationNotification(authData.user.id, authData.profile);

    // 5. Carica la lista delle lezioni
    await loadAvailableLessons(authData.user.id, authData.profile);

    // 6. Inizializza la chat per l'allieva
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
        const initial = profile.nome ? profile.nome.charAt(0).toUpperCase() : 'Z';
        avatarEl.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${initial}&background=CCFF00&color=000`;
    }

    if (certStatusEl) {
        const dataScad = profile.medical_certificate_expiration || profile.certificato_scadenza;
        if (dataScad) {
            const scadenza = new Date(dataScad);
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

// Carica le lezioni e controlla lo stato delle prenotazioni
async function loadAvailableLessons(userId, profile = {}) {
    const sb = window.supabaseClient;
    const container = document.getElementById('student-lessons-list');
    if (!container) return;

    const { data: lessons, error } = await sb
        .from('lessons')
        .select('*, bookings(user_id)')
        .order('datetime', { ascending: true });

    if (error) {
        console.error("Errore recupero lezioni:", error);
        container.innerHTML = `<p class="text-xs text-brand-pink">Errore nel caricamento delle lezioni: ${error.message}</p>`;
        return;
    }

    if (!lessons || lessons.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400">Nessuna lezione in programma.</p>`;
        return;
    }

    const certDate = profile.medical_certificate_expiration || profile.certificato_scadenza;
    const isCertValid = certDate ? new Date(certDate) > new Date() : false;

    container.innerHTML = lessons.map(lesson => {
        const bookingsList = lesson.bookings || [];
        const isBooked = bookingsList.some(b => b.user_id === userId);
        const bookedCount = bookingsList.length;
        const capacity = lesson.capacity || 20;
        const isFull = bookedCount >= capacity;

        const date = new Date(lesson.datetime);
        const formattedDate = date.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
        const formattedTime = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        let buttonHtml = '';
        if (isBooked) {
            buttonHtml = `
                <button onclick="toggleBooking('${lesson.id}', '${userId}', true)" class="w-full py-2.5 bg-brand-pink/20 hover:bg-brand-pink text-brand-pink hover:text-white border border-brand-pink/40 text-xs font-bold rounded-xl transition">
                    <i class="fa-solid fa-xmark mr-1"></i> Annulla Prenotazione
                </button>`;
        } else if (!isCertValid) {
            buttonHtml = `
                <button disabled class="w-full py-2.5 bg-gray-800 text-red-400 border border-red-500/20 text-xs font-bold rounded-xl cursor-not-allowed">
                    <i class="fa-solid fa-lock mr-1"></i> Carica Certificato per Prenotare
                </button>`;
        } else if (isFull) {
            buttonHtml = `
                <button disabled class="w-full py-2.5 bg-gray-700 text-gray-400 text-xs uppercase rounded-xl cursor-not-allowed">
                    Sold Out
                </button>`;
        } else {
            buttonHtml = `
                <button onclick="toggleBooking('${lesson.id}', '${userId}', false)" class="w-full py-2.5 btn-gradient text-black font-black text-xs uppercase rounded-xl transition">
                    <i class="fa-solid fa-check mr-1"></i> Prenota Posto
                </button>`;
        }

        return `
            <div class="bg-brand-dark p-5 rounded-2xl border border-brand-border flex flex-col justify-between space-y-4">
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs uppercase font-bold text-brand-cyan">${formattedDate} - ${formattedTime}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${isFull ? 'bg-brand-pink/20 text-brand-pink border border-brand-pink/40' : 'bg-brand-lime/20 text-brand-lime border border-brand-lime/40'}">
                            ${bookedCount}/${capacity} Posti
                        </span>
                    </div>
                    <h4 class="text-base font-black text-white">${lesson.title || 'Zumba Fitness'}</h4>
                </div>

                <div>
                    ${buttonHtml}
                </div>
            </div>
        `;
    }).join('');
}

// Gestione Prenotazioni con invio Notifica integrato
window.toggleBooking = async function(lessonId, userId, isBooked) {
    const sb = window.supabaseClient;

    try {
        if (isBooked) {
            const { error } = await sb
                .from('bookings')
                .delete()
                .eq('lesson_id', lessonId)
                .eq('user_id', userId);
            
            if (error) throw error;

            await createNotification(userId, 'Prenotazione Annullata', 'Hai annullato la tua prenotazione per la lezione.', 'warning');
        } else {
            const { error } = await sb
                .from('bookings')
                .insert([{ lesson_id: lessonId, user_id: userId }]);
            
            if (error) throw error;

            await createNotification(userId, 'Prenotazione Confermata!', 'Il tuo posto alla lezione è stato riservato con successo.', 'success');
        }

        const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).single();
        await loadAvailableLessons(userId, profile);
        await loadNotifications(userId);
    } catch (err) {
        console.error("Errore prenotazione:", err);
        alert("Impossibile completare l'operazione: " + (err.message || err));
    }
};

// Gestione Badge Stato Certificato
function checkCertificateStatus(profile) {
    const badge = document.getElementById('cert-status-badge');
    if (!badge) return;

    const dataScad = profile.medical_certificate_expiration || profile.certificato_scadenza;

    if (!dataScad) {
        badge.className = "px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-black rounded-full uppercase";
        badge.innerText = "Mancante";
        return;
    }

    const today = new Date();
    const expDate = new Date(dataScad);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        badge.className = "px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-black rounded-full uppercase";
        badge.innerText = "Scaduto";
    } else if (diffDays <= 30) {
        badge.className = "px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-xs font-black rounded-full uppercase";
        badge.innerText = `In Scadenza (${diffDays} gg)`;
    } else {
        badge.className = "px-3 py-1 bg-brand-lime/20 text-brand-lime border border-brand-lime/40 text-xs font-black rounded-full uppercase";
        badge.innerText = "Valido";
    }
}

// Inizializza Evento Submit del Form
function initCertUploadForm(user) {
    const form = document.getElementById('form-upload-cert');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('cert-file-input');
        const expInput = document.getElementById('cert-expiration-date');
        const btn = document.getElementById('btn-upload-cert');

        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Seleziona un file da caricare.");
            return;
        }

        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/certificato_${Date.now()}.${fileExt}`;

        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Caricamento in corso...`;

        try {
            const sb = window.supabaseClient;

            const { error: uploadErr } = await sb.storage
                .from('certificates')
                .upload(filePath, file, { upsert: true });

            if (uploadErr) throw uploadErr;

            const { data: urlData } = sb.storage
                .from('certificates')
                .getPublicUrl(filePath);

            const publicUrl = urlData.publicUrl;

            const { error: updateErr } = await sb
                .from('profiles')
                .update({
                    medical_certificate_url: publicUrl,
                    medical_certificate_expiration: expInput.value
                })
                .eq('id', user.id);

            if (updateErr) throw updateErr;

            await createNotification(user.id, 'Certificato Caricato', 'Il tuo certificato medico è stato inviato correttamente.', 'success');

            alert("Certificato medico caricato con successo!");
            location.reload();
        } catch (err) {
            console.error("Errore upload certificato:", err);
            alert("Errore durante il caricamento: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Carica Certificato Medico`;
        }
    };
}

/* ==========================================================================
   SISTEMA DI NOTIFICHE
   ========================================================================== */

// Inizializza notifiche e interfaccia
async function initNotifications(userId) {
    const btn = document.getElementById('btn-notifications');
    const dropdown = document.getElementById('notif-dropdown');

    if (btn && dropdown) {
        btn.onclick = () => dropdown.classList.toggle('hidden');

        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    await loadNotifications(userId);
    subscribeToRealtimeNotifications(userId);
}

// Carica lista notifiche
async function loadNotifications(userId) {
    const sb = window.supabaseClient;
    const container = document.getElementById('notif-list-container');
    const badge = document.getElementById('notif-badge');
    if (!container) return;

    const { data: list, error } = await sb
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15);

    if (error || !list || list.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Nessuna notifica presente.</p>`;
        if (badge) badge.classList.add('hidden');
        return;
    }

    const unreadCount = list.filter(n => !n.is_read).length;

    if (badge) {
        if (unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    container.innerHTML = list.map(n => {
        let iconClass = 'fa-circle-info text-brand-cyan';
        if (n.type === 'warning') iconClass = 'fa-triangle-exclamation text-yellow-400';
        if (n.type === 'success') iconClass = 'fa-circle-check text-brand-lime';
        if (n.type === 'chat') iconClass = 'fa-comment text-brand-pink';

        const time = new Date(n.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const date = new Date(n.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

        return `
            <div class="p-3 rounded-xl border ${n.is_read ? 'bg-brand-card/40 border-brand-border/40' : 'bg-brand-card border-brand-cyan/40'} flex gap-3 items-start transition">
                <i class="fa-solid ${iconClass} mt-0.5 text-sm"></i>
                <div class="flex-grow space-y-0.5">
                    <div class="flex justify-between items-center">
                        <h5 class="text-xs font-bold text-white">${n.title}</h5>
                        <span class="text-[9px] text-gray-400">${date} ${time}</span>
                    </div>
                    <p class="text-[11px] text-gray-300 leading-snug">${n.message}</p>
                </div>
            </div>
        `;
    }).join('');
}

// Helper creazione notifica
async function createNotification(userId, title, message, type = 'info') {
    const sb = window.supabaseClient;
    await sb.from('notifications').insert([{
        user_id: userId,
        title: title,
        message: message,
        type: type
    }]);
}

// Segna tutte come lette
window.markAllNotificationsAsRead = async function() {
    if (!currentSessionData) return;
    const sb = window.supabaseClient;
    
    await sb
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentSessionData.user.id);

    await loadNotifications(currentSessionData.user.id);
};

// Controllo automatico notifiche per certificato in scadenza o scaduto
async function checkCertExpirationNotification(userId, profile) {
    const dataScad = profile.medical_certificate_expiration || profile.certificato_scadenza;
    if (!dataScad) return;

    const today = new Date();
    const expDate = new Date(dataScad);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        await createNotification(userId, 'Certificato Scaduto!', 'Il tuo certificato medico è scaduto. Caricane uno nuovo per sbloccare le prenotazioni.', 'warning');
    } else if (diffDays <= 15) {
        await createNotification(userId, 'Certificato in Scadenza', `Il tuo certificato medico scadrà tra ${diffDays} giorni. Ricordati di rinnovarlo!`, 'warning');
    }
}

// Realtime listener
function subscribeToRealtimeNotifications(userId) {
    const sb = window.supabaseClient;
    sb.channel('user-notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
        }, () => {
            loadNotifications(userId);
        })
        .subscribe();
}
