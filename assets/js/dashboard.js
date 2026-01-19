import { supabase } from "./supabaseClient.js";

document.addEventListener('DOMContentLoaded', async () => {
    await loadAnnouncements();
});

async function loadAnnouncements() {
    const container = document.getElementById('announcements-container');
    if (!container) return;

    // 1. Get Current User Profile for filtering
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Should be handled by auth.js but safety check

    const { data: profile } = await supabase.from('profiles')
        .select('grade, role')
        .eq('id', user.id)
        .single();

    if (!profile) return;

    // 2. Fetch Active Announcements
    // Filter: 
    // - targeting user
    // - is_active = true
    // - scheduled_for <= now (published)
    // - expires_at > now OR null

    const gradeTarget = `grade_${profile.grade}`;
    const nowISO = new Date().toISOString();

    const { data: announcements, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .or(`target.eq.all,target.eq.${gradeTarget}`)
        .lte('scheduled_for', nowISO)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error loading announcements:", error);
        return;
    }

    if (!announcements || announcements.length === 0) return;

    // Client-side filtering for Expiry (Supabase filtered scheduled_for via query)
    // Also filter out locally dismissed announcements
    const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');

    const validAnnouncements = announcements.filter(a => {
        // 1. Check Expiry
        if (a.expires_at && new Date(a.expires_at) <= new Date()) return false;
        // 2. Check Dismissed
        if (dismissed.includes(a.id)) return false;
        return true;
    });

    if (validAnnouncements.length === 0) return;

    // 3. Render as Toasts

    // 3. Render as Toasts

    // Style the container for fixed toasts
    container.style.position = 'fixed';
    container.style.top = '20px'; // Student requested "Top of screen"
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column'; // Stack downwards from top
    container.style.gap = '10px';
    container.style.pointerEvents = 'none'; // Click through empty area
    container.style.width = '320px';
    container.style.maxWidth = '90vw';

    const typeStyles = {
        'info': { icon: 'fa-info-circle', bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', class: 'alert-info' },
        'warning': { icon: 'fa-exclamation-triangle', bg: '#fffbeb', border: '#fef3c7', text: '#92400e', class: 'alert-warning' },
        'danger': { icon: 'fa-exclamation-circle', bg: '#fef2f2', border: '#fee2e2', text: '#991b1b', class: 'alert-danger' },
        'success': { icon: 'fa-check-circle', bg: '#ecfdf5', border: '#d1fae5', text: '#065f46', class: 'alert-success' }
    };

    const html = validAnnouncements.map(ann => {
        const style = typeStyles[ann.type] || typeStyles['info'];
        return `
            <div id="ann-${ann.id}" class="announcement-toast" style="
                background: white; 
                border-left: 5px solid ${style.text}; 
                border-radius: 8px; 
                padding: 1rem; 
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                display: flex; 
                gap: 12px; 
                align-items: flex-start;
                animation: slideInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: auto; /* Clickable */
                position: relative;
                direction: rtl;
                width: 100%;
            ">
                <div style="color: ${style.text}; font-size: 1.1rem; padding-top: 2px;">
                    <i class="fas ${style.icon}"></i>
                </div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 4px 0; color: #1e293b; font-weight: 700; font-size: 0.95rem;">${ann.title}</h4>
                    <p style="margin: 0; color: #475569; font-size: 0.85rem; line-height: 1.4;">${ann.message}</p>
                    <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 6px; display: flex; align-items: center; gap: 5px;">
                         ${ann.expires_at ? `<span style="color:#ef4444;"><i class="fas fa-hourglass-end"></i> ${new Date(ann.expires_at).toLocaleDateString('ar-EG')}</span> •` : ''}
                         <span>${new Date(ann.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
                <button onclick="dismissAnnouncement('${ann.id}')" title="إخفاء" style="background:transparent; padding:4px; border:none; color: #cbd5e1; cursor: pointer; transition:0.2s; margin-left:-5px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

window.dismissAnnouncement = (id) => {
    // 1. Hide from DOM
    const el = document.getElementById(`ann-${id}`);
    if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-20px) scale(0.95)';
        el.style.transition = 'all 0.3s ease';
        setTimeout(() => el.remove(), 300);
    }

    // 2. Save to local storage
    const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
    if (!dismissed.includes(id)) {
        dismissed.push(id);
        localStorage.setItem('dismissed_announcements', JSON.stringify(dismissed));
    }
};

// Add simplistic animation style if not exists
if (!document.getElementById('anim-style')) {
    const style = document.createElement('style');
    style.id = 'anim-style';
    style.textContent = `
        @keyframes slideInDown {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}
