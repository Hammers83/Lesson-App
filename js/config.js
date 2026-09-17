// CONFIGURAZIONE SUPABASE
const SUPABASE_URL = "https://aatelpatdppxdehbsxmz.supabase.co/rest/v1/"; 
const SUPABASE_ANON_KEY = "sb_publishable_dA9nfW05M1BFCdjRwkWRMA_XM_SxPuV";

// Usa window.supabaseClient per evitare conflitti con la libreria globale
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// VERIFICA AUTENTICAZIONE E RUOLI
async function checkAuthAndRedirect(requiredRole = null) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = '../index.html';
        }
        return null;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (!profile) {
        await supabase.auth.signOut();
        window.location.href = '../index.html';
        return null;
    }

    if (requiredRole === 'admin' && !profile.is_admin) {
        window.location.href = 'dashboard-student.html';
    } else if (requiredRole === 'student' && profile.is_admin) {
        window.location.href = 'dashboard-admin.html';
    }

    return { user: session.user, profile };
}

// LOGOUT
async function logout() {
    await supabase.auth.signOut();
    window.location.href = '../index.html';
}

// NAVBAR DINAMICA
function renderNavbar(profile) {
    const navContainer = document.getElementById('nav-links');
    if (!navContainer) return;

    const roleBadge = profile.is_admin 
        ? '<span class="text-brand-cyan text-[10px] font-extrabold uppercase bg-brand-cyan/20 px-2 py-0.5 rounded-full border border-brand-cyan/30">Istruttore</span>' 
        : '';

    navContainer.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-300">Ciao, ${profile.nome}</span>
            ${roleBadge}
        </div>
        <button onclick="logout()" class="bg-brand-pink/20 hover:bg-brand-pink text-brand-pink hover:text-white border border-brand-pink/40 text-xs font-bold py-1.5 px-4 rounded-xl transition">
            Esci
        </button>
    `;
}
