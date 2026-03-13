import { supabase } from "./supabaseClient.js";
import { checkAuth } from "./auth.js";
import { getCache, setCache, getSubjectIcon } from "./utils.js";
import { playSuccessSound, playUndoSound } from "./utils/sounds.js";

// Global state for real-time UI updates
let globalSubjects = [];
let globalCurriculum = [];
let globalProgress = [];
let globalTeachers = {};        // { subject_id: [teacher, ...] }
let globalPreferences = {};     // { subject_id: teacher_id }
let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loading');
    const grid = document.getElementById('subjectsGrid');

    try {
        const auth = await checkAuth();
        if (!auth) return;
        const profile = auth.profile;
        currentUserId = profile.id;

        // Initialize subscription service and check access
        const { initSubscriptionService, canAccessFeature } = await import("./subscription.js");
        await initSubscriptionService(profile);

        if (!canAccessFeature('curriculum')) {
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: white; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-top: 2rem;">
                        <div style="width: 80px; height: 80px; background: #e0f2fe; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #03A9F4; font-size: 2rem;">
                            <i class="fas fa-lock"></i>
                        </div>
                        <h2 style="color: #1e293b; margin-bottom: 1rem; font-weight: 800;">للمشتركين بس 🔒</h2>
                        <p style="color: #64748b; margin-bottom: 2rem; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.6;">اشترك دلوقتي عشان تقدر تشوف كل المحاضرات اللي نزلت و تنظم مذاكرتك مع المدرسين</p>
                        <a href="pending.html" style="display: inline-flex; align-items: center; gap: 0.75rem; background: linear-gradient(135deg, #03A9F4 0%, #0288D1 100%); color: white; padding: 1rem 2.5rem; border-radius: 12px; text-decoration: none; font-weight: 700; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(3, 169, 244, 0.3);">
                            <i class="fas fa-star"></i> اشترك دلوقتي
                        </a>
                    </div>
                `;
            }
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            return;
        }

        globalSubjects = await fetchFilteredSubjects(profile);
        if (!globalSubjects || globalSubjects.length === 0) {
            renderEmptyState(grid);
            return;
        }

        const subjectIds = globalSubjects.map(s => s.id);

        // Load curriculum, progress, teachers, and preferences in parallel
        const [curriculumRes, progressRes, teachersRes, prefsRes] = await Promise.all([
            supabase.from('college_curriculum').select('*').in('subject_id', subjectIds).order('lecture_date', { ascending: false }),
            supabase.from('user_curriculum_progress').select('*').eq('user_id', profile.id),
            supabase.from('teachers').select('*').in('subject_id', subjectIds).eq('is_active', true).order('order_index'),
            supabase.from('student_teacher_preferences').select('*').eq('profile_id', profile.id)
        ]);

        globalCurriculum = curriculumRes.data || [];
        globalProgress = progressRes.data || [];

        // Build teachers map: { subject_id → [teachers] }
        const allTeachers = teachersRes.data || [];
        allTeachers.forEach(t => {
            if (!globalTeachers[t.subject_id]) globalTeachers[t.subject_id] = [];
            globalTeachers[t.subject_id].push(t);
        });

        // Build preferences map: { subject_id → { teacher_id, updated_at } }
        (prefsRes.data || []).forEach(p => {
            globalPreferences[p.subject_id] = {
                teacher_id: p.teacher_id || 'none',
                updated_at: p.updated_at
            };
        });

        renderSubjectsGrid();
        updateOverallStats();
        updateAdminVisibility(profile);

    } catch (err) {
        console.error("[Curriculum] Fatal Error:", err);
        if (grid) grid.innerHTML = `<p style="text-align:center; padding: 2rem; color:red;">${err.message || 'حدث خطأ غير متوقع'}</p>`;
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
});

async function fetchFilteredSubjects(profile) {
    const { academic_year, department, current_term } = profile;
    const { data: allSubjects, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('academic_year', academic_year)
        .eq('is_active', true)
        .order('order_index');

    if (error) throw error;

    const filtered = allSubjects.filter(s => {
        // 1. Check Track (Department)
        // Subject is visible if it's "general"/"science_all" (for science) OR matches user's department
        const isScienceTrack = (department === 'science_science' || department === 'science_math');
        const trackMatches = (!s.department || s.department === '' || s.department === 'general' || s.department === department || (isScienceTrack && s.department === 'science_all'));
        
        // 2. Check Term
        // Subject is visible if it's "full_year" OR matches user's current_term
        const termMatches = (s.current_term === 'full_year' || s.current_term === current_term);
        
        return trackMatches && termMatches;
    });

    // Sort: Dept subjects first, then Shared subjects
    return filtered.sort((a, b) => {
        const aIsDept = department && a.department === department;
        const bIsDept = department && b.department === department;
        if (aIsDept && !bIsDept) return -1;
        if (!aIsDept && bIsDept) return 1;
        return 0; // Maintain relative order (e.g., by order_index from DB)
    });
}

function renderEmptyState(container) {
    container.innerHTML = `<div style="text-align:center; padding: 4rem; color: #94a3b8;">لا توجد مواد دراسية لهذا الترم</div>`;
}

function renderSubjectsGrid() {
    const grid = document.getElementById('subjectsGrid');
    if (!grid) return;

    grid.innerHTML = globalSubjects.map(subject => {
        const subjectTeachers = globalTeachers[subject.id] || [];
        const pref = globalPreferences[subject.id];
        const selectedTeacherId = pref ? pref.teacher_id : null;
        const selectedTeacher = selectedTeacherId && selectedTeacherId !== 'none' ? subjectTeachers.find(t => t.id === selectedTeacherId) : null;

        // Filter lectures by selected teacher OR no teacher (if 'none' or null preference)
        let relevantCurriculum = [];
        if (selectedTeacherId && selectedTeacherId !== 'none') {
            relevantCurriculum = globalCurriculum.filter(c => c.subject_id === subject.id && c.teacher_id === selectedTeacherId);
        } else {
            // "none" or null preference: Show lectures where teacher_id is null
            relevantCurriculum = globalCurriculum.filter(c => c.subject_id === subject.id && !c.teacher_id);
        }

        const total = relevantCurriculum.length;
        const done = relevantCurriculum.filter(c => globalProgress.some(p => p.lecture_id === c.id && p.is_completed)).length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        const lastLecture = relevantCurriculum[0];
        const iconClass = subject.icon || getSubjectIcon(subject.name_ar);

        // Row 1: Header (Subject + Count)
        const headerHtml = `
            <div class="card-row-header">
                <h3 class="subject-title">${subject.name_ar}</h3>
                <div class="lec-count-tag">
                    <i class="fas fa-layer-group"></i>
                    <span>${total} محاضرة</span>
                </div>
            </div>`;

        // Row 2: Identity (Teacher/General)
        let identityHtml = '';
        if (subjectTeachers.length > 0) {
            if (selectedTeacher) {
                const avatarHtml = selectedTeacher.avatar_url
                    ? `<img src="${selectedTeacher.avatar_url}" alt="${selectedTeacher.name}">`
                    : `<div class="avatar-placeholder"><i class="fas fa-user-tie"></i></div>`;

                identityHtml = `
                    <div class="card-row-identity">
                        <div class="teacher-info-box">
                            <!-- <span class="label">المدرس الحالي</span> -->
                            <div class="teacher-name-row">
                                <!-- <i class="fas fa-chalkboard-teacher"></i> -->
                                <span>${selectedTeacher.name}</span>
                            </div>
                        </div>
                        <div class="identity-avatar">${avatarHtml}</div>
                    </div>`;
            } else if (selectedTeacherId === 'none') {
                identityHtml = `
                    <div class="card-row-identity general-mode">
                        <div class="teacher-info-box">
                            <span class="label">المنهج الدراسي</span>
                            <div class="teacher-name-row">
                                <i class="fas fa-globe"></i>
                                <span>المنهج العام</span>
                            </div>
                        </div>
                        <div class="identity-avatar">
                            <div class="avatar-placeholder"><i class="fas fa-globe"></i></div>
                        </div>
                    </div>`;
            } else {
                identityHtml = `
                    <div class="card-row-identity needs-selection">
                        <div class="teacher-info-box">
                            <span class="label">تنبيه</span>
                            <div class="teacher-name-row select-prompt">
                                <i class="fas fa-plus-circle"></i>
                                <span>اختار مدرسك</span>
                            </div>
                        </div>
                        <div class="identity-avatar blur-avatar">
                            <div class="avatar-placeholder"><i class="fas fa-user-tie"></i></div>
                        </div>
                    </div>`;
            }
        } else {
            // Subject with no teachers
            identityHtml = `
                <div class="card-row-identity">
                    <div class="teacher-info-box">
                        <span class="label">المادة</span>
                        <div class="teacher-name-row">
                            <i class="fas ${iconClass}"></i>
                            <span>تصفح المحاضرات</span>
                        </div>
                    </div>
                </div>`;
        }

        return `
            <div class="subject-modern-card" id="card-${subject.id}" onclick="openTimeline('${subject.id}', '${subject.name_ar}')">
                ${headerHtml}
                ${identityHtml}
                
                <div class="card-progress-section">
                    <div class="prog-stats-row">
                        <span class="prog-label">التقدم الدراسي</span>
                        <span class="card-percent-text ${percent === 100 ? 'success' : ''}">
                            ${percent}%
                            ${percent === 100 ? '<i class="fas fa-check-circle" style="margin-right: 4px;"></i>' : ''}
                        </span>
                    </div>
                    <div class="prog-bar-container">
                        <div class="prog-bar-fill ${percent < 30 ? 'warning' : (percent === 100 ? 'success' : '')}" style="width: ${percent}%"></div>
                    </div>
                </div>

                ${lastLecture ? `
                    <div class="last-lecture-footer">
                        <div class="footer-icon"><i class="far fa-clock"></i></div>
                        <div class="footer-content">
                            <small>آخر محاضرة</small>
                            <span class="last-lecture-text">${lastLecture.title}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}


function updateOverallStats() {
    // This function should ideally calculate based on the *user's selected curriculum*
    // For now, it calculates based on all curriculum, which might be misleading if teachers are selected.
    // A more robust solution would involve re-calculating globalCurriculum based on preferences or passing filtered data.
    const total = globalCurriculum.length;
    const done = globalCurriculum.filter(c => globalProgress.some(p => p.lecture_id === c.id && p.is_completed)).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    const ring = document.getElementById('overallRing');
    const percentText = document.getElementById('overallPercentText');
    const statusText = document.getElementById('overallStatsStatus');

    if (ring) {
        const offset = 283 - (percent / 100) * 283;
        ring.style.strokeDashoffset = offset;
    }
    if (percentText) percentText.textContent = `${percent}%`;
    if (statusText) {
        statusText.textContent = total === 0 ? 'مفيش محاضرات اتضافت دلوقتي' : `خلصت ${done} من ${total} محاضرة 🚀`;
    }
}

function updateSubjectCardUI(subjectId) {
    const card = document.getElementById(`card-${subjectId}`);
    if (!card) return;

    const subjectTeachers = globalTeachers[subjectId] || [];
    const pref = globalPreferences[subjectId];
    const selectedTeacherId = pref ? pref.teacher_id : null;

    let relevantCurriculum = [];
    if (selectedTeacherId && selectedTeacherId !== 'none') {
        relevantCurriculum = globalCurriculum.filter(c => c.subject_id === subjectId && c.teacher_id === selectedTeacherId);
    } else {
        relevantCurriculum = globalCurriculum.filter(c => c.subject_id === subjectId && !c.teacher_id);
    }

    const total = relevantCurriculum.length;
    const done = relevantCurriculum.filter(c => globalProgress.some(p => p.lecture_id === c.id && p.is_completed)).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    const percentText = card.querySelector('.card-percent-text');
    const progressFill = card.querySelector('.prog-bar-fill');

    if (percentText) {
        percentText.innerHTML = `${percent}% ${percent === 100 ? '<i class="fas fa-check-circle" style="margin-right: 4px;"></i>' : ''}`;
        percentText.classList.toggle('success', percent === 100);
    }

    if (progressFill) {
        progressFill.style.width = `${percent}%`;
        // Sync dynamic color classes
        progressFill.classList.toggle('warning', percent < 30);
        progressFill.classList.toggle('success', percent === 100);
    }
}

function updateAdminVisibility(profile) {
    const adminBtn = document.getElementById('adminNavBtn');
    const bottomAdminBtn = document.getElementById('bottomAdminBtn');
    const userNameEl = document.getElementById('navUserName');

    if (userNameEl && profile.full_name) userNameEl.textContent = profile.full_name.split(' ')[0];
    if (profile.role === 'admin') {
        if (adminBtn) adminBtn.style.display = 'block';
        if (bottomAdminBtn) bottomAdminBtn.style.display = 'flex';
    }
}

window.openTimeline = async (subjectId, subjectName) => {
    const modal = document.getElementById('timelineModal');
    const list = document.getElementById('timelineList');
    const nameEl = document.getElementById('modalSubjectName');
    const progEl = document.getElementById('modalSubjectProgress');

    nameEl.textContent = subjectName;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    list.innerHTML = '<div style="text-align:center; padding: 5rem;"><div class="custom-spinner" style="margin: 0 auto;"></div></div>';

    try {
        const subjectTeachers = globalTeachers[subjectId] || [];
        const pref = globalPreferences[subjectId];
        const selectedTeacherId = pref ? pref.teacher_id : null;

        // If subject has teachers but student hasn't chosen one yet → show picker
        if (subjectTeachers.length > 0 && !selectedTeacherId) {
            list.innerHTML = renderTeacherPicker(subjectId, subjectName, subjectTeachers);
            if (progEl) progEl.textContent = 'اختار مدرسك أول';
            return;
        }

        // Build the query — filter by teacher if one is selected
        let query = supabase
            .from('college_curriculum')
            .select('*')
            .eq('subject_id', subjectId)
            .order('lecture_date', { ascending: false });

        if (selectedTeacherId && selectedTeacherId !== 'none') {
            query = query.eq('teacher_id', selectedTeacherId);
        } else if (selectedTeacherId === 'none') {
            query = query.is('teacher_id', null);
        }
        // If selectedTeacherId is null (no preference yet, but no teachers for subject), no teacher_id filter is applied.
        // This means it will show all lectures for the subject, including those with teacher_id = null.

        const { data: curriculum } = await query;

        // Show teacher name + change button if a teacher is selected
        const selectedTeacher = subjectTeachers.find(t => t.id === selectedTeacherId);
        let teacherHeaderHtml = '';
        if (subjectTeachers.length > 0) { // Only show this header if there are teachers to choose from
            teacherHeaderHtml = `
                <div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:#f0f9ff;border-radius:12px;margin-bottom:1rem;border:1px solid #bae6fd;">
                    <i class="fas ${selectedTeacherId === 'none' ? 'fa-globe' : 'fa-user-tie'}" style="color:#0288D1;"></i>
                    <span style="font-weight:700;color:#0f172a;flex:1;">
                        ${selectedTeacher ? `مدرسك: ${selectedTeacher.name}` : 'المنهج العام'}
                    </span>
                    <button onclick="window.changeTeacher('${subjectId}', '${subjectName}')" 
                        style="background:none;border:1px solid #94a3b8;border-radius:8px;padding:4px 10px;font-size:0.8rem;cursor:pointer;color:#64748b;font-family:inherit;">
                        تغيير
                    </button>
                </div>`;
        }

        const progressSet = new Set(globalProgress.filter(p => p.is_completed).map(p => p.lecture_id));
        const doneCount = (curriculum || []).filter(c => progressSet.has(c.id)).length;
        const totalCount = (curriculum || []).length;

        if (progEl) progEl.textContent = `${doneCount}/${totalCount} مكتمل`;

        if (!curriculum || curriculum.length === 0) {
            list.innerHTML = teacherHeaderHtml + '<div style="text-align:center; padding: 4rem; color: #94a3b8;">مفيش محاضرات اتضافت دلوقتي</div>';
            return;
        }

        list.innerHTML = teacherHeaderHtml + curriculum.map(item => {
            const isDone = progressSet.has(item.id);
            const dateStr = new Date(item.lecture_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });

            return `
                <div class="lesson-row ${isDone ? 'is-completed' : ''}" onclick="event.stopPropagation();">
                    <div class="lesson-status-icon" onclick="toggleLectureProgress('${item.id}', this, '${subjectId}', '${subjectName}')">
                        <i class="fas fa-check"></i>
                    </div>

                    <div class="lesson-info-box" onclick="toggleLectureProgress('${item.id}', this.parentElement.querySelector('.lesson-status-icon'), '${subjectId}', '${subjectName}')">
                        <div class="lesson-title-meta">
                           <span class="date">${dateStr}</span>
                           <div class="lesson-tags">
                                <div class="lesson-tag-mini ${item.mode === 'online' ? 'tag-online' : 'tag-f2f'}">
                                    <i class="fas ${item.mode === 'online' ? 'fa-video' : 'fa-users'}"></i>
                                    ${item.mode === 'online' ? 'أونلاين' : 'في السنتر'}
                                </div>
                           </div>
                        </div>
                        <h3 class="lesson-name">${item.title}</h3>
                    </div>

                    <div class="lesson-actions-mini">
                        ${item.link_url ? `
                            <a href="${item.link_url}" target="_blank" class="action-icon-btn watch" title="مشاهدة المحاضرة">
                                <i class="fas fa-play"></i>
                            </a>
                        ` : ''}
                        ${item.exam_id ? `
                            <a href="exam.html?id=${item.exam_id}" class="action-icon-btn exam" title="ابدأ التدريب">
                                <i class="fas fa-tasks"></i>
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Timeline Error:", err);
        list.innerHTML = `<p style="text-align:center; color:red; padding:2rem;">حدث خطأ في تحميل البيانات</p>`;
    }
};

function renderTeacherPicker(subjectId, subjectName, teachers) {
    const pref = globalPreferences[subjectId];
    const currentTeacherId = pref ? pref.teacher_id : null;

    return `
        <div style="padding:1rem;">
            <div style="text-align:center;margin-bottom:1.5rem;">
                <div style="width:60px;height:60px;background:#e0f2fe;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem;font-size:1.5rem;color:#0288D1;">
                    <i class="fas fa-chalkboard-teacher"></i>
                </div>
                <h3 style="margin:0 0 0.25rem;font-weight:800;">اختار مدرسك</h3>
                <p style="color:#64748b;margin:0;font-size:0.9rem;">اختار المدرس اللي بتروح عنده في ${subjectName}</p>
            </div>
            <div style="display:flex;flex-direction:column;gap:1rem;">
                <!-- General Option -->
                <div class="teacher-option ${currentTeacherId === 'none' ? 'active' : ''}" 
                     onclick="window.selectTeacher('${subjectId}', '${subjectName.replace(/'/g, "\\'")}', 'none')"
                     style="display:flex;align-items:center;gap:12px;padding:12px;border:2px solid ${currentTeacherId === 'none' ? '#03A9F4' : '#e2e8f0'};border-radius:12px;cursor:pointer;transition:all 0.2s;background:${currentTeacherId === 'none' ? '#f0f9ff' : 'white'};">
                    <div style="width:48px;height:48px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:1.25rem;color:#64748b;"><i class="fas fa-globe"></i></div>
                    <div style="flex:1;">
                        <strong style="display:block;color:#1e293b;font-size:1rem;">المنهج العام (بدون مدرس)</strong>
                        <small style="color:#64748b;">هيظهرلك المحاضرات الأساسية للمادة</small>
                    </div>
                </div>

                ${teachers.map(t => `
                    <div class="teacher-option ${currentTeacherId === t.id ? 'active' : ''}" 
                         onclick="window.selectTeacher('${subjectId}', '${subjectName.replace(/'/g, "\\'")}', '${t.id}', '${t.name.replace(/'/g, "\\'")}')"
                         style="display:flex;align-items:center;gap:12px;padding:12px;border:2px solid ${currentTeacherId === t.id ? '#03A9F4' : '#e2e8f0'};border-radius:12px;cursor:pointer;transition:all 0.2s;background:${currentTeacherId === t.id ? '#f0f9ff' : 'white'};">
                        <div style="width:48px;height:48px;border-radius:50%;background:#e0f2fe;display:flex;align-items:center;justify-content:center;font-size:1.25rem;color:#0288D1;flex-shrink:0;overflow:hidden;">
                            ${t.avatar_url ? `<img src="${t.avatar_url}" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fas fa-user-tie"></i>`}
                        </div>
                        <div style="flex:1;">
                            <strong style="display:block;color:#1e293b;font-size:1rem;">${t.name}</strong>
                            ${t.bio ? `<small style="color:#64748b;">${t.bio}</small>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

window.selectTeacher = async (subjectId, subjectName, teacherId, teacherName) => {
    // 1. Check Cooldown (24 Hours)
    const existingPref = globalPreferences[subjectId];
    if (existingPref && existingPref.updated_at) {
        const lastUpdate = new Date(existingPref.updated_at);
        const now = new Date();
        const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

        if (diffHours < 24) {
            const remainingSec = Math.ceil((24 - diffHours) * 3600);
            window.closeTimeline(); // Close modal first
            Swal.fire({
                title: 'تغيير المدرس غير متاح الآن',
                html: `تقدر تغير المدرس مرة واحدة كل 24 ساعة لضمان استقرار دراستك.<br><br><b>الوقت المتبقي:</b> ${formatRemainingTime(remainingSec)}`,
                icon: 'warning',
                confirmButtonText: 'تمام',
                confirmButtonColor: '#03A9F4'
            });
            return;
        }
    }

    const list = document.getElementById('timelineList');
    if (list) list.innerHTML = '<div style="text-align:center;padding:3rem;"><div class="custom-spinner" style="margin:auto;"></div></div>';

    // If teacherId is 'none', save as null in the database
    const dbTeacherId = teacherId === 'none' ? null : teacherId;
    const nowIso = new Date().toISOString();

    const { error } = await supabase
        .from('student_teacher_preferences')
        .upsert({
            profile_id: currentUserId,
            subject_id: subjectId,
            teacher_id: dbTeacherId,
            updated_at: nowIso
        }, { onConflict: 'profile_id, subject_id' });

    if (error) {
        console.error('Error saving teacher preference:', error);
        return;
    }

    // Update local state
    globalPreferences[subjectId] = {
        teacher_id: teacherId,
        updated_at: nowIso
    };

    renderSubjectsGrid();
    updateOverallStats();
    await window.openTimeline(subjectId, subjectName);
};

window.changeTeacher = async (subjectId, subjectName) => {
    // 1. Check Cooldown (24 Hours)
    const pref = globalPreferences[subjectId];
    if (pref && pref.updated_at) {
        const lastUpdate = new Date(pref.updated_at);
        const now = new Date();
        const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

        if (diffHours < 24) {
            const remainingSec = Math.ceil((24 - diffHours) * 3600);
            window.closeTimeline(); // Close modal first
            Swal.fire({
                title: 'تنبيه: القيد الزمني',
                html: `تقدر تغير اختيار المدرس مرة كل 24 ساعة.<br>سيكون الخيار متاحاً بعد: <b>${formatRemainingTime(remainingSec)}</b>`,
                icon: 'warning',
                confirmButtonText: 'فهمت',
                confirmButtonColor: '#03A9F4'
            });
            return;
        }
    }

    const subjectTeachers = globalTeachers[subjectId] || [];
    if (subjectTeachers.length === 0) return;

    const list = document.getElementById('timelineList');
    const progEl = document.getElementById('modalSubjectProgress');

    list.innerHTML = renderTeacherPicker(subjectId, subjectName, subjectTeachers);
    if (progEl) progEl.textContent = 'اختار مدرسك أول';
};

function formatRemainingTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours} ساعة و ${minutes} دقيقة`;
    }
    return `${minutes} دقيقة`;
}

window.closeTimeline = () => {
    document.getElementById('timelineModal').style.display = 'none';
    document.body.style.overflow = '';
};

window.toggleLectureProgress = async (lectureId, iconEl, subjectId, subjectName) => {
    const parentRow = iconEl.closest('.lesson-row');
    const isNowDone = !parentRow.classList.contains('is-completed');
    const { data: { user } } = await supabase.auth.getUser();

    try {
        // Optimistic UI update for the row
        parentRow.classList.toggle('is-completed');

        // Update local globalProgress state immediately
        const existingIdx = globalProgress.findIndex(p => p.lecture_id === lectureId);
        if (existingIdx > -1) {
            globalProgress[existingIdx].is_completed = isNowDone;
        } else {
            globalProgress.push({ lecture_id: lectureId, is_completed: isNowDone, user_id: user.id });
        }

        // Sync with database
        const { error } = await supabase
            .from('user_curriculum_progress')
            .upsert({
                user_id: user.id,
                lecture_id: lectureId,
                is_completed: isNowDone,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, lecture_id' });

        if (error) throw error;

        // Play sound effect after successful update
        if (isNowDone) {
            playSuccessSound();
        } else {
            playUndoSound();
        }

        // Update all UI components in real-time
        updateModalProgressUI(subjectId);
        updateSubjectCardUI(subjectId);
        updateOverallStats();

    } catch (err) {
        console.error("Toggle progress error:", err);
        // Rollback local state and UI
        parentRow.classList.toggle('is-completed');
        const existingIdx = globalProgress.findIndex(p => p.lecture_id === lectureId);
        if (existingIdx > -1) globalProgress[existingIdx].is_completed = !isNowDone;
    }
};

function updateModalProgressUI(subjectId) {
    const doneCountEl = document.getElementById('modalSubjectProgress');
    if (!doneCountEl) return;

    const selectedTeacherId = globalPreferences[subjectId] || null;

    let relevantCurriculum = [];
    if (selectedTeacherId && selectedTeacherId !== 'none') {
        relevantCurriculum = globalCurriculum.filter(c => c.subject_id === subjectId && c.teacher_id === selectedTeacherId);
    } else {
        relevantCurriculum = globalCurriculum.filter(c => c.subject_id === subjectId && !c.teacher_id);
    }

    const total = relevantCurriculum.length;
    const done = relevantCurriculum.filter(c => globalProgress.some(p => p.lecture_id === c.id && p.is_completed)).length;

    doneCountEl.textContent = `${done}/${total} مكتمل`;
}
