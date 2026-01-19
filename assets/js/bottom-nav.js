// Bottom Navigation Handler
// Enable app-mode on mobile
if (window.innerWidth <= 768) {
    document.body.classList.add('app-mode');
}

// Bottom nav logout handler
document.addEventListener('DOMContentLoaded', () => {
    const bottomLogoutBtn = document.getElementById('bottomLogoutBtn');
    if (bottomLogoutBtn) {
        bottomLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            // Use the global supabase client from supabaseClient.js
            if (typeof supabase !== 'undefined') {
                await supabase.auth.signOut();
                window.location.href = 'login.html';
            }
        });
    }
});
