let currentChatType = 'group'; // 'group' oppure 'private'
let currentUser = null;
let instructorId = null; // Verrà recuperato automaticamente

async function initChat(userProfile) {
    currentUser = userProfile;
    const sb = window.supabaseClient;

    // Individua l'ID dell'istruttore (il profilo con is_admin = true)
    if (currentUser.is_admin) {
        instructorId = currentUser.id;
    } else {
        const { data: admin } = await sb.from('profiles').select('id').eq('is_admin', true).single();
        if (admin) instructorId = admin.id;
    }

    // Gestione cambio canale (Gruppo / Privato)
    const selectEl = document.getElementById('chat-type-select');
    if (selectEl) {
        selectEl.addEventListener('change', (e) => {
            currentChatType = e.target.value;
            loadMessages();
        });
    }

    // Gestione invio messaggio
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleSendMessage);
    }

    // Caricamento iniziale messaggi
    await loadMessages();

    // Sottoscrizione ai messaggi IN TEMPO REALE (Realtime)
    sb.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            appendSingleMessage(payload.new);
        })
        .subscribe();
}

/* Carica la cronologia messaggi
async function loadMessages() {
    const sb = window.supabaseClient;
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    container.innerHTML = `<p class="text-xs text-center text-gray-500 py-4">Caricamento messaggi...</p>`;

    let query = sb.from('messages').select('*, profiles:sender_id(nome, cognome, is_admin)').order('created_at', { ascending: true });

    if (currentChatType === 'group') {
        query = query.is('receiver_id', null);
    } else {
        // Messaggi privati tra l'allieva corrente e l'istruttore
        query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${instructorId}),and(sender_id.eq.${instructorId},receiver_id.eq.${currentUser.id})`);
    }

    const { data: messages, error } = await query;

    if (error) {
        container.innerHTML = `<p class="text-xs text-brand-pink text-center">Errore nel caricamento dei messaggi.</p>`;
        return;
    }

    container.innerHTML = '';
    if (messages.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Nessun messaggio presente in questo canale.</p>`;
        return;
    }

    messages.forEach(msg => appendSingleMessage(msg));
    container.scrollTop = container.scrollHeight;
}*/

async function loadMessages() {
    const sb = window.supabaseClient;
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    container.innerHTML = `<p class="text-xs text-center text-gray-500 py-4">Caricamento messaggi...</p>`;

    // Recupera messaggi includendo i dati del mittente dalla tabella profiles
    let query = sb.from('messages')
        .select('*, profiles:sender_id(nome, cognome, is_admin)')
        .order('created_at', { ascending: true });

    if (currentChatType === 'group') {
        // Messaggi di gruppo (receiver_id è NULL)
        query = query.is('receiver_id', null);
    } else {
        // Messaggi privati:
        // Se chi guarda è l'istruttore, carica i messaggi scambiati tra lui e qualsiasi allieva
        // Se è un'allieva, carica i messaggi tra lei e l'istruttore
        query = query.or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
    }

    const { data: messages, error } = await query;

    if (error) {
        console.error("Errore caricamento messaggi:", error);
        container.innerHTML = `<p class="text-xs text-brand-pink text-center">Errore nel caricamento dei messaggi.</p>`;
        return;
    }

    container.innerHTML = '';
    if (!messages || messages.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Nessun messaggio presente in questo canale.</p>`;
        return;
    }

    messages.forEach(msg => appendSingleMessage(msg));
    container.scrollTop = container.scrollHeight;
}

// Render del singolo messaggio
function appendSingleMessage(msg) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    // Filtra messaggi realtime non pertinenti alla vista attiva
    if (currentChatType === 'group' && msg.receiver_id !== null) return;
    if (currentChatType === 'private' && msg.receiver_id === null) return;

    const isMine = msg.sender_id === currentUser.id;
    const senderName = msg.profiles ? `${msg.profiles.nome} ${msg.profiles.is_admin ? '(Istruttore)' : ''}` : 'Utente';
    const time = new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    const msgHTML = `
        <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'}">
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

// Invio nuovo messaggio
async function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    const sb = window.supabaseClient;
    const receiverId = (currentChatType === 'private') ? instructorId : null;

    input.value = '';

    const { error } = await sb.from('messages').insert([{
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content: content
    }]);

    if (error) {
        alert("Errore nell'invio del messaggio: " + error.message);
    }
}
