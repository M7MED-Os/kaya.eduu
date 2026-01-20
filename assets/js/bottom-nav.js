import { supabase } from './supabaseClient.js';

// Bottom Navigation Handler

// Enable app-mode on mobile
function checkAppMode() {
    // Check if running in standalone mode (PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');

    // Also allow testing via query param for debugging ?mode=app
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugApp = urlParams.get('mode') === 'app';

    if (isStandalone || isDebugApp) {
        document.body.classList.add('app-mode');
    } else {
        document.body.classList.remove('app-mode');
    }
}

// Check on load
checkAppMode();

// Check mostly on load, but we can listen to matchMedia changes too
window.matchMedia('(display-mode: standalone)').addEventListener('change', checkAppMode);

// Bottom nav logout handler
document.addEventListener('DOMContentLoaded', () => {
    const bottomLogoutBtn = document.getElementById('bottomLogoutBtn');
    if (bottomLogoutBtn) {
        bottomLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                const { error } = await supabase.auth.signOut();
                if (error) console.error('Error signing out:', error);
                window.location.href = 'login.html';
            } catch (err) {
                console.error('Unexpected error signing out:', err);
                window.location.href = 'login.html'; // Force redirect anyway
            }
        });
    }
});
