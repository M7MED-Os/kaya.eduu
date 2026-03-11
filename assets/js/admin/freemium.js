import { supabase } from '../supabaseClient.js';
import { showSuccessAlert, showErrorAlert, showLoadingAlert } from '../utils/alerts.js';

/**
 * Freemium Settings Management Module
 * Handles global feature toggles for squads, tasks, leaderboard, voice summary, etc.
 */

/**
 * Show Freemium Settings View
 */
export function showFreemiumSettingsView() {
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    // Add active class to freemium nav item
    const navItem = document.getElementById('navFreemium');
    if (navItem) navItem.classList.add('active');

    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = 'الرئيسية > إعدادات Freemium';

    // Hide all views
    document.querySelectorAll('.view-section, .admin-view').forEach(v => v.style.display = 'none');

    // Show freemium settings view
    const view = document.getElementById('freemiumSettingsView');
    if (view) {
        view.style.display = 'block';
        loadFreemiumSettings();
    }
}

/**
 * Load current freemium settings from database
 */
async function loadFreemiumSettings() {
    try {
        // maybeSingle: safe even if table is empty or has no matching row
        const { data, error } = await supabase
            .from('freemium_config')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error loading freemium settings:', error);
            showErrorAlert('خطأ', 'فشل تحميل الإعدادات');
            return;
        }

        // Update toggles (use defaults if data is null)
        const squadsToggle = document.getElementById('squadsFreemiumToggle');
        const tasksToggle = document.getElementById('tasksFreemiumToggle');
        const leaderboardToggle = document.getElementById('leaderboardFreemiumToggle');
        const curriculumToggle = document.getElementById('curriculumFreemiumToggle');
        const mistakesToggle = document.getElementById('mistakesFreemiumToggle');
        const statsToggle = document.getElementById('statsFreemiumToggle');
        const gradeToggle = document.getElementById('gradeFreemiumToggle');
        const subjectStatsToggle = document.getElementById('subjectStatsFreemiumToggle');
        const voiceFreeEnable = document.getElementById('voiceFreeEnable');
        const voicePremiumEnable = document.getElementById('voicePremiumEnable');

        if (squadsToggle) squadsToggle.checked = data?.squads_config ?? true;
        if (tasksToggle) tasksToggle.checked = data?.tasks_config ?? true;
        if (leaderboardToggle) leaderboardToggle.checked = data?.leaderboard_config ?? true;
        if (curriculumToggle) curriculumToggle.checked = data?.curriculum_config ?? true;
        if (mistakesToggle) mistakesToggle.checked = data?.mistakes_bank_config ?? false;
        if (statsToggle) statsToggle.checked = data?.stats_config ?? true;
        if (gradeToggle) gradeToggle.checked = data?.grade_config ?? true;
        if (subjectStatsToggle) subjectStatsToggle.checked = data?.subject_stats_config ?? true;
        if (voiceFreeEnable) voiceFreeEnable.checked = data?.voice_summary_enabled_free ?? false;
        if (voicePremiumEnable) voicePremiumEnable.checked = data?.voice_summary_enabled_premium ?? true;

        const setVal = (id, val, def = 0) => {
            const el = document.getElementById(id);
            if (el) el.value = val ?? def;
        };

        setVal('voiceFreeDaily', data?.voice_summary_daily_limit_free, 1);
        setVal('voiceFreeWeekly', data?.voice_summary_weekly_limit_free, 3);
        setVal('voicePremiumDaily', data?.voice_summary_daily_limit_premium, 5);
        setVal('voicePremiumWeekly', data?.voice_summary_weekly_limit_premium, 20);
        setVal('voiceCooldown', data?.voice_summary_cooldown_hours, 4);

    } catch (err) {
        console.error('Exception loading freemium settings:', err);
        showErrorAlert('خطأ', 'حدث خطأ في تحميل الإعدادات');
    }
}

/**
 * Save freemium settings
 */
export async function saveFreemiumSettings() {
    const squadsToggle = document.getElementById('squadsFreemiumToggle');
    const tasksToggle = document.getElementById('tasksFreemiumToggle');
    const leaderboardToggle = document.getElementById('leaderboardFreemiumToggle');
    const curriculumToggle = document.getElementById('curriculumFreemiumToggle');
    const mistakesToggle = document.getElementById('mistakesFreemiumToggle');

    try {
        showLoadingAlert('جاري الحفظ...');

        // Build new values from UI
        const newValues = {
            squads_config: squadsToggle?.checked ?? true,
            tasks_config: tasksToggle?.checked ?? true,
            leaderboard_config: leaderboardToggle?.checked ?? true,
            curriculum_config: curriculumToggle?.checked ?? true,
            mistakes_bank_config: mistakesToggle?.checked ?? false,
            stats_config: document.getElementById('statsFreemiumToggle')?.checked ?? true,
            grade_config: document.getElementById('gradeFreemiumToggle')?.checked ?? true,
            subject_stats_config: document.getElementById('subjectStatsFreemiumToggle')?.checked ?? true,

            // Voice Summary
            voice_summary_enabled_free: document.getElementById('voiceFreeEnable')?.checked ?? false,
            voice_summary_daily_limit_free: parseInt(document.getElementById('voiceFreeDaily')?.value) || 1,
            voice_summary_weekly_limit_free: parseInt(document.getElementById('voiceFreeWeekly')?.value) || 3,
            voice_summary_enabled_premium: document.getElementById('voicePremiumEnable')?.checked ?? true,
            voice_summary_daily_limit_premium: parseInt(document.getElementById('voicePremiumDaily')?.value) || 5,
            voice_summary_weekly_limit_premium: parseInt(document.getElementById('voicePremiumWeekly')?.value) || 20,
            voice_summary_cooldown_hours: parseInt(document.getElementById('voiceCooldown')?.value) || 4,

            updated_at: new Date().toISOString()
        };

        // Fetch existing row id (maybeSingle: safe even if table is empty)
        const { data: existingRow } = await supabase
            .from('freemium_config')
            .select('id')
            .limit(1)
            .maybeSingle();

        let saveError;
        if (existingRow?.id) {
            // Row exists → UPDATE
            const { error } = await supabase
                .from('freemium_config')
                .update(newValues)
                .eq('id', existingRow.id);
            saveError = error;
        } else {
            // Table empty → INSERT
            const { error } = await supabase
                .from('freemium_config')
                .insert(newValues);
            saveError = error;
        }

        if (saveError) throw saveError;

        // Log the change in audit log (best-effort — don't fail save if audit log errors)
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('freemium_audit_log').insert({
                admin_id: user.id,
                action: 'update_freemium_config',
                new_value: newValues
            });
        } catch (auditErr) {
            console.warn('Audit log failed (non-critical):', auditErr);
        }

        showSuccessAlert('تم الحفظ', 'تم تحديث إعدادات Freemium بنجاح');

    } catch (err) {
        console.error('Error saving freemium settings:', err);
        showErrorAlert('خطأ', 'فشل حفظ الإعدادات. تأكد من صلاحياتك كمسؤول.');
    }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveFreemiumSettingsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveFreemiumSettings);
    }
});
