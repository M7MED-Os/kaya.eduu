/**
 * admin-lessons.js
 * Teacher & Lesson Management Module
 * يمكن استخدامه بشكل مستقل في أي مشروع Supabase مشابه
 */

import {
    supabase,
    showView,
    openModal,
    closeModal,
    showErrorAlert,
    showSuccessAlert
} from './admin-core.js';

// ─── State ────────────────────────────────────────────────────
let currentSubject = null;    // المادة المختارة حالياً
let currentTeacher = null;    // المدرس المختار حالياً

// ─── Entry Point ──────────────────────────────────────────────

/**
 * يُستدعى عند الضغط على "إدارة الدروس" في الشريط الجانبي
 */
export async function showLessonsManagementView() {
    // إخفاء الـ view الحالي وإظهار الـ view الجديد
    showView('lessonsManagementView');

    // ضبط cursor
    currentSubject = null;
    currentTeacher = null;

    await loadSubjectsList();
}

// ─── Subjects List ────────────────────────────────────────────

async function loadSubjectsList() {
    const container = document.getElementById('lm-subjects-list');
    if (!container) return;
    container.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:2rem auto;"></div>';

    const { data: subjects, error } = await supabase
        .from('subjects')
        .select('id, name_ar, academic_year, current_term, icon')
        .eq('is_active', true)
        .order('academic_year', { ascending: false })
        .order('order_index');

    if (error) {
        container.innerHTML = `<p style="color:red;padding:1rem;">${error.message}</p>`;
        return;
    }

    if (!subjects.length) {
        container.innerHTML = '<p class="empty-state" style="padding:1rem;">لا توجد مواد دراسية.</p>';
        return;
    }

    const yearNames = {
        'third_year': 'تالته ثانوي',
        'second_year': 'تانيه ثانوي',
        'first_year': 'أولى ثانوي'
    };

    let html = '';
    // Grade 3 (Full Year)
    const g3 = subjects.filter(s => s.academic_year === 'third_year');
    if (g3.length > 0) {
        html += `<div class="lm-group-title" style="padding:8px 15px; background:#f1f5f9; font-weight:800; color:#475569; font-size:0.75rem; border-bottom:1px solid #e2e8f0; margin-top:5px;">سنة تالتة ثانوي</div>`;
        g3.forEach(s => html += renderSubjectItem(s));
    }

    // Grade 2 & 1 (Terms)
    for (const year of ['second_year', 'first_year']) {
        for (const term of ['first_term', 'second_term']) {
            const yearSubjects = subjects.filter(s => s.academic_year === year && s.current_term === term);
            if (yearSubjects.length > 0) {
                const termLabelStr = term === 'first_term' ? 'ترم اول' : 'ترم تاني';
                html += `<div class="lm-group-title" style="padding:8px 15px; background:#f1f5f9; font-weight:800; color:#475569; font-size:0.75rem; border-bottom:1px solid #e2e8f0; margin-top:5px;">${yearNames[year]} - ${termLabelStr}</div>`;
                yearSubjects.forEach(s => html += renderSubjectItem(s));
            }
        }
    }

    container.innerHTML = html;

    // Reset teachers panel
    const teacherPanel = document.getElementById('lm-teacher-panel');
    const lecturePanel = document.getElementById('lm-lecture-panel');
    if (teacherPanel) teacherPanel.innerHTML = '<div class="lm-placeholder"><i class="fas fa-user-tie"></i><p>اختار مادة عشان تشوف مدرسيها</p></div>';
    if (lecturePanel) lecturePanel.innerHTML = '<div class="lm-placeholder"><i class="fas fa-list"></i><p>اختار مدرس عشان تشوف محاضراته</p></div>';
}

function renderSubjectItem(s) {
    return `
        <div class="lm-subject-item" onclick="window.lmSelectSubject('${s.id}', '${escHtml(s.name_ar)}')" id="lm-subj-${s.id}">
            <i class="fas ${s.icon || 'fa-book'}" style="color:var(--primary-color);width:20px;text-align:center;"></i>
            <span>${escHtml(s.name_ar)}</span>
            <small style="color:#94a3b8;">${academicYearLabel(s.academic_year)} — ${termLabel(s.current_term)}</small>
        </div>
    `;
}

// ─── Select Subject → Load Teachers ──────────────────────────

window.lmSelectSubject = async function (subjectId, subjectName) {
    // Highlight active
    document.querySelectorAll('.lm-subject-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(`lm-subj-${subjectId}`);
    if (activeEl) activeEl.classList.add('active');

    currentSubject = { id: subjectId, name: subjectName };
    currentTeacher = null;

    // Reset lecture panel
    const lecturePanel = document.getElementById('lm-lecture-panel');
    if (lecturePanel) lecturePanel.innerHTML = '<div class="lm-placeholder"><i class="fas fa-list"></i><p>اختار مدرس عشان تشوف محاضراته</p></div>';

    await loadTeachersForSubject(subjectId);
};

async function loadTeachersForSubject(subjectId) {
    const panel = document.getElementById('lm-teacher-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:2rem auto;"></div>';

    const { data: teachers, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('subject_id', subjectId)
        .order('order_index');

    if (error) {
        panel.innerHTML = `<p style="color:red;padding:1rem;">${error.message}</p>`;
        return;
    }

    panel.innerHTML = `
        <div class="lm-panel-header">
            <span>مدرسو ${escHtml(currentSubject.name)}</span>
            <button class="btn btn-primary btn-sm" onclick="window.lmAddTeacher()">
                <i class="fas fa-plus"></i> مدرس جديد
            </button>
        </div>
        <div id="lm-teachers-list">
            <!-- General Curriculum Option -->
            <div class="lm-teacher-item" onclick="window.lmSelectTeacher('none', 'المنهج العام')" id="lm-teach-none">
                <div class="lm-teacher-avatar" style="background:#f1f5f9;color:#94a3b8;">
                    <i class="fas fa-globe"></i>
                </div>
                <div class="lm-teacher-info">
                    <strong>المنهج العام</strong>
                    <small>محاضرات غير مرتبطة بمدرس</small>
                </div>
            </div>
            
            ${teachers.length ? teachers.map(t => renderTeacherItem(t)).join('') : ''}
        </div>
    `;
}

function renderTeacherItem(teacher) {
    return `
        <div class="lm-teacher-item ${teacher.is_active ? '' : 'inactive'}" 
             onclick="window.lmSelectTeacher('${teacher.id}', '${escHtml(teacher.name)}')" 
             id="lm-teach-${teacher.id}">
            <div class="lm-teacher-avatar">
                ${teacher.avatar_url ? `<img src="${escHtml(teacher.avatar_url)}" alt="">` : `<i class="fas fa-user-tie"></i>`}
            </div>
            <div class="lm-teacher-info">
                <strong>${escHtml(teacher.name)}</strong>
                ${teacher.bio ? `<small>${escHtml(teacher.bio)}</small>` : ''}
            </div>
            <div class="lm-teacher-actions">
                <button class="btn-icon" title="تعديل" onclick="event.stopPropagation(); window.lmEditTeacher('${teacher.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon danger" title="حذف" onclick="event.stopPropagation(); window.lmDeleteTeacher('${teacher.id}', '${escHtml(teacher.name)}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// ─── Add / Edit Teacher ───────────────────────────────────────

window.lmAddTeacher = function () {
    if (!currentSubject) return;
    openModal({
        title: `إضافة مدرس — ${currentSubject.name}`,
        body: `
            <div class="form-group">
                <label>اسم المدرس <span style="color:red">*</span></label>
                <input type="text" id="lm-teacher-name" class="form-control" placeholder="مثال: مستر محمد صلاح">
            </div>
            <div class="form-group">
                <label>صورة المدرس (رابط URL)</label>
                <input type="url" id="lm-teacher-avatar" class="form-control" placeholder="https://...">
            </div>
            <div class="form-group">
                <label>ملاحظة / بيو</label>
                <input type="text" id="lm-teacher-bio" class="form-control" placeholder="مثال: مدرس متميز — مركز النجاح">
            </div>
        `,
        onSave: async () => {
            const name = document.getElementById('lm-teacher-name').value.trim();
            if (!name) { showErrorAlert('اكتب اسم المدرس'); return; }

            const { error } = await supabase.from('teachers').insert({
                subject_id: currentSubject.id,
                name,
                avatar_url: document.getElementById('lm-teacher-avatar').value.trim() || null,
                bio: document.getElementById('lm-teacher-bio').value.trim() || null,
            });

            if (error) { showErrorAlert(error.message); return; }
            closeModal();
            showSuccessAlert('تم إضافة المدرس!');
            await loadTeachersForSubject(currentSubject.id);
        }
    });
};

window.lmEditTeacher = async function (teacherId) {
    const { data: teacher } = await supabase.from('teachers').select('*').eq('id', teacherId).single();
    if (!teacher) return;

    openModal({
        title: `تعديل المدرس — ${teacher.name}`,
        body: `
            <div class="form-group">
                <label>اسم المدرس</label>
                <input type="text" id="lm-edit-name" class="form-control" value="${escHtml(teacher.name)}">
            </div>
            <div class="form-group">
                <label>صورة (URL)</label>
                <input type="url" id="lm-edit-avatar" class="form-control" value="${escHtml(teacher.avatar_url || '')}">
            </div>
            <div class="form-group">
                <label>بيو</label>
                <input type="text" id="lm-edit-bio" class="form-control" value="${escHtml(teacher.bio || '')}">
            </div>
            <div class="form-group" style="display:flex;align-items:center;gap:10px;">
                <input type="checkbox" id="lm-edit-active" style="width:18px;height:18px;" ${teacher.is_active ? 'checked' : ''}>
                <label for="lm-edit-active" style="cursor:pointer">مفعّل</label>
            </div>
        `,
        onSave: async () => {
            const { error } = await supabase.from('teachers').update({
                name: document.getElementById('lm-edit-name').value.trim(),
                avatar_url: document.getElementById('lm-edit-avatar').value.trim() || null,
                bio: document.getElementById('lm-edit-bio').value.trim() || null,
                is_active: document.getElementById('lm-edit-active').checked,
            }).eq('id', teacherId);

            if (error) { showErrorAlert(error.message); return; }
            closeModal();
            showSuccessAlert('تم التعديل!');
            await loadTeachersForSubject(currentSubject.id);
        }
    });
};

window.lmDeleteTeacher = async function (teacherId, teacherName) {
    const result = await Swal.fire({
        title: `حذف "${teacherName}"؟`,
        text: 'هتتحذف كل محاضراته المرتبطة بيه!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'إلغاء',
        confirmButtonText: 'حذف'
    });

    if (!result.isConfirmed) return;

    const { error } = await supabase.from('teachers').delete().eq('id', teacherId);
    if (error) { showErrorAlert(error.message); return; }
    showSuccessAlert('تم الحذف');
    if (currentTeacher?.id === teacherId) {
        currentTeacher = null;
        const lecturePanel = document.getElementById('lm-lecture-panel');
        if (lecturePanel) lecturePanel.innerHTML = '<div class="lm-placeholder"><i class="fas fa-list"></i><p>اختار مدرس عشان تشوف محاضراته</p></div>';
    }
    await loadTeachersForSubject(currentSubject.id);
};

// ─── Select Teacher → Load Lectures ──────────────────────────

window.lmSelectTeacher = async function (teacherId, teacherName) {
    document.querySelectorAll('.lm-teacher-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(teacherId === 'none' ? 'lm-teach-none' : `lm-teach-${teacherId}`);
    if (activeEl) activeEl.classList.add('active');

    currentTeacher = { id: teacherId, name: teacherName };
    await loadLecturesForTeacher(teacherId);
};

async function loadLecturesForTeacher(teacherId) {
    const panel = document.getElementById('lm-lecture-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:2rem auto;"></div>';

    let query = supabase
        .from('college_curriculum')
        .select('*')
        .eq('subject_id', currentSubject.id)
        .order('lecture_date', { ascending: false });

    if (teacherId === 'none') {
        query = query.is('teacher_id', null);
    } else {
        query = query.eq('teacher_id', teacherId);
    }

    const { data: lectures, error } = await query;

    if (error) {
        panel.innerHTML = `<p style="color:red;padding:1rem;">${error.message}</p>`;
        return;
    }

    panel.innerHTML = `
        <div class="lm-panel-header">
            <span>محاضرات ${escHtml(currentTeacher.name)}</span>
            <button class="btn btn-primary btn-sm" onclick="window.lmAddLecture()">
                <i class="fas fa-plus"></i> محاضرة جديدة
            </button>
        </div>
        <div id="lm-lectures-list">
            ${lectures.length
            ? lectures.map(l => renderLectureItem(l)).join('')
            : '<p class="empty-state" style="padding:1rem;">لا توجد محاضرات بعد.</p>'
        }
        </div>
    `;
}

function renderLectureItem(lec) {
    const dateStr = lec.lecture_date
        ? new Date(lec.lecture_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
    const isOnline = lec.mode === 'online';
    const modeColour = isOnline ? '#0284c7' : '#059669';
    const modeIcon = isOnline ? 'fa-video' : 'fa-users';
    const modeLabel = isOnline ? 'أونلاين' : 'حضوري';
    return `
        <div class="lm-lecture-item" id="lm-lec-${lec.id}">
            <div class="lm-lecture-meta">
                <span class="lm-date"><i class="far fa-calendar-alt" style="margin-left:4px;"></i>${dateStr}</span>
                <span style="background:${modeColour}18;color:${modeColour};padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">
                    <i class="fas ${modeIcon}"></i> ${modeLabel}
                </span>
                ${lec.link_url ? `<a href="${escHtml(lec.link_url)}" target="_blank" style="color:#6366f1;font-size:0.75rem;"><i class="fas fa-play-circle"></i> فيديو</a>` : ''}
                ${lec.exam_id ? `<span style="color:#f59e0b;font-size:0.75rem;"><i class="fas fa-file-alt"></i> امتحان</span>` : ''}
            </div>
            <div class="lm-lecture-title">${escHtml(lec.title)}</div>
            <div class="lm-lecture-actions">
                <button class="btn-icon" title="تعديل" onclick="window.lmEditLecture('${lec.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon danger" title="حذف" onclick="window.lmDeleteLecture('${lec.id}', '${escHtml(lec.title)}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
}

// ─── Helper: fetch exams for current subject ─────────────────
async function fetchExamsForSubject() {
    if (!currentSubject) return [];
    const { data } = await supabase
        .from('exams')
        .select('id, title')
        .eq('subject_id', currentSubject.id)
        .order('title');
    return data || [];
}

function buildLectureFormBody({ lec = null, exams = [] } = {}) {
    const isEdit = !!lec;
    const today = new Date().toISOString().slice(0, 10);
    const currentMode = lec?.mode || 'online';
    const examOptions = exams.map(e =>
        `<option value="${e.id}" ${lec?.exam_id === e.id ? 'selected' : ''}>${escHtml(e.title)}</option>`
    ).join('');

    return `
        <!-- عنوان -->
        <div class="form-group">
            <label>عنوان الدرس <span style="color:red">*</span></label>
            <input type="text" id="lm-f-title" class="form-control"
                placeholder="مثال: مراجعة الباب الأول — الدرس 1"
                value="${escHtml(lec?.title || '')}">
        </div>

        <!-- تاريخ -->
        <div class="form-group">
            <label>تاريخ الدرس</label>
            <input type="date" id="lm-f-date" class="form-control"
                value="${lec?.lecture_date || today}">
        </div>

        <!-- نوع الدرس -->
        <div class="form-group">
            <label>نوع الدرس</label>
            <div style="display:flex;gap:0.75rem;">
                <label style="flex:1;cursor:pointer;">
                    <input type="radio" name="lm-f-mode" value="online" ${currentMode === 'online' ? 'checked' : ''}>
                    <span style="display:inline-flex;align-items:center;gap:6px;background:#e0f2fe;color:#0284c7;padding:8px 16px;border-radius:10px;font-weight:700;width:100%;justify-content:center;margin-top:4px;">
                        <i class="fas fa-video"></i> أونلاين
                    </span>
                </label>
                <label style="flex:1;cursor:pointer;">
                    <input type="radio" name="lm-f-mode" value="f2f" ${currentMode === 'f2f' ? 'checked' : ''}>
                    <span style="display:inline-flex;align-items:center;gap:6px;background:#dcfce7;color:#059669;padding:8px 16px;border-radius:10px;font-weight:700;width:100%;justify-content:center;margin-top:4px;">
                        <i class="fas fa-users"></i> سنتر / حضوري
                    </span>
                </label>
            </div>
        </div>

        <!-- لينك الفيديو -->
        <div class="form-group">
            <label><i class="fas fa-play-circle" style="color:#6366f1;margin-left:6px;"></i>لينك الفيديو / الدرس <span style="color:#94a3b8;font-weight:400;">اختياري</span></label>
            <input type="url" id="lm-f-url" class="form-control"
                placeholder="https://youtube.com/..."
                value="${escHtml(lec?.link_url || '')}">
        </div>

        <!-- الامتحان الخاص بالدرس -->
        <div class="form-group">
            <label><i class="fas fa-file-alt" style="color:#f59e0b;margin-left:6px;"></i>امتحان الدرس <span style="color:#94a3b8;font-weight:400;">اختياري</span></label>
            ${exams.length
            ? `<select id="lm-f-exam" class="form-control">
                        <option value="">— بدون امتحان —</option>
                        ${examOptions}
                   </select>`
            : `<p style="color:#94a3b8;font-size:0.85rem;margin:0;">(مفيش امتحانات مضافة لهذه المادة لحد الآن)</p>`
        }
        </div>
    `;
}

function getLectureFormValues() {
    const modeRadio = document.querySelector('input[name="lm-f-mode"]:checked');
    const examEl = document.getElementById('lm-f-exam');
    return {
        title: document.getElementById('lm-f-title')?.value.trim(),
        lecture_date: document.getElementById('lm-f-date')?.value || null,
        mode: modeRadio ? modeRadio.value : 'online',
        link_url: document.getElementById('lm-f-url')?.value.trim() || null,
        exam_id: examEl?.value || null,
    };
}

// ─── Add Lecture ──────────────────────────────────────────────

window.lmAddLecture = async function () {
    if (!currentTeacher || !currentSubject) return;
    const exams = await fetchExamsForSubject();
    openModal({
        title: `إضافة درس — ${currentTeacher.name}`,
        body: buildLectureFormBody({ exams }),
        onSave: async () => {
            const vals = getLectureFormValues();
            if (!vals.title) { showErrorAlert('اكتب عنوان الدرس'); return; }

            const { error } = await supabase.from('college_curriculum').insert({
                subject_id: currentSubject.id,
                teacher_id: currentTeacher.id === 'none' ? null : currentTeacher.id,
                title: vals.title,
                lecture_date: vals.lecture_date,
                mode: vals.mode,
                link_url: vals.link_url,
                exam_id: vals.exam_id,
            });

            if (error) { showErrorAlert(error.message); return; }
            closeModal();
            showSuccessAlert('تم إضافة الدرس!');
            await loadLecturesForTeacher(currentTeacher.id);
        }
    });
};

// ─── Edit Lecture ─────────────────────────────────────────────

window.lmEditLecture = async function (lectureId) {
    const [lecRes, exams] = await Promise.all([
        supabase.from('college_curriculum').select('*').eq('id', lectureId).single(),
        fetchExamsForSubject()
    ]);
    const lec = lecRes.data;
    if (!lec) return;

    openModal({
        title: 'تعديل الدرس',
        body: buildLectureFormBody({ lec, exams }),
        onSave: async () => {
            const vals = getLectureFormValues();
            if (!vals.title) { showErrorAlert('اكتب عنوان الدرس'); return; }

            const { error } = await supabase.from('college_curriculum').update({
                title: vals.title,
                lecture_date: vals.lecture_date,
                mode: vals.mode,
                link_url: vals.link_url,
                exam_id: vals.exam_id,
            }).eq('id', lectureId);

            if (error) { showErrorAlert(error.message); return; }
            closeModal();
            showSuccessAlert('تم التعديل!');
            await loadLecturesForTeacher(currentTeacher.id);
        }
    });
};

window.lmDeleteLecture = async function (lectureId, title) {
    const result = await Swal.fire({
        title: `حذف "${title}"؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'إلغاء',
        confirmButtonText: 'حذف'
    });
    if (!result.isConfirmed) return;

    const { error } = await supabase.from('college_curriculum').delete().eq('id', lectureId);
    if (error) { showErrorAlert(error.message); return; }
    showSuccessAlert('تم الحذف');
    await loadLecturesForTeacher(currentTeacher.id);
};

// ─── Helpers ──────────────────────────────────────────────────

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function academicYearLabel(val) {
    const map = { first_year: 'أولى', second_year: 'تانية', third_year: 'تالتة' };
    return map[val] || val || '—';
}

function termLabel(val) {
    const map = { first_term: 'ترم 1', second_term: 'ترم 2' };
    return map[val] || val || '—';
}

// Expose to window for global onclick access in admin.html
window.showLessonsManagementView = showLessonsManagementView;
