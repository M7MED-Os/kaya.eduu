import { supabase } from "./supabaseClient.js";
import { showToast, getCache, setCache, getSWR } from "./utils.js";
import { APP_CONFIG } from "./constants.js";
import { checkAuth } from "./auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Auth & Sync
    const auth = await checkAuth();
    if (!auth) return;

    // 2. Initial UI Render from SSOT
    updateDashboardProfileUI(auth.profile);

    // 3. Reactive updates (Realtime Push)
    window.addEventListener('profileUpdated', (e) => {
        updateDashboardProfileUI(e.detail);
    });

    // 4. Load Other Components
    loadAnnouncements(auth.profile);
    loadDashboardStats(auth.user.id);

    // 5. Initialize premium banner
    initPremiumBanner(auth.profile);

    // 6. Check for activation celebration
    checkActivationCelebration(auth.profile);
});

function updateDashboardProfileUI(profile) {
    if (!profile) return;

    // Points/Stats UI management moved to auth.js for unified freemium logic

    const nameEl = document.getElementById("studentName");
    if (nameEl) nameEl.textContent = profile.full_name.split(' ')[0];
}

async function loadDashboardStats(userId) {
    const statsKey = `user_stats_${userId}`;

    // Delegate rendering to the freemium-aware renderStatsUI in auth.js
    getSWR(statsKey,
        () => supabase.rpc('get_user_stats', { p_user_id: userId }).then(res => res.data[0]),
        APP_CONFIG.CACHE_TIME_STATS,
        (stats) => {
            // Use auth.js version (freemium-aware). Fallback for safety.
            if (typeof window.renderStatsUI === 'function') {
                window.renderStatsUI(stats);
            }
        }
    );

    // Use SWR for History
    getSWR(`recent_history_${userId}`,
        () => supabase.from('results').select('*, exams(*)').eq('user_id', userId).order('created_at', { ascending: false }).limit(5).then(res => res.data),
        APP_CONFIG.CACHE_TIME_STATS,
        (history) => renderHistoryUI(history)
    );
}

// NOTE: renderStatsUI is defined in auth.js (freemium-aware).
// dashboard.js does NOT define its own copy to avoid bypassing the freemium check.

function renderHistoryUI(history) {
    const section = document.getElementById('resultsSection');
    const container = document.getElementById('resultsContainer');
    if (!section || !container || !history || history.length === 0) return;

    section.style.display = 'block';
    container.innerHTML = history.map(item => `
        <div class="result-card">
            <div class="result-header">
                <strong>${item.exams?.title || 'امتحان مفقود'}</strong>
                <span class="badge ${item.percentage >= 50 ? 'success' : 'danger'}">${item.percentage}%</span>
            </div>
            <div class="result-footer">
                <small>${new Date(item.created_at).toLocaleDateString('ar-EG')}</small>
            </div>
        </div>
    `).join('');
}

async function loadAnnouncements(profile) {
    const container = document.getElementById('announcements-container');
    if (!container || !profile) return;

    const userId = profile.id;
    const cacheKey = `announcements_${userId}`;

    getSWR(cacheKey, async () => {
        // Use RPC function to get announcements for user
        const { data, error } = await supabase
            .rpc('get_announcements_for_user', { p_user_id: userId });

        if (error) {
            console.error('Error loading announcements:', error);
            container.innerHTML = '<p style="text-align: center; color: var(--text-light);">حدث خطأ في تحميل الإعلانات</p>';
            return null;
        }

        return data || [];
    }, APP_CONFIG.CACHE_TIME_ANNOUNCEMENTS, (announcements) => {
        if (!announcements || announcements.length === 0) {
            container.style.display = 'none';
            return;
        }
        renderAnnouncements(announcements, container);
    });
}

function renderAnnouncements(announcements, container) {
    if (!announcements || announcements.length === 0) return;

    const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
    const valid = announcements.filter(a => !dismissed.includes(a.id));

    // Hide container if no valid announcements
    if (valid.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = valid.map(ann => `
        <div class="announcement-toast announcement-${ann.type || 'info'}" id="ann-${ann.id}">
             <strong>${ann.title}</strong>
             <p>${ann.message}</p>
             <button onclick="dismissAnnouncement('${ann.id}')">×</button>
        </div>
    `).join('');
}

window.dismissAnnouncement = (id) => {
    const el = document.getElementById(`ann-${id}`);
    if (el) el.remove();
    const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
    dismissed.push(id);
    localStorage.setItem('dismissed_announcements', JSON.stringify(dismissed));
};

window.showPointsExplanation = () => {
    Swal.fire({
        title: '<span style="font-weight: 800; color: #1e293b; font-size: 1.2rem;">إزاي تجمع نقط؟ 🎯</span>',
        html: `
            <div style="text-align: right; direction: rtl; font-family: 'Cairo', sans-serif; line-height: 1.6;">
                <div style="background: #f0f9ff; padding: 18px; border-radius: 12px; border-right: 4px solid #03A9F4; color: #334155; font-size: 1rem;">
                    كل امتحان بتحله بتزيد في النقط نقطة لكل سؤال صح (لو دي أول مرة تحل الامتحان). 
                    <br>
                    وفي نقط زيادة لو قفلت، ولو حليت كل يوم امتحان لمدة 3 و 5 و 7 أيام.
                    <br>
                    كل ما تزيد في النقط و المتسوى هتظهر في قايمة الاوائل😂
                </div>
            </div>
        `,
        confirmButtonText: 'تمام، فهمت!',
        confirmButtonColor: '#03A9F4',
        width: '380px',
        padding: '1.5rem',
        borderRadius: '20px'
    });
};

/**
 * Initialize premium banner for non-premium users
 */
function initPremiumBanner(profile) {
    if (!profile) return;

    const banner = document.getElementById('premiumBanner');
    if (!banner) return;

    // Check session dismissal
    if (sessionStorage.getItem('premium_banner_dismissed')) return;

    // Show banner
    banner.style.display = 'flex';

    // Subscribe button
    const subscribeBtn = document.getElementById('premiumBannerBtn');
    if (subscribeBtn) {
        subscribeBtn.onclick = () => window.location.href = 'pending.html';
    }

    // Close button
    const closeBtn = document.getElementById('closePremiumBanner');
    if (closeBtn) {
        closeBtn.onclick = () => {
            banner.style.display = 'none';
            sessionStorage.setItem('premium_banner_dismissed', 'true');
        };
    }
}


/**
 * Initialize and show subscription banner for non-premium users
 */
function initSubscriptionBanner(profile) {
    // Check if banner was dismissed in this session
    const bannerDismissed = sessionStorage.getItem('subscription_banner_dismissed');
    if (bannerDismissed) return;

    if (!profile) return;

    // Check if user has active subscription (matching subscription.js logic)
    const isPremium = profile.is_active === true;

    if (isPremium) return; // Don't show banner for premium users

    // Show banner
    const banner = document.getElementById('subscriptionBanner');
    if (banner) {
        banner.style.display = 'block';

        // Subscribe button - redirect to pricing page
        const subscribeBtn = document.getElementById('subscriptionBannerBtn');
        if (subscribeBtn) {
            subscribeBtn.onclick = () => {
                window.location.href = 'pending.html';
            };
        }

        // Close button
        const closeBtn = document.getElementById('closeBannerBtn');
        if (closeBtn) {
            closeBtn.onclick = dismissBanner;
        }
    }
}

/**
 * Dismiss banner for current session
 */
function dismissBanner() {
    const banner = document.getElementById('subscriptionBanner');
    if (banner) {
        banner.style.display = 'none';
        sessionStorage.setItem('subscription_banner_dismissed', 'true');
    }
}


/**
 * Check if the user has a new activation and show celebration
 */
async function checkActivationCelebration(profile) {
    if (!profile || !profile.is_active || !profile.subscription_ends_at) return;

    const currentActivationValue = profile.subscription_ends_at;

    // Use DB-backed persistence instead of localStorage to handle Incognito/Multiple devices
    if (profile.last_activation_shown === currentActivationValue) return;

    // Show celebration
    const expiryDate = new Date(profile.subscription_ends_at);
    const dateStr = expiryDate.toLocaleDateString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    // Mark as shown in DB immediately
    await supabase.from('profiles')
        .update({ last_activation_shown: currentActivationValue })
        .eq('id', profile.id);

    Swal.fire({
        title: '<span style="font-weight: 900; color: #1e293b; font-size: 1.6rem; display: block; margin-top: 5px;">حسابك اتفعل😘</span>',
        html: `
            <div style="text-align: center; direction: rtl; font-family: 'Cairo', sans-serif;">
                <div style="font-size: 1.1rem; color: #64748b; margin-bottom: 1.5rem; line-height: 1.5;">
                    حسابك شغال لحد يوم <br> 
                    <strong style="color: #03A9F4; font-size: 1.3rem; display: block; margin-top: 5px;">${dateStr}</strong>
                </div>
                <div style="background: #f0f9ff; padding: 15px; border-radius: 12px; border: 2px dashed #03A9F4; color: #0288D1; font-weight: 800; font-size: 1rem;">
                   كل المحتوى و المميزات مفتوحه 🚀
                </div>
            </div>
        `,
        confirmButtonText: 'يلا بينا',
        confirmButtonColor: '#03A9F4',
        width: 'min(95%, 400px)',
        padding: '1.5rem',
        borderRadius: '24px',
        allowOutsideClick: false,
        didOpen: () => {
            // Trigger confetti
            if (typeof confetti === 'function') {
                const duration = 3 * 1000;
                const end = Date.now() + duration;

                (function frame() {
                    confetti({
                        particleCount: 3,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0 },
                        colors: ['#03A9F4', '#00bcd4', '#4DD0E1']
                    });
                    confetti({
                        particleCount: 3,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1 },
                        colors: ['#03A9F4', '#00bcd4', '#4DD0E1']
                    });

                    if (Date.now() < end) {
                        requestAnimationFrame(frame);
                    }
                }());
            }
        }
    });
}
