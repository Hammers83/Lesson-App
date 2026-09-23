// Variable globali per la chat
let currentChatType = 'group';
let selectedRecipientId = null;
let currentUserProfile = null;

const getSupabase = () => window.supabaseClient || window.supabase;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Inizializzazione chiamata da admin.js e student.js
async function initChat(profile) {
    currentUserProfile = profile;
    setupChatListeners();
    await loadChatMessages();
}

// Gestione eventi chat
function setupChatListeners() {
    const chatTypeSelect = document.getElementById('chat-type-select');
    const studentSelectWrapper = document.getElementById('student-selector-wrapper');
    const studentSelect = document.getElementById('student-private-select');
    const chatForm = document.getElementById('chat-form');

    if (chatTypeSelect) {
        // Quando l'utente cambia tipo chat
        chatTypeSelect.onclick = null; // pulizia
        chatTypeSelect.onchange = async (e) => {
            currentChatType = e.target.value;

            if (currentChatType === 'private') {
                if (currentUserProfile && currentUserProfile.is_admin) {
                    // Mostra la tendina se siamo admin
                    if (studentSelectWrapper) studentSelectWrapper.classList.remove('hidden');
                    await loadStudentsDropdown();
                }
            } else {
                if (studentSelectWrapper) studentSelectWrapper.classList.add('hidden');
                selectedRecipientId = null;
            }
            await loadChatMessages();
        };
    }

    if (studentSelect) {
        studentSelect.onchange = async (e) => {
            selectedRecipientId = e.target.value || null;
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

// Carica le allieve nella tendina (solo per Admin)
async function loadStudentsDropdown() {
    const select = document.getElementById('student-private-select');
    if (!select) return;

    const sb = getSupabase();
    const { data: students, error } = await sb
        .from('profiles')
        .select('id, nome, cognome')
        .eq('is_admin', false)
        .order('nome', { ascending: true });

    if (error) {
        console.error("Errore caricamento lista allieve:", error);
        return;
    }

    let options = '<option value="">-- Seleziona un\'allieva --</option>';
    if (students) {
        options += students.map(s => `<option value="${s.id}">${escapeHtml(s.nome)} ${escapeHtml(s.cognome)}</option>`).join('');
    }
    select.innerHTML = options;
}

// Carica i messaggi
async function loadChatMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const sb = getSupabase();

    // Se admin è in privato ma non ha selezionato l'allieva
    if (currentChatType === 'private' && currentUserProfile?.is_admin && !selectedRecipientId) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-6">Seleziona un'allieva dal menu a tendina per vedere la conversazione.</p>`;
        return;
    }

    try {
        let query = sb.from('messages').select('*, profiles:sender_id(nome, cognome, is_admin)');

        if (currentChatType === 'group') {
            query = query.eq('is_private', false);
        } else {
            query = query.eq('is_private', true);
            if (currentUserProfile?.is_admin) {
                query = query.or(`and(sender_id.eq.${currentUserProfile.id},recipient_id.eq.${selectedRecipientId}),and(sender_id.eq.${selectedRecipientId},recipient_id.eq.${currentUserProfile.id})`);
            } else {
                query = query.or(`sender_id.eq.${currentUserProfile.id},recipient_id.eq.${currentUserProfile.id}`);
            }
        }

        const { data: messages, error } = await query.order('created_at', { ascending: true });

        if (error) throw error;
        renderMessages(messages);

    } catch (err) {
        console.error("Errore chat:", err);
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-6">Nessun messaggio presente.</p>`;
    }
}

// Render dei messaggi a schermo
function renderMessages(messages) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-6">Nessun messaggio presente.</p>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender_id === currentUserProfile?.id;
        const senderName = isMe ? 'Tu' : (msg.profiles ? `${msg.profiles.nome} ${msg.profiles.cognome}` : 'Utente');
        const time = new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} my-1">
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

// Invio messaggio
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input?.value.trim();
    if (!text) return;

    if (currentChatType === 'private' && currentUserProfile?.is_admin && !selectedRecipientId) {
        alert("Seleziona prima un'allieva a cui inviare il messaggio!");
        return;
    }

    const sb = getSupabase();

    const payload = {
        sender_id: currentUserProfile.id,
        content: text,
        is_private: (currentChatType === 'private'),
        recipient_id: (currentChatType === 'private' && currentUserProfile?.is_admin) ? selectedRecipientId : null
    };

    const { error } = await sb.from('messages').insert([payload]);

    if (error) {
        alert("Errore nell'invio del messaggio: " + error.message);
    } else {
        input.value = '';
        await loadChatMessages();
    }
}
