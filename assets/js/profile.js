import { supabase } from "./supabaseClient.js";
import { showToast, showInputError } from './utils.js';
import { getAcademicYearLabel, getTermLabel, getDepartmentLabel } from './constants.js';
import { openAvatarModal } from "./avatar-modal.js";
import { generateAvatar, calculateLevel, getLevelColor, getLevelLegend, LEVEL_MULTIPLIER } from './avatars.js';
import { createLevelBadge, createLevelProgress, applyLevelTheme } from './level-badge.js';

// ==========================
// 1. Current State
// ==========================

let currentUser = null;
let currentProfile = null;

import { checkAuth } from "./auth.js";

async function loadProfile() {
    // 1. Central Auth & Sync
    const auth = await checkAuth({ forceRefresh: true });
    if (!auth) return;

    currentUser = auth.user;
    currentProfile = auth.profile;

    renderProfileUI(auth.profile, auth.user);
    loadPrivacySettings();
    loadSubjectStats(auth.user.id, auth.profile);

    // 2. Reactive updates
    window.addEventListener('profileUpdated', (e) => {
        currentProfile = e.detail;
        renderProfileUI(e.detail, currentUser);
    });
}

function renderProfileUI(profile, user) {
    if (!profile) return;

    // 1. Get Auth Metadata fallback
    const meta = user?.user_metadata || {};

    // 2. Data to use (new column names with fallback)
    const fullName = profile.full_name || meta.full_name || "";
    const email = currentUser.email || "";
    const academic_year = profile?.academic_year || meta.academic_year || "";
    const current_term = profile?.current_term || meta.current_term || "";
    const department = profile?.department || meta.department || "";



    // 3. Populate Form Inputs (Hidden or editable)
    document.getElementById("fullname").value = fullName;

    // Background inputs (keep synced for logic if needed)
    const emailField = document.getElementById("email");
    const gradeField = document.getElementById("grade");
    const streamField = document.getElementById("stream");
    const termField = document.getElementById("term");

    if (emailField) emailField.value = email;
    if (gradeField) gradeField.value = academic_year;
    if (termField) termField.value = current_term;
    if (streamField) streamField.value = department;

    // Display Bio
    const bioDisplay = document.getElementById('profileBioDisplay');
    if (bioDisplay) {
        bioDisplay.textContent = profile.bio || 'ضيف بايو';
        bioDisplay.style.opacity = profile.bio ? '1' : '0.7';
        bioDisplay.style.fontStyle = profile.bio ? 'italic' : 'normal';
    }

    // Preview Profile Button
    const previewBtn = document.getElementById('previewProfileBtn');
    if (previewBtn) {
        previewBtn.href = `student-profile.html?id=${currentUser.id}`;
    }


    // 4. Subscription Card Logic (Show for all users)
    const subStart = document.getElementById('subStart');
    const subEnd = document.getElementById('subEnd');
    const planName = document.getElementById('planName');
    const timeLeft = document.getElementById('timeLeft');

    const isAdmin = profile?.role === 'admin' || (user?.user_metadata?.role === 'admin');
    const isActive = profile?.is_active === true;

    // Check if subscription is genuinely active: must be is_active=true AND not expired
    const now = new Date();
    const expiry = profile.subscription_ends_at ? new Date(profile.subscription_ends_at) : null;
    const isExpired = expiry && now > expiry;
    const isGenuinelyActive = isAdmin || (isActive && !isExpired);

    if (subStart) subStart.textContent = profile.subscription_started_at ? new Date(profile.subscription_started_at).toLocaleString('ar-EG') : 'غير محدد';
    if (subEnd) subEnd.textContent = profile.subscription_ends_at ? new Date(profile.subscription_ends_at).toLocaleString('ar-EG') : 'غير محدد';
    const subStatus = document.getElementById('subStatus');
    const subStatusText = subStatus ? subStatus.querySelector('.status-text') : null;

    // Populate Plan Name (Fixing the missing data)
    if (planName) {
        planName.textContent = profile.last_duration_text || 'خطة مخصصة';
    }

    if (timeLeft) {
        // Reset classes
        if (subStatus) {
            subStatus.classList.remove('active', 'suspended', 'expired');
        }

        if (!isActive && !isAdmin) {
            const hasExpiredNaturally = expiry && now > expiry;

            if (hasExpiredNaturally) {
                if (subStatus) {
                    if (subStatusText) subStatusText.textContent = 'منتهي';
                    subStatus.classList.add('expired');
                }
                timeLeft.textContent = 'انتهت صلاحية الوصول';
                timeLeft.style.color = '#94a3b8';
            } else {
                if (subStatus) {
                    if (subStatusText) subStatusText.textContent = 'موقوف';
                    subStatus.classList.add('suspended');
                }
                timeLeft.textContent = 'الحساب موقوف حالياً';
                timeLeft.style.color = '#ef4444';
            }
        } else {
            // Label "شغال" for admin or active student
            if (subStatus) {
                if (subStatusText) subStatusText.textContent = 'شغال';
                subStatus.classList.add('active');
            }

            if (isAdmin) {
                timeLeft.textContent = 'وصول كامل (مسؤول)';
                timeLeft.style.color = '#fbbf24';
            } else if (profile.subscription_ends_at) {
                const diff = expiry - now;
                if (diff > 0) {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                    const mins = Math.floor((diff / (1000 * 60)) % 60);
                    timeLeft.textContent = `${days} يوم و ${hours} ساعة و ${mins} دقيقة`;
                    timeLeft.style.color = '#0ea5e9';
                } else {
                    if (subStatus) {
                        if (subStatusText) subStatusText.textContent = 'منتهي';
                        subStatus.classList.add('expired');
                    }
                    timeLeft.textContent = 'انتهى الاشتراك';
                    timeLeft.style.color = '#94a3b8';
                }
            }
        }
    }


    // 5. Admin UI
    const adminBtn = document.getElementById("adminNavBtn");
    if (isAdmin) {
        // console.log("Admin logged in. All background fields are synced.");
        const adminNotice = document.getElementById("adminNotice");
        if (adminNotice) adminNotice.innerHTML = "<i class='fas fa-info-circle'></i> أنت تمتلك صلاحيات أدمن. الحقول مخفية للتبسيط.";

        if (adminBtn) adminBtn.style.display = 'block';

        const bottomAdminBtn = document.getElementById("bottomAdminBtn");
        if (bottomAdminBtn) bottomAdminBtn.style.display = 'flex';
    } else {
        if (adminBtn) adminBtn.remove();
        const bottomAdminBtn = document.getElementById("bottomAdminBtn");
        if (bottomAdminBtn) bottomAdminBtn.remove();
    }

    // 6. Display Avatar, Name, Email, and Level Badge
    const avatarImg = document.getElementById('profileAvatar');
    const levelBadgeContainer = document.getElementById('profileLevelBadge');
    const displayName = document.getElementById('profileDisplayName');
    const emailDisplay = document.getElementById('profileEmailDisplay');
    const statsGrid = document.getElementById('profileStatsGrid');

    if (avatarImg) {
        // Show cached avatar immediately if available
        const cachedAvatar = localStorage.getItem(`avatar_${currentUser.id}`);
        if (cachedAvatar && !avatarImg.src.includes('ui-avatars.com')) {
            avatarImg.src = cachedAvatar;
        }

        const avatarUrl = profile.avatar_url || generateAvatar(fullName, 'initials');
        avatarImg.src = avatarUrl;

        // Cache the new avatar URL
        if (profile.avatar_url) {
            localStorage.setItem(`avatar_${currentUser.id}`, profile.avatar_url);
        }

        // Update border color based on level
        if (profile.points !== undefined) {
            const levelMeta = applyLevelTheme(avatarImg, profile.points);
            avatarImg.style.border = `5px solid var(--level-color)`;
            avatarImg.style.boxShadow = `var(--level-shadow)`;
        }
    }

    if (levelBadgeContainer && profile.points !== undefined) {
        levelBadgeContainer.innerHTML = createLevelBadge(profile.points, 'medium');
    }

    if (displayName) {
        displayName.textContent = fullName || 'اسم الطالب';
    }

    if (emailDisplay) {
        emailDisplay.textContent = email || 'email@example.com';
    }

    // 6.5. Display Level Progress Bar
    const levelProgressContainer = document.getElementById('profileLevelProgress');
    if (levelProgressContainer && profile.points !== undefined) {
        levelProgressContainer.innerHTML = createLevelProgress(profile.points);
    }

    // 7. Display Stats in Premium Cards
    if (statsGrid) {
        let statsHtml = '';

        // Academic Year Card
        statsHtml += createStatCard(
            'السنة الدراسية',
            getAcademicYearLabel(academic_year) || academic_year || '-',
            'fa-graduation-cap',
            '#10b981',
            'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        );

        // Term Card
        if (current_term) {
            statsHtml += createStatCard(
                'الترم',
                getTermLabel(current_term) || current_term || '-',
                'fa-calendar-alt',
                '#3b82f6',
                'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
            );
        }

        // Department Card (for Year 3)
        if (academic_year === "third_year" && department) {
            statsHtml += createStatCard(
                'الشعبة',
                getDepartmentLabel(department) || department || '-',
                'fa-user-md',
                '#8b5cf6',
                'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
            );
        }

        // Points Card
        if (profile.points !== undefined) {
            statsHtml += createStatCard(
                'النقاط',
                `${profile.points || 0} نقطة`,
                'fa-star',
                '#f59e0b',
                'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            );
        }

        statsGrid.innerHTML = statsHtml;

        // Ensure grid centering on small screens
        statsGrid.style.justifyContent = 'center';
    }
}

// Helper function to create stat cards
function createStatCard(label, value, icon, color, gradient) {
    return `
        <div class="stat-card">
            <div class="stat-icon-wrapper" style="background: ${gradient};">
                <i class="fas ${icon}"></i>
            </div>
            <div class="stat-content">
                <div class="stat-label">${label}</div>
                <div class="stat-value">${value}</div>
            </div>
        </div>
    `;
}

// ==========================
// Grading System (Phase 4)
// ==========================

function getGrade(percentage) {
    if (percentage >= 95) return { grade: 'A+', name: 'امتياز مرتفع', color: '#10b981', bg: '#d1fae5' };
    if (percentage >= 90) return { grade: 'A', name: 'امتياز', color: '#10b981', bg: '#d1fae5' };
    if (percentage >= 85) return { grade: 'A-', name: 'امتياز منخفض', color: '#34d399', bg: '#ecfdf5' };
    if (percentage >= 80) return { grade: 'B+', name: 'جيد جداً مرتفع', color: '#3b82f6', bg: '#dbeafe' };
    if (percentage >= 75) return { grade: 'B', name: 'جيد جداً', color: '#3b82f6', bg: '#dbeafe' };
    if (percentage >= 70) return { grade: 'B-', name: 'جيد جداً منخفض', color: '#60a5fa', bg: '#eff6ff' };
    if (percentage >= 60) return { grade: 'C', name: 'جيد', color: '#f59e0b', bg: '#fef3c7' };
    return { grade: 'D', name: 'مقبول', color: '#ef4444', bg: '#fee2e2' };
}

// ==========================
// Per-Subject Stats (Phase 5)
// ==========================

async function loadSubjectStats(userId, profile) {
    const container = document.getElementById('subjectStatsSection');
    if (!container) return;

    try {
        // 1. Fetch freemium config to check visibility
        const { data: freemiumData } = await supabase
            .from('freemium_config')
            .select('stats_config, subject_stats_config')
            .limit(1)
            .single();

        const isPremium = profile.role === 'admin' ||
            (profile.is_active === true &&
                (!profile.subscription_ends_at || new Date(profile.subscription_ends_at) > new Date()));

        const showStats = isPremium || (freemiumData?.stats_config ?? true);
        const showSubjectStats = isPremium || (freemiumData?.subject_stats_config ?? true);

        // 2. Always show overall accuracy if showStats
        const { data: allResults } = await supabase
            .from('results')
            .select('score, total_questions, percentage')
            .eq('user_id', userId);

        if (!allResults || allResults.length === 0) {
            container.style.display = 'none';
            return;
        }

        const totalExams = allResults.length;
        const avgAccuracy = Math.round(allResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / totalExams);
        const overallGrade = getGrade(avgAccuracy);

        let html = `
            <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">
                <h3 style="font-size: 1.1rem; font-weight: 900; color: #0f172a; margin: 0 0 1rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-chart-bar" style="color: #03A9F4;"></i> الإحصائيات
                </h3>`;

        if (!showStats) {
            html += `
                <div style="text-align:center; padding: 1.5rem; background: #f8fafc; border-radius: 12px; border: 2px dashed #e2e8f0;">
                    <i class="fas fa-lock" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
                    <p style="color: #64748b; font-weight: 700; margin: 0;">مشترك عشان تشوف إحصائياتك</p>
                </div>
            </div>`;
            container.innerHTML = html;
            return;
        }

        // Overall accuracy card
        html += `
            <div style="display: flex; align-items: center; gap: 12px; padding: 1rem; background: ${overallGrade.bg}; border-radius: 12px; border: 1px solid ${overallGrade.color}30; margin-bottom: 1rem;">
                <div style="background: ${overallGrade.color}; color: white; width: 52px; height: 52px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; font-size: 1rem; flex-shrink: 0;">
                    ${overallGrade.grade}
                </div>
                <div>
                    <div style="font-weight: 900; color: #0f172a; font-size: 1rem;">${overallGrade.name}</div>
                    <div style="color: #64748b; font-size: 0.85rem;">متوسط دقتك الكلي: <strong style="color: ${overallGrade.color};">${avgAccuracy}%</strong> من ${totalExams} امتحان</div>
                </div>
            </div>`;

        // 3. Per-subject breakdown
        if (showSubjectStats) {
            const { data: subjResults } = await supabase
                .from('results')
                .select('score, total_questions, percentage, exams(subject_id, subjects(name_ar))')
                .eq('user_id', userId);

            if (subjResults && subjResults.length > 0) {
                // Aggregate by subject
                const subjectMap = {};
                subjResults.forEach(r => {
                    const subjectName = r.exams?.subjects?.name_ar;
                    if (!subjectName) return;
                    if (!subjectMap[subjectName]) {
                        subjectMap[subjectName] = { count: 0, totalPct: 0 };
                    }
                    subjectMap[subjectName].count++;
                    subjectMap[subjectName].totalPct += (r.percentage || 0);
                });

                const subjects = Object.entries(subjectMap)
                    .map(([name, data]) => ({
                        name,
                        count: data.count,
                        avg: Math.round(data.totalPct / data.count)
                    }))
                    .sort((a, b) => b.avg - a.avg);

                html += `
                    <h4 style="font-size: 0.95rem; font-weight: 800; color: #475569; margin: 1rem 0 0.75rem; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-book-open" style="color: #10b981;"></i> تفاصيل المواد
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">`;

                subjects.forEach(s => {
                    const g = getGrade(s.avg);
                    html += `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: white; border-radius: 10px; border: 1px solid #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                            <div style="background: ${g.color}; color: white; min-width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.85rem; flex-shrink: 0;">${g.grade}</div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 800; color: #0f172a; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.name}</div>
                                <div style="font-size: 0.75rem; color: #64748b;">${s.count} امتحان · ${g.name}</div>
                            </div>
                            <div style="text-align: center; flex-shrink: 0;">
                                <div style="font-weight: 900; color: ${g.color}; font-size: 1rem;">${s.avg}%</div>
                            </div>
                        </div>`;
                });

                html += `</div>`;
            }
        } else {
            html += `
                <div style="text-align:center; padding: 1rem; background: #f8fafc; border-radius: 10px; border: 1px dashed #e2e8f0;">
                    <p style="color: #64748b; font-size: 0.85rem; margin: 0;"><i class="fas fa-lock"></i> تفاصيل المواد للمشتركين فقط</p>
                </div>`;
        }

        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        console.error('Error loading subject stats:', err);
    }
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "login.html";
    });
}

// Edit Name Button
const editNameBtn = document.getElementById("editNameBtn");
if (editNameBtn) {
    editNameBtn.addEventListener("click", async () => {
        if (!currentProfile || !currentUser) {
            showToast('جاري تحميل البيانات...', 'info');
            return;
        }

        const { value: newName } = await Swal.fire({
            title: 'تعديل الاسم',
            input: 'text',
            inputValue: currentProfile.full_name,
            inputPlaceholder: 'اكتب اسمك الكامل',
            showCancelButton: true,
            confirmButtonText: 'حفظ',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#03A9F4',
            inputValidator: (value) => {
                if (!value || value.trim().length < 3) {
                    return 'الاسم يجب أن يكون 3 أحرف على الأقل';
                }
            }
        });

        if (newName && newName.trim() !== currentProfile.full_name) {
            try {
                Swal.fire({
                    title: 'جاري الحفظ...',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                const { error } = await supabase
                    .from('profiles')
                    .update({ full_name: newName.trim() })
                    .eq('id', currentUser.id);

                if (error) throw error;

                // Update auth metadata
                await supabase.auth.updateUser({
                    data: { full_name: newName.trim() }
                });

                Swal.fire({
                    icon: 'success',
                    title: 'تم الحفظ بنجاح!',
                    showConfirmButton: false,
                    timer: 1500
                });

                // Update UI
                currentProfile.full_name = newName.trim();
                document.getElementById('profileDisplayName').textContent = newName.trim();
                document.getElementById('fullname').value = newName.trim();

                // Trigger global update
                window.dispatchEvent(new CustomEvent('profileUpdated', { detail: currentProfile }));

            } catch (error) {
                console.error(error);
                Swal.fire('خطأ', 'حصل خطأ في الحفظ', 'error');
            }
        }
    });
}

// Change Avatar Button
const changeAvatarBtn = document.getElementById("changeAvatarBtn");
if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener("click", async () => {
        if (!currentProfile || !currentUser) {
            showToast('جاري تحميل البيانات...', 'info');
            return;
        }

        await openAvatarModal('user', currentUser.id, currentProfile.full_name, (newAvatarUrl) => {
            // Update UI immediately
            const avatarImg = document.getElementById('profileAvatar');
            if (avatarImg) avatarImg.src = newAvatarUrl;

            // Update current profile
            currentProfile.avatar_url = newAvatarUrl;

            // Trigger global profile update event
            window.dispatchEvent(new CustomEvent('profileUpdated', { detail: currentProfile }));
        });
    });

    // Edit Bio Button
    const editBioBtn = document.getElementById('editBioBtn');
    if (editBioBtn) {
        editBioBtn.addEventListener('click', async () => {
            if (!currentUser || !currentProfile) {
                showToast('جاري تحميل البيانات...', 'info');
                return;
            }

            const { value: newBio } = await Swal.fire({
                title: 'تعديل البايو',
                input: 'textarea',
                inputPlaceholder: 'صلي على النبي',
                inputValue: currentProfile.bio || '',
                inputAttributes: {
                    maxlength: 200,
                    'aria-label': 'البايو'
                },
                showCancelButton: true,
                confirmButtonText: 'حفظ',
                cancelButtonText: 'إلغاء',
                confirmButtonColor: 'var(--primary-color)',
                inputValidator: (value) => {
                    if (value && value.length > 200) {
                        return 'النبذة طويلة جداً! الحد الأقصى 200 حرف';
                    }
                }
            });

            if (newBio !== undefined) {
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({ bio: newBio || null })
                        .eq('id', currentUser.id);

                    if (error) throw error;

                    // Update UI
                    const bioDisplay = document.getElementById('profileBioDisplay');
                    if (bioDisplay) {
                        bioDisplay.textContent = newBio || 'ضيف بايو';
                        bioDisplay.style.opacity = newBio ? '1' : '0.7';
                        bioDisplay.style.fontStyle = newBio ? 'italic' : 'normal';
                    }

                    currentProfile.bio = newBio;
                    showToast('تم تحديث النبذة بنجاح!', 'success');

                    // Trigger global profile update
                    window.dispatchEvent(new CustomEvent('profileUpdated', { detail: currentProfile }));
                } catch (err) {
                    console.error('Error updating bio:', err);
                    showToast('حدث خطأ أثناء التحديث', 'error');
                }
            }
        });
    }
}

// ==========================
// Privacy Settings Functions
// ==========================

async function loadPrivacySettings() {
    if (!currentProfile) return;

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('privacy_avatar, privacy_bio, privacy_stats, privacy_progress, privacy_squad, show_on_leaderboard')
            .eq('id', currentProfile.id)
            .single();

        if (profile) {
            // Wait for modal to load if needed
            setTimeout(() => {
                // Set active classes for choice buttons
                const groups = ['privacyAvatar', 'privacyBio', 'privacyLevel', 'privacyStats', 'privacySquad'];
                groups.forEach(groupId => {
                    const group = document.querySelector(`.choice-group[data-id="${groupId}"]`);
                    if (group) {
                        // Map privacyLevel to privacy_progress and privacyStats to privacy_stats
                        let colName = groupId.replace('privacy', 'privacy_').toLowerCase();
                        if (groupId === 'privacyLevel') colName = 'privacy_progress';
                        if (groupId === 'privacyStats') colName = 'privacy_stats';

                        const val = profile[colName] || 'public';
                        const btn = group.querySelector(`.choice-btn[data-value="${val}"]`);
                        if (btn) {
                            group.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                        }
                    }
                });

                // Leaderboard
                const lbGroup = document.querySelector('.choice-group[data-id="privacyLeaderboard"]');
                if (lbGroup) {
                    const val = profile.show_on_leaderboard === false ? 'false' : 'true';
                    const btn = lbGroup.querySelector(`.choice-btn[data-value="${val}"]`);
                    if (btn) {
                        lbGroup.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    }
                }
            }, 100);
        }
    } catch (err) {
        console.error('Error loading privacy settings:', err);
    }
}

window.savePrivacySettings = async function () {
    if (!currentProfile) return;

    const getChoice = (id) => {
        const active = document.querySelector(`.choice-group[data-id="${id}"] .choice-btn.active`);
        return active ? active.dataset.value : null;
    };

    const privacySettings = {
        privacy_avatar: getChoice('privacyAvatar'),
        privacy_bio: getChoice('privacyBio'),
        privacy_progress: getChoice('privacyLevel'),
        privacy_stats: getChoice('privacyStats'),
        privacy_squad: getChoice('privacySquad'),
        show_on_leaderboard: getChoice('privacyLeaderboard') === 'true'
    };

    try {
        const { error } = await supabase
            .from('profiles')
            .update(privacySettings)
            .eq('id', currentProfile.id);

        if (error) throw error;

        // Close modal if it exists
        if (typeof closePrivacyModal === 'function') {
            closePrivacyModal();
        }

        showToast('تم حفظ إعدادات الخصوصية بنجاح', 'success');
    } catch (err) {
        console.error('Error saving privacy settings:', err);
        showToast('حدث خطأ أثناء الحفظ', 'error');
    }
};

// Modal control functions
window.openPrivacyModal = function () {
    const modal = document.getElementById('privacyModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        loadPrivacySettings();
    }
};

window.closePrivacyModal = function () {
    const modal = document.getElementById('privacyModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

// Choice Chip Logic
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.choice-btn');
    if (btn) {
        const group = btn.closest('.choice-group');
        if (group) {
            group.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Subtle Haptic feedback feel
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(5);
            }
        }
    }
});

// Level Guide Button
const showLevelGuideBtn = document.getElementById('showLevelGuideBtn');
if (showLevelGuideBtn) {
    showLevelGuideBtn.addEventListener('click', () => {
        const legend = getLevelLegend();

        let html = `
            <div style="text-align: right; direction: rtl; font-family: 'Cairo', sans-serif;">
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 380px; overflow-y: auto; padding-left: 4px; scrollbar-width: thin;">
        `;

        legend.reverse().forEach(tier => {
            html += `
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: white;
                    border-radius: 10px;
                    border: 1px solid #f1f5f9;
                    transition: border-color 0.2s;
                " onmouseover="this.style.borderColor='${tier.color}60'"
                   onmouseout="this.style.borderColor='#f1f5f9'">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="
                            font-size: 1rem;
                            width: 28px;
                            height: 28px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: ${tier.color}15;
                            border-radius: 8px;
                        ">${tier.icon}</span>
                        <div style="font-weight: 700; color: #334155; font-size: 0.85rem;">${tier.name}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-weight: 800; color: ${tier.color}; font-size: 0.95rem;">${tier.points.toLocaleString()}</span>
                        <span style="font-size: 0.65rem; color: #94a3b8; font-weight: 600;">XP</span>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                <div style="
                    margin-top: 1rem;
                    padding: 10px;
                    background: #f8fafc;
                    border-radius: 8px;
                    border: 1px dashed #e2e8f0;
                    color: #94a3b8;
                    font-size: 0.75rem;
                    text-align: center;
                ">
                    بتتحسب كده: (المستوى × المستوى) × ${LEVEL_MULTIPLIER}
                </div>
            </div>
        `;

        Swal.fire({
            title: '<span style="font-weight: 800; color: #1e293b; font-size: 1.1rem;"> المستويات</span>',
            html: html,
            showConfirmButton: true,
            confirmButtonText: 'إغلاق',
            confirmButtonColor: '#03A9F4',
            width: '360px',
            padding: '1.25rem',
            background: '#ffffff',
            borderRadius: '20px'
        });
    });
}

// Initialize
async function init() {
    await checkAuth();
    await loadProfile();
}

init();
