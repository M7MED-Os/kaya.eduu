/**
 * Admin Subjects Module
 * Subject CRUD operations and context navigation
 */

import {
    supabase,
    currentContext,
    showView,
    getContextLabel,
    openModal,
    closeModal,
    showWarningAlert,
    showErrorAlert,
    showSuccessAlert,
    showDeleteConfirmDialog,
    showLoadingAlert
} from './admin-core.js';

/**
 * Select context and load subjects
 */
export async function selectContext(grade, termOrStream) {
    // UI Update
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    currentContext.academic_year = grade;
    currentContext.termOrStream = termOrStream;
    currentContext.subject = null;

    // Determine if this is a term (1, 2) or a department
    const isTerm = termOrStream === '1' || termOrStream === '2';
    currentContext.isTerm = isTerm;
    currentContext.current_term = isTerm ? termOrStream : null;
    currentContext.department = !isTerm ? termOrStream : null;

    const label = getContextLabel(grade, termOrStream);
    document.getElementById('pageTitle').textContent = `الرئيسية > ${label}`;

    showView('subjectListView');
    await loadSubjects();
}

/**
 * Load subjects for current context
 */
export async function loadSubjects() {
    const container = document.getElementById('subjectListView');
    container.innerHTML = `<div class="spinner"></div>`;

    // Mappings from numeric strings to database strings
    const yearMap = { '1': 'first_year', '2': 'second_year', '3': 'third_year' };
    const termMap = { '1': 'first_term', '2': 'second_term' };
    // No mapping needed for depts as they come in as correct keys (science_science, etc.)
    const dbYear = yearMap[currentContext.academic_year] || currentContext.academic_year;
    const dbTerm = termMap[currentContext.current_term] || currentContext.current_term;
    const dbDept = currentContext.department; // Direct use

    // Filter Logic - use current_term and department from context
    let query = supabase.from('subjects').select('*').eq('academic_year', dbYear).order('order_index');

    // If viewing by term: show all subjects in that term
    if (dbTerm) {
        query = query.eq('current_term', dbTerm);
    }
    // If viewing by department: show only that department's subjects
    else if (dbDept) {
        query = query.eq('department', dbDept);
    }

    const { data: subjects, error } = await query;

    if (error) {
        container.innerHTML = `<p style="color:red">Error loading subjects</p>`;
        return;
    }

    // Render Grid
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h2>المواد الدراسية</h2>
            <button class="btn btn-primary" onclick="window.openAddSubjectModal()">
                <i class="fas fa-plus"></i> إضافة مادة
            </button>
        </div>
        <div class="subjects-grid">
    `;

    if (subjects.length === 0) {
        html += `<p class="empty-state" style="grid-column: 1/-1">لا توجد مواد مضافة في هذا القسم.</p>`;
    } else {
        subjects.forEach(sub => {
            html += `
                <div class="subject-card" onclick="window.openSubjectManager('${sub.id}')">
                    <div class="card-actions">
                         <button class="action-btn-sm" style="background:#E1F5FE; color:#0288D1;" 
                            onclick="event.stopPropagation(); window.openEditSubjectModal(${JSON.stringify(sub).replace(/"/g, '&quot;')})">
                            <i class="fas fa-edit"></i>
                        </button>
                         <button class="action-btn-sm" style="background:#fee2e2; color:#b91c1c;" 
                            onclick="event.stopPropagation(); window.deleteSubject('${sub.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="subject-icon">
                        <i class="fas fa-book"></i>
                    </div>
                    <div class="subject-title">${sub.name_ar}</div>
                    <div class="subject-meta">اضغط للإدارة</div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

/**
 * Open add subject modal
 */
export function openAddSubjectModal() {
    openModal({
        title: 'إضافة مادة جديدة',
        body: `
            <div class="form-group">
                <label>اسم المادة (بالعربية)</label>
                <input type="text" id="subjectName" class="form-control" required>
            </div>
            <div class="form-group">
                <label>الترتيب</label>
                <input type="number" id="subjectOrder" class="form-control" value="0">
            </div>
        `,
        onSave: async () => {
            const name = document.getElementById('subjectName').value;
            const order = document.getElementById('subjectOrder').value;
            if (!name) return showWarningAlert('تنبيه', 'الاسم مطلوب');

            // Mappings from numeric strings to database strings
            const yearMap = { '1': 'first_year', '2': 'second_year', '3': 'third_year' };
            const termMap = { '1': 'first_term', '2': 'second_term' };

            const payload = {
                name_ar: name,
                academic_year: yearMap[currentContext.academic_year] || currentContext.academic_year,
                order_index: order
            };

            // Set term and department based on context
            if (currentContext.current_term) {
                payload.current_term = termMap[currentContext.current_term] || currentContext.current_term;
            }
            if (currentContext.department) {
                payload.department = currentContext.department;
            }

            const { error } = await supabase.from('subjects').insert(payload);
            if (error) showErrorAlert('خطأ', error.message);
            else { closeModal(); loadSubjects(); showSuccessAlert('تم', 'تمت إضافة المادة بنجاح'); }
        }
    });
}

/**
 * Open edit subject modal
 */
export function openEditSubjectModal(sub) {
    openModal({
        title: 'تعديل بيانات المادة',
        body: `
            <div class="form-group">
                <label>اسم المادة (بالعربية)</label>
                <input type="text" id="editSubName" class="form-control" value="${sub.name_ar}">
            </div>
            <div class="form-group">
                <label>الترتيب</label>
                <input type="number" id="editSubOrder" class="form-control" value="${sub.order_index || 0}">
            </div>
        `,
        onSave: async () => {
            const name = document.getElementById('editSubName').value;
            const order = document.getElementById('editSubOrder').value;
            if (!name) return showWarningAlert('تنبيه', 'الاسم مطلوب');

            const { error } = await supabase.from('subjects').update({
                name_ar: name,
                order_index: order
            }).eq('id', sub.id);

            if (error) showErrorAlert('خطأ', error.message);
            else { closeModal(); loadSubjects(); showSuccessAlert('تم', 'تم التعديل بنجاح'); }
        }
    });
}

/**
 * Delete subject with confirmation
 */
export async function deleteSubject(id) {
    const confirmed = await showDeleteConfirmDialog(
        'المادة',
        'حذف المادة سيحذف كل المحتوى بداخلها (أبواب، دروس، امتحانات، ونتائج الطلاب)!'
    );

    if (!confirmed) return;

    showLoadingAlert('جاري الحذف...');

    try {
        const { error } = await supabase.rpc('admin_delete_subject', { p_subject_id: id });

        if (error) throw error;

        loadSubjects();
        showSuccessAlert('تم الحذف!', 'تم حذف المادة وكل محتوياتها بنجاح.');
    } catch (err) {
        console.error("Delete failed:", err);
        showErrorAlert('خطأ', 'حدثت مشكلة أثناء الحذف: ' + err.message);
    }
}

// Expose functions globally for onclick handlers
window.selectContext = selectContext;
window.openAddSubjectModal = openAddSubjectModal;
window.openEditSubjectModal = openEditSubjectModal;
window.deleteSubject = deleteSubject;
