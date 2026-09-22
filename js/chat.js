let currentChatType = 'group'; // 'group' oppure 'private'
let currentUser = null;
let instructorId = null; // <-- Aggiunta dichiarazione variabile mancante
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
