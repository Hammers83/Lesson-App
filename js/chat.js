// Variable per gestire la selezione dell'allieva (Admin)
window.selectedRecipientId = null;

// Utility per leggere l'istanza Supabase già presente nel tuo progetto
function getSb() {
    return window.supabaseClient || window.supabase;
}

// Inizializzazione della chat (chiamata da admin.js e student.js)
async function initChat(profile) {
    window.currentUserProfile = profile;
    setupChatListeners();
    await loadChatMessages();
}

// Gestione degli eventi di input e cambi menu
function setupChatListeners() {
    const chatTypeSelect = document.getElementById('chat-type-select');
    const studentWrapper = document.getElementById('student-selector-wrapper');
    const studentSelect = document.getElementById('student-private-select');
    const chatForm = document.getElementById('chat-form');

    // Cambiamento tipo chat (Gruppo / Privata)
    if (chatTypeSelect) {
        chatTypeSelect.onchange = async (e) => {
            const isPrivate = (e.target.value === 'private');

            if (isPrivate && window.currentUserProfile?.is_admin) {
                if (studentWrapper) studentWrapper.classList.remove('hidden');
                await loadStudentsDropdown();
            } else {
                if (studentWrapper) studentWrapper.classList.add('hidden');
                window.selectedRecipientId = null;
            }
            await loadChatMessages();
        };
    }

    // Selezione allieva dalla tendina
    if (studentSelect) {
        studentSelect.onchange = async (e) => {
            window.selectedRecipientId = e.target.value || null;
            await loadChatMessages();
        };
    }

    // Invio del form messaggi
    if (chatForm) {
        chatForm.onsubmit = async (e) => {
            e.preventDefault();
            await sendChatMessage();
        };
    }
}

// Carica l'elenco delle allieve nella tendina (solo per Admin)
async function loadStudentsDropdown() {
    const select = document.getElementById('student-private-select');
    if (!select) return;

    try {
        const sb = getSb();
        const { data: students } = await sb
            .from('profiles')
            .select('id, nome, cognome')
            .eq('is_admin', false)
            .order('nome', { ascending: true });

        let options = '<option value="">-- Seleziona un\'allieva --</option>';
        if (students && students.length > 0) {
            options += students.map(s => `<option value="${s.id}">${s.nome || ''} ${s.cognome || ''}</option>`).join('');
        }
        select.innerHTML = options;
    } catch (err) {
        console.error("Errore caricamento allieve:", err);
    }
}

// Caricamento dei messaggi (Query semplice senza JOIN o costrutti SQL complessi)
async function loadChatMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container || !window.currentUserProfile) return;

    const chatTypeSelect = document.getElementById('chat-type-select');
    const isPrivate = chatTypeSelect ? (chatTypeSelect.value === 'private') : false;

    // Se admin è in chat privata ma non ha ancora scelto l'allieva
    if (isPrivate && window.currentUserProfile.is_admin && !window.selectedRecipientId) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-6">Seleziona un'allieva dal menu in alto per vedere la conversazione.</p>`;
        return;
    }

    try {
        const sb = getSb();
        let query = sb.from('messages').select('*');

        if (!isPrivate) {
            // Chat di gruppo
            query = query.eq('is_private', false);
        } else {
            // Chat privata
            query = query.eq('is_private', true);

            if (window.currentUserProfile.is_admin) {
                // Admin vede solo i messaggi scambiati con l'allieva selezionata
                const myId = window.currentUserProfile.id;
                const studentId = window.selectedRecipientId;
                query = query.or(`and(sender_id.eq.${myId},recipient_id.eq.${studentId}),and(sender_id.eq.${studentId},recipient_id.eq.${myId})`);
            } else {
                // Allieva vede tutti i suoi messaggi privati
                const myId = window.currentUserProfile.id;
                query = query.or(`sender_id.eq.${myId},recipient_id.eq.${myId}`);
            }
        }

        const { data: messages, error } = await query.order('created_at', { ascending: true });

        if (error) throw error;

        // Recupero rapido dei nomi mittenti senza JOIN
        let profilesMap = {};
        if (messages && messages.length > 0) {
            const senderIds = [...new Set(messages.map(m => m.sender_id))];
            const { data: profiles } = await sb.from('profiles').select('id, nome, cognome').in('id', senderIds);
            if (profiles) {
                profiles.forEach(p => { profilesMap[p.id] = p; });
            }
        }

        renderMessages(messages, profilesMap);

    } catch (err) {
        console.error("Errore lettura messaggi:", err);
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-6">Impossibile caricare i messaggi.</p>`;
    }
}

// Rendering a schermo
function renderMessages(messages, profilesMap) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-6">Nessun messaggio presente.</p>`;
        return;
    }

    const myId = window.currentUserProfile?.id;

    container.innerHTML = messages.map(msg => {
        const isMe = (msg.sender_id === myId);
        const profile = profilesMap[msg.sender_id];
        const senderName = isMe ? 'Tu' : (profile ? `${profile.nome || ''} ${profile.cognome || ''}`.trim() : 'Utente');
        const time = new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} my-1.5">
                <span class="text-[10px] text-gray-400 mb-0.5 px-1">${senderName} - ${time}</span>
                <div class="max-w-[80%] px-3.5 py-2 rounded-2xl text-xs font-medium ${
                    isMe 
                    ? 'bg-brand-cyan text-black rounded-tr-none' 
                    : 'bg-brand-card text-white border border-brand-border rounded-tl-none'
                }">
                    ${msg.content}
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

// Invio messaggio
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input?.value.trim();
    if (!text) return;

    const chatTypeSelect = document.getElementById('chat-type-select');
    const isPrivate = chatTypeSelect ? (chatTypeSelect.value === 'private') : false;

    if (isPrivate && window.currentUserProfile?.is_admin && !window.selectedRecipientId) {
        alert("Seleziona un'allieva dal menu a tendina prima di inviare un messaggio privato.");
        return;
    }

    try {
        const sb = getSb();
        const payload = {
            sender_id: window.currentUserProfile.id,
            content: text,
            is_private: isPrivate,
            recipient_id: (isPrivate && window.currentUserProfile?.is_admin) ? window.selectedRecipientId : null
        };

        const { error } = await sb.from('messages').insert([payload]);

        if (error) throw error;

        input.value = '';
        await loadChatMessages();

    } catch (err) {
        alert("Errore durante l'invio del messaggio: " + (err.message || "Errore sconosciuto"));
    }
}
