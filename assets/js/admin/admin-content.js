/**
 * Admin Content Module
 * Chapter/Lesson/Exam tree management and editors
 */

import {
    supabase,
    currentContext,
    showView,
    openModal,
    closeModal,
    showWarningAlert,
    showErrorAlert,
    showSuccessAlert
} from './admin-core.js';

import { renderExamQuestions } from './admin-questions.js';

/**
 * Open subject manager view
 */
export async function openSubjectManager(subjectId) {
    const { data: subject } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
    if (!subject) return;

    currentContext.subject = subject;
    document.getElementById('pageTitle').textContent = `الرئيسية > ${subject.name_ar}`;

    showView('subjectManagerView');
    await loadContentTree();
}

/**
 * Load content tree (chapters → lessons → exams)
 */
export async function loadContentTree() {
    const treeContainer = document.getElementById('contentTree');
    treeContainer.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';

    // Fetch all for this subject
    const { data: chapters } = await supabase.from('chapters')
        .select('*').eq('subject_id', currentContext.subject.id).order('order_index');

    const { data: lessons } = await supabase.from('lessons')
        .select('*').in('chapter_id', chapters.map(c => c.id)).order('order_index');

    const { data: exams } = await supabase.from('exams')
        .select('*')
        .eq('subject_id', currentContext.subject.id)
        .order('order_index', { ascending: true });

    // Build tree
    treeContainer.innerHTML = '';

    if (chapters.length === 0) {
        treeContainer.innerHTML = '<p class="empty-state" style="padding:1rem;">لا توجد أبواب.</p>';
        return;
    }

    chapters.forEach(chapter => {
        const chNode = createTreeNode({ type: 'chapter', data: chapter, label: chapter.title, icon: 'fa-folder' });
        treeContainer.appendChild(chNode);

        const chLessons = lessons.filter(l => l.chapter_id === chapter.id);
        const chExams = exams.filter(e => e.chapter_id === chapter.id);

        // Render lessons
        chLessons.forEach(lesson => {
            const lNode = createTreeNode({ type: 'lesson', data: lesson, label: lesson.title, icon: 'fa-book-open', indent: 1 });
            treeContainer.appendChild(lNode);

            // Lesson exams
            const lExams = exams.filter(e => e.lesson_id === lesson.id);
            lExams.forEach(exam => {
                const eNode = createTreeNode({ type: 'exam', data: exam, label: exam.title, icon: 'fa-file-alt', indent: 2 });
                treeContainer.appendChild(eNode);
            });
        });

        // Chapter exams (finals)
        chExams.forEach(exam => {
            const eNode = createTreeNode({ type: 'exam', data: exam, label: `${exam.title} (شامل)`, icon: 'fa-star', indent: 1, color: '#00bcd4' });
            treeContainer.appendChild(eNode);
        });
    });
}

/**
 * Create tree node element
 */
export function createTreeNode({ type, data, label, icon, indent = 0, color = '' }) {
    const div = document.createElement('div');
    div.className = `tree-node indent-${indent}`;
    if (color) div.style.color = color;

    div.innerHTML = `
        <div style="display:flex; align-items:center; flex:1;">
            <i class="fas ${icon} node-icon"></i>
            <span class="node-text">${label}</span>
        </div>
        <button class="action-btn-sm" style="background:transparent; color:#6b7280; opacity:0.5;" 
            onclick="event.stopPropagation(); window.openEditNodeModal('${type}', ${JSON.stringify(data).replace(/"/g, '&quot;')})">
            <i class="fas fa-pen" style="font-size:0.7rem;"></i>
        </button>
    `;

    div.onclick = () => {
        document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
        div.classList.add('active');
        openEditor(type, data);
    };

    return div;
}

/**
 * Open add chapter modal
 */
export function openAddChapterModal() {
    if (!currentContext.subject) return showWarningAlert('تنبيه', 'اختر مادة أولاً');

    openModal({
        title: 'إضافة باب جديد',
        body: `
            <div class="form-group">
                <label>عنوان الباب</label>
                <input type="text" id="chTitle" class="form-control" required>
            </div>
            <div class="form-group">
                <label>الترتيب</label>
                <input type="number" id="chOrder" class="form-control" value="0">
            </div>
        `,
        onSave: async () => {
            const title = document.getElementById('chTitle').value;
            const order = document.getElementById('chOrder').value;

            const { error } = await supabase.from('chapters').insert({
                subject_id: currentContext.subject.id,
                title, order_index: order
            });

            if (error) showErrorAlert('خطأ', error.message);
            else { closeModal(); loadContentTree(); showSuccessAlert('تم', 'تمت الإضافة بنجاح'); }
        }
    });
}

/**
 * Open editor based on content type
 */
export function openEditor(type, data) {
    const panel = document.getElementById('editorPanel');

    if (type === 'chapter') {
        panel.innerHTML = `
            <h3>تعديل الباب: ${data.title}</h3>
            <div class="form-actions" style="margin-bottom:2rem;">
                 <button class="btn btn-primary btn-sm" onclick="window.openAddLessonModal('${data.id}')">
                    <i class="fas fa-plus"></i> إضافة درس
                </button>
                 <button class="btn btn-outline btn-sm" onclick="window.openAddExamModal('chapter', '${data.id}')">
                    <i class="fas fa-plus"></i> إضافة امتحان شامل
                </button>
                 <button class="btn btn-outline btn-sm" style="color:red; float:left;" onclick="window.deleteItem('chapters', '${data.id}')">
                    <i class="fas fa-trash"></i> حذف الباب
                </button>
            </div>
        `;
    }
    else if (type === 'lesson') {
        panel.innerHTML = `
            <h3>تعديل الدرس: ${data.title}</h3>
            
            <div class="card card-admin mb-4 mt-3" style="padding: 1.5rem; border: 1px solid #e2e8f0; background: #fff;">
                <h4 style="margin-bottom: 1rem;"><i class="fas fa-graduation-cap"></i> محتوى المحاضرة</h4>
                
                <div class="form-group mb-3">
                    <label>رابط الفيديو (YouTube)</label>
                    <input type="text" id="lessonVideoUrl" class="form-control" value="${data.video_url || ''}" placeholder="https://www.youtube.com/watch?v=...">
                </div>

                <div class="form-group mb-3">
                    <label>نص المحاضرة (HTML المترجم)</label>
                    <textarea id="lessonContent" class="form-control" rows="15" placeholder="" style="font-family: monospace; font-size: 0.9rem;">${data.content || ''}</textarea>
                </div>

                <!-- Freemium Controls -->
                <div style="margin: 1.5rem 0; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <h5 style="margin: 0 0 1rem; font-size: 0.95rem; color: #334155;">
                        <i class="fas fa-crown" style="color: #0ea5e9;"></i> إعدادات الوصول
                    </h5>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0;">
                        <input type="checkbox" id="lessonContentFree" ${data.is_free ? 'checked' : ''} 
                               onchange="window.saveLessonFreemiumSetting('${data.id}', this.checked)"
                               style="width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 0.9rem;">محاضرة مجانية (متاحة للجميع)</span>
                    </label>
                </div>

                <button class="btn btn-primary w-100" onclick="window.saveLectureData('${data.id}')">
                    <i class="fas fa-save"></i> حفظ الفيديو والنص
                </button>
            </div>

            <div class="form-actions" style="margin-top:2rem; padding-top: 1rem; border-top: 1px solid #eee;">
                 <button class="btn btn-outline btn-sm" onclick="window.openAddExamModal('lesson', '${data.id}')">
                    <i class="fas fa-plus"></i> إضافة امتحان
                </button>
                 <button class="btn btn-outline btn-sm" style="color:red; float:left;" onclick="window.deleteItem('lessons', '${data.id}')">
                    <i class="fas fa-trash"></i> حذف الدرس
                </button>
            </div>
        `;
    }
    else if (type === 'exam') {
        renderExamQuestions(data);
    }
    else if (type === 'curriculum') {
        renderCurriculumManager(data.subject_id);
    }
}

/**
 * Render curriculum manager in editor panel
 */
export async function renderCurriculumManager(subjectId) {
    const panel = document.getElementById('editorPanel');
    panel.innerHTML = '<div class="spinner"></div>';

    const { data: lectures, error } = await supabase
        .from('college_curriculum')
        .select('*')
        .eq('subject_id', subjectId)
        .order('lecture_date', { ascending: false });

    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h3>جدول الحصص/المحاضرات</h3>
            <button class="btn btn-primary btn-sm" onclick="window.openAddLectureModal('${subjectId}')">
                <i class="fas fa-plus"></i> إضافة محاضرة
            </button>
        </div>
        
        <div class="table-responsive-wrapper">
            <table class="responsive-table">
                <thead>
                    <tr>
                        <th>المحاضرة</th>
                        <th>التاريخ</th>
                        <th>النوع</th>
                        <th>الروابط</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${lectures && lectures.length > 0 ? lectures.map(l => `
                        <tr>
                            <td style="font-weight:700;">${l.title}</td>
                            <td>${new Date(l.lecture_date).toLocaleDateString('ar-EG')}</td>
                            <td>
                                <span class="badge ${l.mode === 'online' ? 'badge-info' : 'badge-gray'}">
                                    ${l.mode === 'online' ? 'أونلاين' : 'في السنتر'}
                                </span>
                            </td>
                            <td>
                                <div style="display:flex; gap:0.5rem;">
                                    ${l.link_url ? `<i class="fas fa-link" title="فيه لينك" style="color:var(--primary-color);"></i>` : ''}
                                    ${l.exam_id ? `<i class="fas fa-file-alt" title="فيه امتحان" style="color:#10b981;"></i>` : ''}
                                </div>
                            </td>
                            <td>
                                <div style="display:flex; gap:0.5rem;">
                                    <button class="btn btn-outline btn-sm" onclick="window.openEditLectureModal(${JSON.stringify(l).replace(/"/g, '&quot;')}, '${subjectId}')">
                                        <i class="fas fa-pen"></i>
                                    </button>
                                    <button class="btn btn-outline btn-sm" style="color:red;" onclick="window.deleteLecture('${l.id}', '${subjectId}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#94a3b8;">لا توجد محاضرات مضافة</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Open add lecture modal
 */
export async function openAddLectureModal(subjectId) {
    // Fetch exams for this subject to show in dropdown
    const { data: exams } = await supabase.from('exams').select('id, title').eq('subject_id', subjectId).order('title');

    openModal({
        title: 'إضافة حصة/محاضرة',
        body: `
            <div class="form-group mb-3">
                <label>اسم المحاضرة</label>
                <input id="lecTitle" class="form-control" placeholder="مثال: المحاضرة الخامسة - الصدمة">
            </div>
            <div class="form-group mb-3">
                <label>تاريخ المحاضرة</label>
                <input type="date" id="lecDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group mb-3">
                <label>نوع المحاضرة</label>
                <select id="lecMode" class="form-control">
                    <option value="f2f">في السنتر/المنصة (F2F)</option>
                    <option value="online">أونلاين (Online)</option>
                </select>
            </div>
            <div class="form-group mb-3">
                <label>رابط المحاضرة (اختياري)</label>
                <input id="lecLink" class="form-control" placeholder="رابط فيديو أو ملف">
            </div>
            <div class="form-group">
                <label>ربط بامتحان (اختياري)</label>
                <select id="lecExam" class="form-control">
                    <option value="">-- بدون امتحان --</option>
                    ${exams ? exams.map(e => `<option value="${e.id}">${e.title}</option>`).join('') : ''}
                </select>
            </div>
        `,
        onSave: async () => {
            const title = document.getElementById('lecTitle').value;
            const date = document.getElementById('lecDate').value;
            const mode = document.getElementById('lecMode').value;
            const link = document.getElementById('lecLink').value;
            const examId = document.getElementById('lecExam').value;

            if (!title || !date) return showWarningAlert('تنبيه', 'برجاء ملء جميع البيانات');

            const { error } = await supabase.from('college_curriculum').insert({
                subject_id: subjectId,
                title,
                lecture_date: date,
                mode,
                link_url: link || null,
                exam_id: examId || null
            });

            if (error) showErrorAlert('خطأ', error.message);
            else {
                closeModal();
                renderCurriculumManager(subjectId);
                showSuccessAlert('تم', 'تمت إضافة المحاضرة بنجاح');
            }
        }
    });
}

/**
 * Delete lecture
 */
export async function deleteLecture(id, subjectId) {
    const { isConfirmed } = await Swal.fire({
        title: 'حذف المحاضرة؟',
        text: 'سيتم حذف المحاضرة من جدول الحصص/المنصة.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444'
    });

    if (isConfirmed) {
        const { error } = await supabase.from('college_curriculum').delete().eq('id', id);
        if (error) showErrorAlert('خطأ', error.message);
        else renderCurriculumManager(subjectId);
    }
}

/**
 * Open add lesson modal
 */
export function openAddLessonModal(chapterId) {
    openModal({
        title: 'إضافة درس',
        body: `<div class="form-group"><label>العنوان</label><input id="lTitle" class="form-control"></div>`,
        onSave: async () => {
            await supabase.from('lessons').insert({
                chapter_id: chapterId,
                title: document.getElementById('lTitle').value
            });
            closeModal(); loadContentTree();
        }
    });
}

/**
 * Open add exam modal
 */
export function openAddExamModal(parentType, parentId) {
    openModal({
        title: 'إضافة امتحان',
        body: `
            <div class="form-group">
                <label>العنوان</label>
                <input id="eTitle" class="form-control" placeholder="مثال: امتحان الباب الأول">
            </div>
            <div class="form-group">
                <label>مدة الامتحان (بالدقائق)</label>
                <input type="number" id="eTime" class="form-control" value="30" min="1" placeholder="30">
            </div>
            <div style="margin: 1rem 0; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h5 style="margin: 0 0 0.75rem; font-size: 0.9rem; color: #334155;">
                    <i class="fas fa-crown" style="color: #0ea5e9;"></i> إعدادات الوصول
                </h5>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0;">
                    <input type="checkbox" id="examFree" style="width: 18px; height: 18px; cursor: pointer;">
                    <span style="font-size: 0.85rem;">الامتحان مجاني (متاح لغير المشتركين)</span>
                </label>
            </div>
        `,
        onSave: async () => {
            const payload = {
                title: document.getElementById('eTitle').value,
                time_limit: parseInt(document.getElementById('eTime').value) || 30,
                subject_id: currentContext.subject.id,
                is_free: document.getElementById('examFree').checked // Save directly to exam
            };
            if (parentType === 'lesson') {
                payload.lesson_id = parentId;
            } else {
                payload.chapter_id = parentId;
            }

            await supabase.from('exams').insert(payload);
            closeModal(); loadContentTree();
        }
    });
}

/**
 * Delete item with confirmation
 */
export async function deleteItem(table, id) {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "لا يمكن التراجع عن هذا الإجراء!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    });

    if (!result.isConfirmed) return;

    await supabase.from(table).delete().eq('id', id);
    loadContentTree();
    document.getElementById('editorPanel').innerHTML = '';
    showSuccessAlert('تم الحذف!', 'تم حذف العنصر بنجاح.', 1500);
}

/**
 * Open edit node modal
 */
export function openEditNodeModal(type, data) {
    const labels = { 'chapter': 'الباب', 'lesson': 'الدرس', 'exam': 'الامتحان' };
    const tables = { 'chapter': 'chapters', 'lesson': 'lessons', 'exam': 'exams' };

    openModal({
        title: `تعديل اسم ${labels[type]}`,
        body: `
            <div class="form-group">
                <label>العنوان الجديد</label>
                <input type="text" id="editNodeTitle" class="form-control" value="${data.title}">
            </div>
            <div class="form-group">
                <label>الترتيب</label>
                <input type="number" id="editNodeOrder" class="form-control" value="${data.order_index || 0}">
            </div>
        `,
        onSave: async () => {
            const newTitle = document.getElementById('editNodeTitle').value;
            const newOrder = document.getElementById('editNodeOrder').value;
            if (!newTitle) return showWarningAlert('تنبيه', 'العنوان مطلوب');

            const { error } = await supabase.from(tables[type]).update({
                title: newTitle,
                order_index: newOrder
            }).eq('id', data.id);

            if (error) showErrorAlert('خطأ', error.message);
            else {
                closeModal();
                loadContentTree();
                showSuccessAlert('تم', 'تم التعديل بنجاح');
            }
        }
    });
}

/**
 * Save lecture data (content + video)
 */
export async function saveLectureData(lessonId) {
    const content = document.getElementById('lessonContent').value;
    const videoUrl = document.getElementById('lessonVideoUrl').value;

    const { error } = await supabase.from('lessons').update({
        content: content,
        video_url: videoUrl
    }).eq('id', lessonId);

    if (error) {
        showErrorAlert('خطأ', 'تعذر حفظ البيانات: ' + error.message);
    } else {
        showSuccessAlert('تم الحفظ', 'تم تحديث محتوى المحاضرة بنجاح', 1500);
    }
}

/**
 * Save lesson freemium setting (Instant)
 */
export async function saveLessonFreemiumSetting(lessonId, isFree) {
    const { error } = await supabase.from('lessons').update({ is_free: isFree }).eq('id', lessonId);

    if (error) {
        showErrorAlert('خطأ', 'تعذر حفظ إعدادات الوصول');
        console.error(error);
    } else {
        showSuccessAlert('تم الحفظ', 'تم تحديث إعدادات المحاضرة بنجاح', 1500);
    }
}

/**
 * Open edit lecture modal
 */
export async function openEditLectureModal(lecture, subjectId) {
    // Fetch exams for this subject to show in dropdown
    const { data: exams } = await supabase.from('exams').select('id, title').eq('subject_id', subjectId).order('title');

    openModal({
        title: 'تعديل حصة/محاضرة المنصة',
        body: `
            <div class="form-group mb-3">
                <label>اسم المحاضرة</label>
                <input id="editLecTitle" class="form-control" value="${lecture.title}" placeholder="مثال: المحاضرة الخامسة - الصدمة">
            </div>
            <div class="form-group mb-3">
                <label>تاريخ المحاضرة</label>
                <input type="date" id="editLecDate" class="form-control" value="${lecture.lecture_date}">
            </div>
            <div class="form-group mb-3">
                <label>نوع المحاضرة</label>
                <select id="editLecMode" class="form-control">
                    <option value="f2f" ${lecture.mode === 'f2f' ? 'selected' : ''}>في السنتر/المنصة (F2F)</option>
                    <option value="online" ${lecture.mode === 'online' ? 'selected' : ''}>أونلاين (Online)</option>
                </select>
            </div>
            <div class="form-group mb-3">
                <label>رابط المحاضرة (اختياري)</label>
                <input id="editLecLink" class="form-control" value="${lecture.link_url || ''}" placeholder="رابط فيديو أو ملف">
            </div>
            <div class="form-group">
                <label>ربط بامتحان (اختياري)</label>
                <select id="editLecExam" class="form-control">
                    <option value="">-- بدون امتحان --</option>
                    ${exams ? exams.map(e => `<option value="${e.id}" ${lecture.exam_id === e.id ? 'selected' : ''}>${e.title}</option>`).join('') : ''}
                </select>
            </div>
        `,
        onSave: async () => {
            const title = document.getElementById('editLecTitle').value;
            const date = document.getElementById('editLecDate').value;
            const mode = document.getElementById('editLecMode').value;
            const link = document.getElementById('editLecLink').value;
            const examId = document.getElementById('editLecExam').value;

            if (!title || !date) return showWarningAlert('تنبيه', 'برجاء ملء جميع البيانات');

            const { error } = await supabase.from('college_curriculum').update({
                title,
                lecture_date: date,
                mode,
                link_url: link || null,
                exam_id: examId || null
            }).eq('id', lecture.id);

            if (error) showErrorAlert('خطأ', error.message);
            else {
                closeModal();
                renderCurriculumManager(subjectId);
                showSuccessAlert('تم', 'تمت تحديث المحاضرة بنجاح');
            }
        }
    });
}

// Expose functions globally for onclick handlers
window.openSubjectManager = openSubjectManager;
window.openAddChapterModal = openAddChapterModal;
window.openAddLessonModal = openAddLessonModal;
window.openAddExamModal = openAddExamModal;
window.deleteItem = deleteItem;
window.openEditNodeModal = openEditNodeModal;
window.saveLectureData = saveLectureData;
window.saveLessonFreemiumSetting = saveLessonFreemiumSetting;
window.openAddLectureModal = openAddLectureModal;
window.openEditLectureModal = openEditLectureModal;
window.deleteLecture = deleteLecture;
