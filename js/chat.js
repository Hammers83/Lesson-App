let currentChatType = 'group'; // 'group' oppure 'private'
let currentUser = null;
let instructorId = null; // Verrà recuperato automaticamente
let selectedStudentId = null; // Usato dall'Istruttore per gestire la chat 1-a-1 con un'allieva specifica

async function initChat(userProfile) {
    currentUser = userProfile;
    const sb = window.supabaseClient;

    // Individua l'ID dell'istruttore
    if (currentUser.is_admin) {
        instructorId = currentUser.id;
    } else {
        const { data: admin } = await sb.from('profiles').select('id').eq('is_admin', true).single();
        if (admin) instructorId = admin.id;
    }

    // Gestione cambio canale (Gruppo / Privato)
    const selectEl = document.getElementById('chat-type-select');
    if (selectEl) {
        selectEl.addEventListener('change', async (e) => {
            currentChatType = e.target.value;
            
            // Se l'istruttore passa in chat privata, carica il selettore delle allieve
            if (currentUser.is_admin && currentChatType === 'private') {
                await renderStudentSelector();
            } else {
                hideStudentSelector();
            }

            await loadMessages();
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

// Crea e mostra dinamicamente il menu di selezione allieve per l'istruttore
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

    // Recupera l'elenco delle allieve
    const { data: students, error } = await sb
        .from('profiles')
        .select('id, nome, cognome')
        .eq('is_admin', false)
        .order('nome', { ascending: true });

    if (error || !students || students.length === 0) {
        selectorContainer.innerHTML = `<span class="text-xs text-gray-400">Nessuna allieva trovata.</span>`;
        return;
    }

    // Se non è ancora selezionata un'allieva, seleziona la prima per default
    if (!selectedStudentId && students.length > 0) {
        selectedStudentId = students[0].id;
    }

    selectorContainer.innerHTML = `
        <label class="text-xs font-bold text-brand-cyan uppercase flex items-center gap-1">
            <i class="fa-solid fa-user"></i> Chat con:
        </label>
        <select id="student-chat-select" class="flex-grow bg-brand-dark border border-brand-border text-white text-xs rounded-lg p-2 focus:outline-none focus:border-brand-cyan">
            ${students.map(s => `
                <option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>
                    ${s.nome \vert{}\vert{} ''}${s.cognome || 'Allieva'}
                </option>
            `).join('')}
        </select>
    `;

    document.getElementById('student-chat-select')?.addEventListener('change', (e) => {
        selectedStudentId = e.target.value;
        loadMessages();
    });
}

// Nasconde il selettore se si torna alla chat di gruppo
function hideStudentSelector() {
    const selectorContainer = document.getElementById('student-selector-wrapper');
    if (selectorContainer) {
        selectorContainer.remove();
    }
}

// Carica la cronologia messaggi
async function loadMessages() {
    const sb = window.supabaseClient;
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    container.innerHTML = `<p class="text-xs text-center text-gray-500 py-4">Caricamento messaggi...</p>`;

    let query = sb.from('messages')
        .select('*, profiles:sender_id(nome, cognome, is_admin)')
        .order('created_at', { ascending: true });

    if (currentChatType === 'group') {
        // Messaggi di gruppo (receiver_id è NULL)
        query = query.is('receiver_id', null);
    } else {
        // Messaggi privati:
        if (currentUser.is_admin) {
            // ISTRUTTORE: Carica solo i messaggi scambiati con l'allieva selezionata
            if (!selectedStudentId) {
                container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Seleziona un'allieva per vedere la chat.</p>`;
                return;
            }
            query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedStudentId}),and(sender_id.eq.${selectedStudentId},receiver_id.eq.${currentUser.id})`);
        } else {
            // ALLIEVA: Carica i messaggi scambiati tra lei e l'istruttore
            query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${instructorId}),and(sender_id.eq.${instructorId},receiver_id.eq.${currentUser.id})`);
        }
    }

    const { data: messages, error } = await query;

    if (error) {
        console.error("Errore caricamento messaggi:", error);
        container.innerHTML = `<p class="text-xs text-brand-pink text-center">Errore nel caricamento dei messaggi.</p>`;
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

// Render del singolo messaggio
function appendSingleMessage(msg) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    // Filtra i messaggi in tempo reale non inerenti al canale/utente selezionato
    if (currentChatType === 'group' && msg.receiver_id !== null) return;
    if (currentChatType === 'private') {
        if (msg.receiver_id === null) return;
        
        // Se siamo in privato, verifica che il messaggio appartenga alla conversazione attiva
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

// Invio nuovo messaggio
async function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    const sb = window.supabaseClient;
    let receiverId = null;

    if (currentChatType === 'private') {
        if (currentUser.is_admin) {
            // L'istruttore risponde all'allieva selezionata nel menu a tendina
            if (!selectedStudentId) {
                alert("Seleziona prima un'allieva a cui inviare il messaggio!");
                return;
            }
            receiverId = selectedStudentId;
        } else {
            // L'allieva scrive all'istruttore
            receiverId = instructorId;
        }
    }

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
