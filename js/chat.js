// Variabili globali per la chat
window.currentChatType = 'group';
window.selectedRecipientId = null;
window.currentUserProfile = null;

function getChatSupabase() {
    if (typeof window.getSupabase === 'function') {
        return window.getSupabase();
    }
    return window.supabaseClient || window.supabase;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function initChat(profile) {
    window.currentUserProfile = profile;
    setupChatListeners();
    await loadChatMessages();
}

function setupChatListeners() {
    const chatTypeSelect = document.getElementById('chat-type-select');
    const studentSelectWrapper = document.getElementById('student-selector-wrapper');
    const studentSelect = document.getElementById('student-private-select');
    const chatForm = document.getElementById('chat-form');

    if (chatTypeSelect) {
        chatTypeSelect.onchange = async (e) => {
            window.currentChatType = e.target.value;

            if (window.currentChatType === 'private') {
                if (window.currentUserProfile && window.currentUserProfile.is_admin) {
                    if (studentSelectWrapper) studentSelectWrapper.classList.remove('hidden');
                    await loadStudentsDropdown();
                }
            } else {
                if (studentSelectWrapper) studentSelectWrapper.classList.add('hidden');
                window.selectedRecipientId = null;
            }
            await loadChatMessages();
        };
    }

    if (studentSelect) {
        studentSelect.onchange = async (e) => {
            window.selectedRecipientId = e.target.value || null;
            await loadChatMessages();
        };
    }

    if (chatForm) {
        chatForm.onsubmit = async (e) => {
            e.preventDefault();
            await sendChatMessage();
        };
    }
}

async function loadStudentsDropdown() {
    const select = document.getElementById('student-private-select');
    if (!select) return;

    try {
        const sb = getChatSupabase();
        const { data: students, error } = await sb
            .from('profiles')
            .select('id, nome, cognome')
            .eq('is_admin', false)
            .order('nome', { ascending: true });

        if (error) throw error;

        let options = '<option value="">-- Seleziona un\'allieva --</option>';
        if (students) {
            options += students.map(s => `<option value="${s.id}">${escapeHtml(s.nome)} ${escapeHtml(s.cognome)}</option>`).join('');
        }
        select.innerHTML = options;
    } catch (err) {
        console.error("Errore caricamento lista allieve:", err);
    }
}

async function loadChatMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    if (!window.currentUserProfile) return;

    const sb = getChatSupabase();

    if (window.currentChatType === 'private' && window.currentUserProfile?.is_admin && !window.selectedRecipientId) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-6">Seleziona un'allieva dal menu in alto per vedere la conversazione.</p>`;
        return;
    }

    try {
        // Query diretta senza join relazionale per prevenire l'errore 400
        let query = sb.from('messages').select('*');

        if (window.currentChatType === 'group') {
            query = query.eq('is_private', false);
        } else {
            query = query.eq('is_private', true);

            const myId = window.currentUserProfile.id;

            if (window.currentUserProfile?.is_admin) {
                const otherId = window.selectedRecipientId;
                query = query.or(`and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`);
            } else {
                query = query.or(`sender_id.eq.${myId},recipient_id.eq.${myId}`);
            }
        }

        const { data: messages, error } = await query.order('created_at', { ascending: true });

        if (error) {
            console.error("Errore Supabase durante il recupero dei messaggi:", error);
            throw error;
        }

        // Recuperiamo i profili dei mittenti separatamente se ci sono messaggi
        let sendersMap = {};
        if (messages && messages.length > 0) {
            const senderIds = [...new Set(messages.map(m => m.sender_id))];
            const { data: profiles } = await sb.from('profiles').select('id, nome, cognome').in('id', senderIds);
            if (profiles) {
                profiles.forEach(p => { sendersMap[p.id] = p; });
            }
        }

        renderMessages(messages, sendersMap);

    } catch (err) {
        console.error("Errore recupero messaggi:", err);
        container.innerHTML = `<p class="text-xs text-brand-pink text-center py-6">Errore nel caricamento dei messaggi.</p>`;
    }
}

function renderMessages(messages, sendersMap = {}) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-6">Nessun messaggio presente in questa chat.</p>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender_id === window.currentUserProfile?.id;
        const profile = sendersMap[msg.sender_id];
        const senderName = isMe ? 'Tu' : (profile ? `${profile.nome} ${profile.cognome}` : 'Utente');
        const time = new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} my-1.5">
                <span class="text-[10px] text-gray-400 mb-0.5 px-1">${escapeHtml(senderName)} - ${time}</span>
                <div class="max-w-[80%] px-3.5 py-2 rounded-2xl text-xs font-medium ${
                    isMe 
                    ? 'bg-brand-cyan text-black rounded-tr-none' 
                    : 'bg-brand-card text-white border border-brand-border rounded-tl-none'
                }">
                    ${escapeHtml(msg.content)}
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input?.value.trim();
    if (!text) return;

    if (!window.currentUserProfile) {
        alert("Profilo utente non caricato. Ricarica la pagina.");
        return;
    }

    if (window.currentChatType === 'private' && window.currentUserProfile?.is_admin && !window.selectedRecipientId) {
        alert("Seleziona prima un'allieva a cui inviare il messaggio!");
        return;
    }

    try {
        const sb = getChatSupabase();

        const payload = {
            sender_id: window.currentUserProfile.id,
            content: text,
            is_private: (window.currentChatType === 'private'),
            recipient_id: (window.currentChatType === 'private' && window.currentUserProfile?.is_admin) ? window.selectedRecipientId : null
        };

        const { error: insertError } = await sb.from('messages').insert([payload]);

        if (insertError) {
            console.error("Errore durante l'inserimento del messaggio:", insertError);
            throw insertError;
        }

        input.value = '';
        await loadChatMessages();

    } catch (err) {
        alert("Errore nell'invio del messaggio: " + (err.message || err));
    }
}
