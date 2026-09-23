let currentChatType = 'group';
let selectedRecipientId = null;
let currentUserProfile = null;

async function initChat(profile) {
    currentUserProfile = profile;
    setupChatListeners();
    
    if (profile.is_admin) {
        await populateStudentsDropdown();
    }
    
    await loadChatMessages();
}

// Popola la tendina con l'elenco delle allieve per l'admin
async function populateStudentsDropdown() {
    const studentSelect = document.getElementById('student-private-select');
    if (!studentSelect) return;

    const sb = window.supabaseClient || window.supabase;
    const { data: students, error } = await sb
        .from('profiles')
        .select('id, nome, cognome')
        .eq('is_admin', false)
        .order('nome', { ascending: true });

    if (error) {
        console.error("Errore caricamento lista allieve per chat:", error);
        return;
    }

    studentSelect.innerHTML = '<option value="">-- Seleziona un\'allieva --</option>' +
        students.map(s => `<option value="${s.id}">${escapeHtml(s.nome)} ${escapeHtml(s.cognome)}</option>`).join('');
}

function setupChatListeners() {
    const chatTypeSelect = document.getElementById('chat-type-select');
    const studentWrapper = document.getElementById('student-selector-wrapper');
    const studentSelect = document.getElementById('student-private-select');
    const chatForm = document.getElementById('chat-form');

    // Cambio tipo chat (Gruppo / Privata)
    if (chatTypeSelect) {
        chatTypeSelect.addEventListener('change', async (e) => {
            currentChatType = e.target.value;
            
            if (currentChatType === 'private') {
                if (currentUserProfile.is_admin) {
                    studentWrapper?.classList.remove('hidden');
                } else {
                    studentWrapper?.classList.add('hidden');
                }
            } else {
                studentWrapper?.classList.add('hidden');
                selectedRecipientId = null;
            }
            
            await loadChatMessages();
        });
    }

    // Selezione dell'allieva dalla tendina
    if (studentSelect) {
        studentSelect.addEventListener('change', async (e) => {
            selectedRecipientId = e.target.value || null;
            await loadChatMessages();
        });
    }

    // Invio messaggio
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await sendMessage();
        });
    }
}

async function loadChatMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const sb = window.supabaseClient || window.supabase;

    // Se è una chat privata admin ma non è stata ancora scelta l'allieva
    if (currentChatType === 'private' && currentUserProfile.is_admin && !selectedRecipientId) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Seleziona un'allieva dal menu in alto per visualizzare la conversazione.</p>`;
        return;
    }

    let query = sb.from('messages').select('*, profiles:sender_id(nome, cognome, is_admin)');

    if (currentChatType === 'group') {
        query = query.eq('is_private', false);
    } else {
        // Chat privata
        query = query.eq('is_private', true);
        if (currentUserProfile.is_admin) {
            // L'admin vede i messaggi scambiati tra sé e l'allieva selezionata
            query = query.or(`and(sender_id.eq.${currentUserProfile.id},recipient_id.eq.${selectedRecipientId}),and(sender_id.eq.${selectedRecipientId},recipient_id.eq.${currentUserProfile.id})`);
        } else {
            // L'allieva vede i messaggi tra sé e gli admin
            query = query.or(`sender_id.eq.${currentUserProfile.id},recipient_id.eq.${currentUserProfile.id}`);
        }
    }

    const { data: messages, error } = await query.order('created_at', { ascending: true });

    if (error) {
        console.error("Errore caricamento messaggi:", error);
        container.innerHTML = `<p class="text-xs text-brand-pink text-center py-4">Errore nel caricamento dei messaggi.</p>`;
        return;
    }

    renderMessages(messages);
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input?.value.trim();
    if (!text) return;

    if (currentChatType === 'private' && currentUserProfile.is_admin && !selectedRecipientId) {
        alert("Seleziona prima un'allieva a cui inviare il messaggio!");
        return;
    }

    const sb = window.supabaseClient || window.supabase;
    
    const messageData = {
        sender_id: currentUserProfile.id,
        content: text,
        is_private: (currentChatType === 'private'),
        recipient_id: (currentChatType === 'private' && currentUserProfile.is_admin) ? selectedRecipientId : null
    };

    const { error } = await sb.from('messages').insert([messageData]);

    if (error) {
        alert("Errore nell'invio del messaggio: " + error.message);
    } else {
        input.value = '';
        await loadChatMessages();
    }
}
