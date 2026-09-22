let currentChatType = 'group'; // 'group' oppure 'private'
let currentUser = null;
let instructorId = null;
let selectedStudentId = null;
let isChatInitialized = false;

// Funzione principale di inizializzazione
async function initChat(userProfile) {
    if (isChatInitialized) return;
    
    currentUser = userProfile;
    const sb = window.supabaseClient;
    if (!sb) return;

    // Recupera l'ID dell'istruttore (profilo con is_admin = true)
    if (currentUser.is_admin) {
        instructorId = currentUser.id;
    } else {
        const { data: admin, error } = await sb.from('profiles').select('id').eq('is_admin', true).maybeSingle();
        if (admin) {
            instructorId = admin.id;
        } else {
            console.error("Istruttore non trovato nel database.");
        }
    }

    // Registra l'evento sul menu a tendina della chat
    const selectEl = document.getElementById('chat-type-select');
    if (selectEl) {
        selectEl.value = currentChatType;
        selectEl.onchange = async (e) => {
            currentChatType = e.target.value;
            
            if (currentUser.is_admin && currentChatType === 'private') {
                await renderStudentSelector();
            } else {
                hideStudentSelector();
            }

            await loadMessages();
        };
    }

    // Registra l'evento sul form d'invio
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.onsubmit = handleSendMessage;
    }

    // Carica la cronologia
    await loadMessages();

    // Sottoscrizione Realtime Supabase
    sb.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            appendSingleMessage(payload.new);
        })
        .subscribe();

    isChatInitialized = true;
}

// Genera il menu a tendina per l'istruttore in chat privata
async function renderStudentSelector() {
    const sb = window.supabaseClient;
    const chatContainer = document.getElementById('chat-messages-container');
    if (!chatContainer) return;

    let selectorContainer = document.getElementById('student-selector-wrapper');
    if (!selectorContainer) {
        selectorContainer = document.createElement('div');
        selectorContainer.id = 'student-selector-wrapper';
        selectorContainer.className = 'mb-3 p-2 bg-brand-card rounded-xl border border-brand-border flex items-center justify-between gap-2';
        chatContainer.parentNode.insertBefore(selectorContainer, chatContainer);
    }

    const { data: students, error } = await sb
        .from('profiles')
        .select('id, nome, cognome')
        .eq('is_admin', false)
        .order('nome', { ascending: true });

    if (error || !students || students.length === 0) {
        selectorContainer.innerHTML = `<span class="text-xs text-gray-400">Nessuna allieva trovata.</span>`;
        return;
    }

    if (!selectedStudentId && students.length > 0) {
        selectedStudentId = students[0].id;
    }

    let optionsHTML = '';
    for (let i = 0; i < students.length; i++) {
        const s = students[i];
        const isSelected = s.id === selectedStudentId ? 'selected' : '';
        const nomeCompleto = (s.nome || '') + ' ' + (s.cognome || 'Allieva');
        optionsHTML += `<option value="${s.id}" ${isSelected}>${nomeCompleto}</option>`;
    }

    selectorContainer.innerHTML = `
        <label class="text-xs font-bold text-brand-cyan uppercase flex items-center gap-1">
            <i class="fa-solid fa-user"></i> Chat con:
        </label>
        <select id="student-chat-select" class="flex-grow bg-brand-dark border border-brand-border text-white text-xs rounded-lg p-2 focus:outline-none focus:border-brand-cyan">
            ${optionsHTML}
        </select>
    `;

    const studentSelect = document.getElementById('student-chat-select');
    if (studentSelect) {
        studentSelect.onchange = (e) => {
            selectedStudentId = e.target.value;
            loadMessages();
        };
    }
}

function hideStudentSelector() {
    const selectorContainer = document.getElementById('student-selector-wrapper');
    if (selectorContainer) {
        selectorContainer.remove();
    }
}

// Caricamento cronologia messaggi
async function loadMessages() {
    const sb = window.supabaseClient;
    const container = document.getElementById('chat-messages-container');
    if (!container || !currentUser) return;

    container.innerHTML = `<p class="text-xs text-center text-gray-500 py-4">Caricamento messaggi...</p>`;

    let query = sb.from('messages')
        .select('*, profiles:sender_id(nome, cognome, is_admin)')
        .order('created_at', { ascending: true });

    if (currentChatType === 'group') {
        query = query.is('receiver_id', null);
    } else {
        if (currentUser.is_admin) {
            if (!selectedStudentId) {
                container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Seleziona un'allieva per vedere la chat.</p>`;
                return;
            }
            query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedStudentId}),and(sender_id.eq.${selectedStudentId},receiver_id.eq.${currentUser.id})`);
        } else {
            if (!instructorId) {
                container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Istruttore non disponibile.</p>`;
                return;
            }
            query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${instructorId}),and(sender_id.eq.${instructorId},receiver_id.eq.${currentUser.id})`);
        }
    }

    const { data: messages, error } = await query;

    if (error) {
        console.error("Errore lettura messaggi:", error);
        container.innerHTML = `<p class="text-xs text-brand-pink text-center">Errore caricamento messaggi.</p>`;
        return;
    }

    container.innerHTML = '';
    if (!messages || messages.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Nessun messaggio presente in questa conversazione.</p>`;
        return;
    }

    messages.forEach(msg => appendSingleMessage(msg));
    container.scrollTop = container.scrollHeight;
}

// Rendering del messaggio
function appendSingleMessage(msg) {
    const container = document.getElementById('chat-messages-container');
    if (!container || !currentUser) return;

    if (currentChatType === 'group' && msg.receiver_id !== null) return;
    if (currentChatType === 'private') {
        if (msg.receiver_id === null) return;
        const targetId = currentUser.is_admin ? selectedStudentId : instructorId;
        const isRelevant = (msg.sender_id === currentUser.id && msg.receiver_id === targetId) ||
                           (msg.sender_id === targetId && msg.receiver_id === currentUser.id);
        if (!isRelevant) return;
    }

    const isMine = msg.sender_id === currentUser.id;
    const senderName = msg.profiles ? `${msg.profiles.nome} ${msg.profiles.is_admin ? '(Istruttore)' : ''}` : 'Utente';
    const time = new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    const msgHTML = `
        <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'} my-1.5">
            <span class="text-[10px] text-gray-400 mb-0.5 px-1">${isMine ? 'Tu' : senderName} • ${time}</span>
            <div class="max-w-[80%] px-3.5 py-2 rounded-2xl text-xs font-medium ${
                isMine 
                    ? 'bg-brand-cyan text-black rounded-tr-none' 
                    : 'bg-brand-card text-white border border-brand-border rounded-tl-none'
            }">
                ${msg.content}
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', msgHTML);
    container.scrollTop = container.scrollHeight;
}

// Invio messaggio e Creazione Notifiche
async function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || !currentUser) return;

    const sb = window.supabaseClient;
    let receiverId = null;

    if (currentChatType === 'private') {
        if (currentUser.is_admin) {
            if (!selectedStudentId) {
                alert("Seleziona un'allieva a cui rispondere!");
                return;
            }
            receiverId = selectedStudentId;
        } else {
            receiverId = instructorId;
        }
    }

    input.value = '';

    // 1. Salvataggio Messaggio
    const { data: newMsg, error } = await sb.from('messages').insert([{
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content: content
    }]).select().single();

    if (error) {
        alert("Errore invio messaggio: " + error.message);
        return;
    }

    // 2. Generazione Notifiche Automatiche
    const previewContent = content.length > 50 ? content.substring(0, 50) + '...' : content;
    const senderDisplayName = currentUser.is_admin ? 'Istruttore' : (currentUser.nome || 'Un\'allieva');

    if (currentChatType === 'private') {
        // Chat Privata: notifica il destinatario (Istruttore o Allieva)
        await sb.from('notifications').insert([{
            user_id: receiverId,
            title: `💬 Messaggio Privato da ${senderDisplayName}`,
            message: previewContent,
            type: 'chat'
        }]);
    } else if (currentChatType === 'group') {
        // Chat di Gruppo: notifica tutti gli altri utenti della piattaforma
        const { data: recipientUsers } = await sb.from('profiles').select('id').neq('id', currentUser.id);

        if (recipientUsers && recipientUsers.length > 0) {
            const notificationsToInsert = recipientUsers.map(u => ({
                user_id: u.id,
                title: currentUser.is_admin ? '📢 Avviso Community dall\'Istruttore' : `📢 Nuovo messaggio di ${senderDisplayName}`,
                message: previewContent,
                type: 'chat'
            }));

            await sb.from('notifications').insert(notificationsToInsert);
        }
    }
}

// Inizializzazione automatica al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const checkSupabase = setInterval(async () => {
        attempts++;
        if (window.supabaseClient && window.supabaseClient.auth) {
            clearInterval(checkSupabase);
            try {
                const sb = window.supabaseClient;
                const { data: { user } } = await sb.auth.getUser();

                if (user) {
                    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
                    if (profile) {
                        await initChat(profile);
                    }
                }
            } catch (err) {
                console.error("Errore inizializzazione chat:", err);
            }
        } else if (attempts > 20) {
            clearInterval(checkSupabase);
            console.error("Supabase Client non pronto.");
        }
    }, 500);
});
