/**
 * Admin Questions Module
 * Question editor and management for exams
 */

import {
    supabase,
    showWarningAlert,
    showErrorAlert,
    showSuccessAlert,
    setEditingQuestionId,
    setExistingQuestionImages
} from './admin-core.js';

// Local state (isolated to questions module)
let editingQuestionId = null;
let existingQuestionImages = {};

/**
 * Render exam questions editor
 */
export async function renderExamQuestions(exam) {
    const panel = document.getElementById('editorPanel');
    panel.innerHTML = `<div class="spinner"></div>`;

    // Get questions for this exam
    const { data: questions } = await supabase.from('questions').select('*').eq('exam_id', exam.id).order('created_at');

    // Get parent lesson if exists to check is_free_exam status
    let parentLesson = null;
    if (exam.lesson_id) {
        const { data } = await supabase.from('lessons').select('is_free_exam').eq('id', exam.lesson_id).single();
        parentLesson = data;
    }

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
             <h3 style="margin:0;">${exam.title} <small style="font-size:0.875rem; color:var(--secondary-color); font-weight:400;">(${questions?.length || 0} سؤال - ${exam.time_limit || 30} دقيقة)</small></h3>
             <div style="display:flex; gap:8px;">
                 <button class="btn btn-sm" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;" onclick="window.openEditExamModal(${JSON.stringify(exam).replace(/"/g, '&quot;')})">
                    <i class="fas fa-edit"></i> تعديل
                 </button>
                 <button class="btn btn-sm" style="background:#fee2e2; color:#ef4444; border:1px solid #fecaca;" onclick="window.deleteItem('exams', '${exam.id}')">
                    <i class="fas fa-trash-alt"></i> حذف
                 </button>
             </div>
        </div>
        
        <!-- Freemium Controls for Exam -->
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0;">
                    <input type="checkbox" id="examFreemiumToggle" ${exam.is_free ? 'checked' : ''} 
                           onchange="window.saveExamFreemiumSetting('${exam.id}', this.checked)"
                           style="width: 18px; height: 18px; cursor: pointer;">
                    <span style="font-size: 0.9rem; font-weight: 500;">
                        <i class="fas fa-crown" style="color: #0ea5e9;"></i> امتحان مجاني (متاح للجميع)
                    </span>
                </label>
                <span style="font-size: 0.75rem; color: #64748b;">هذا الامتحان متاح لغير المشتركين بشكل مستقل</span>
            </div>
        </div>
        
        <div style="background:white; padding:1.5rem; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:2rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
                <h4 style="margin:0; font-weight:700;"><i class="fas fa-plus-circle" style="color:var(--primary-color);"></i> إضافة سؤال جديد</h4>
                <button class="btn btn-outline btn-sm" onclick="window.openBulkAddModal('${exam.id}')">
                    <i class="fas fa-layer-group"></i> إضافة مجموعة
                </button>
            </div>
            
            <div class="form-group">
                <textarea id="NewQText" class="form-control" placeholder="اكتب نص السؤال هنا..." rows="3" style="resize:none; padding:1rem;"></textarea>
                <div style="margin-top:8px;">
                   <label style="font-size:0.85rem; color:#64748b; margin-bottom:4px; display:block;">صورة للسؤال (اختياري)</label>
                   <input type="file" id="QImg" accept="image/*" class="form-control" style="font-size:0.9rem; padding:6px;">
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-top:1rem;">
                <div class="form-group" style="margin:0;">
                    <input id="OptA" class="form-control" placeholder="الخيار A">
                    <input type="file" id="OptAImg" accept="image/*" class="form-control" style="margin-top:4px; font-size:0.75rem; padding:4px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <input id="OptB" class="form-control" placeholder="الخيار B">
                    <input type="file" id="OptBImg" accept="image/*" class="form-control" style="margin-top:4px; font-size:0.75rem; padding:4px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <input id="OptC" class="form-control" placeholder="الخيار C">
                    <input type="file" id="OptCImg" accept="image/*" class="form-control" style="margin-top:4px; font-size:0.75rem; padding:4px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <input id="OptD" class="form-control" placeholder="الخيار D">
                    <input type="file" id="OptDImg" accept="image/*" class="form-control" style="margin-top:4px; font-size:0.75rem; padding:4px;">
                </div>
            </div>
            
            <div style="margin-top:1.5rem; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:1rem;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <label style="font-size:0.875rem; font-weight:700; color:var(--secondary-color);">الإجابة الصحيحة:</label>
                    <select id="CorrectOpt" class="form-control" style="width:120px; font-weight:700; border-color:var(--success-color);">
                        <option value="a">Option A</option>
                        <option value="b">Option B</option>
                        <option value="c">Option C</option>
                        <option value="d">Option D</option>
                    </select>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                     <button class="btn" onclick="window.resetQuestionForm()" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-size:0.85rem; padding:0.5rem 1rem;">
                        <i class="fas fa-times" style="margin-left:5px;"></i> إلغاء التعديل
                     </button>
                     <button class="btn btn-primary" id="addQuestionBtn" onclick="window.saveQuestion('${exam.id}')" style="font-size:0.85rem; padding:0.5rem 1.5rem;">
                        <i class="fas fa-save" style="margin-left:5px;"></i> حفظ السؤال
                     </button>
                </div>
            </div>
        </div>

        <div class="questions-list">
            ${questions && questions.length > 0 ? questions.map((q, i) => `
                <div class="question-card" style="border:1px solid #e5e7eb; padding:1rem; border-radius:8px; margin-bottom:1rem; background:#fff;">
                    <div class="question-card-header" style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                        <div class="question-text" style="font-weight:bold;">
                            س${i + 1}: ${q.question_text || ''}
                            ${q.question_image ? `<br><img src="${q.question_image}" style="max-height:80px; margin-top:5px; border-radius:4px;">` : ''}
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn" style="background:#E1F5FE; color:#0288D1; padding:6px 10px; border-radius:8px; font-size:0.8rem;" 
                                    onclick="window.editQuestion(${JSON.stringify(q).replace(/"/g, '&quot;')})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn" style="background:#fff1f2; color:#be123c; padding:6px 10px; border-radius:8px; font-size:0.8rem;" 
                                    onclick="window.deleteQuestion('${q.id}', '${exam.id}')" title="حذف السؤال">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div class="options-grid">
                        ${['a', 'b', 'c', 'd'].filter(opt => q[`choice_${opt}`] || q[`choice_${opt}_image`]).map(opt => `
                            <div class="option-item ${q.correct_answer === opt ? 'correct' : ''}">
                                <span class="option-label">${opt.toUpperCase()}</span>
                                 ${q[`choice_${opt}_image`] ? `<img src="${q[`choice_${opt}_image`]}" style="max-height:40px; vertical-align:middle;">` : ''} <span>${q[`choice_${opt}`] || ''}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('') : `
                <div style="text-align:center; padding:3rem; color:var(--secondary-color); background:white; border-radius:var(--radius-md); border:1px dashed var(--border-color);">
                    <i class="fas fa-question-circle" style="font-size:3rem; opacity:0.2; margin-bottom:1rem; display:block;"></i>
                    <p>لا توجد أسئلة في هذا الامتحان بعد</p>
                </div>
            `}
        </div>
    `;
    panel.innerHTML = html;
}

/**
 * Save or update a question
 */
export async function saveQuestion(examId) {
    const text = document.getElementById('NewQText').value;
    const a = document.getElementById('OptA').value;
    const b = document.getElementById('OptB').value;
    const c = document.getElementById('OptC').value;
    const d = document.getElementById('OptD').value;
    const correct = document.getElementById('CorrectOpt').value;

    const qFile = document.getElementById('QImg').files[0];
    const aFile = document.getElementById('OptAImg').files[0];
    const bFile = document.getElementById('OptBImg').files[0];
    const cFile = document.getElementById('OptCImg').files[0];
    const dFile = document.getElementById('OptDImg').files[0];

    // Check minimum (text OR image required)
    const hasQ = text || qFile || (editingQuestionId && existingQuestionImages.q);
    const hasA = a || aFile || (editingQuestionId && existingQuestionImages.a);
    const hasB = b || bFile || (editingQuestionId && existingQuestionImages.b);

    if (!hasQ || !hasA || !hasB) {
        return showWarningAlert('عذراً', 'يرجى إكمال البيانات الأساسية');
    }

    const btn = document.getElementById('addQuestionBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...`;
    btn.disabled = true;

    try {
        const upload = async (file) => {
            if (!file) return null;
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${examId}/${fileName}`;
            const { error } = await supabase.storage.from('exam_attachments').upload(filePath, file);
            if (error) throw error;
            const { data } = supabase.storage.from('exam_attachments').getPublicUrl(filePath);
            return data.publicUrl;
        };

        const qImgUrl = await upload(qFile);
        const aImgUrl = await upload(aFile);
        const bImgUrl = await upload(bFile);
        const cImgUrl = await upload(cFile);
        const dImgUrl = await upload(dFile);

        const payload = {
            exam_id: examId,
            question_text: text || "",
            choice_a: a || "", choice_b: b || "", choice_c: c || "", choice_d: d || "",
            correct_answer: correct
        };

        // If uploading new image, use it. Else if editing, keep existing. Else null.
        if (qImgUrl) payload.question_image = qImgUrl;
        else if (editingQuestionId && !qFile) payload.question_image = existingQuestionImages.q;

        if (aImgUrl) payload.choice_a_image = aImgUrl;
        else if (editingQuestionId && !aFile) payload.choice_a_image = existingQuestionImages.a;

        if (bImgUrl) payload.choice_b_image = bImgUrl;
        else if (editingQuestionId && !bFile) payload.choice_b_image = existingQuestionImages.b;

        if (cImgUrl) payload.choice_c_image = cImgUrl;
        else if (editingQuestionId && !cFile) payload.choice_c_image = existingQuestionImages.c;

        if (dImgUrl) payload.choice_d_image = dImgUrl;
        else if (editingQuestionId && !dFile) payload.choice_d_image = existingQuestionImages.d;

        let error;
        if (editingQuestionId) {
            // UPDATE
            const { error: err } = await supabase.from('questions').update(payload).eq('id', editingQuestionId);
            error = err;
        } else {
            // INSERT
            const { error: err } = await supabase.from('questions').insert(payload);
            error = err;
        }

        if (error) throw error;

        // Reset and Reload
        resetQuestionForm();
        const { data: exam } = await supabase.from('exams').select('*').eq('id', examId).single();
        renderExamQuestions(exam);

    } catch (err) {
        console.error(err);
        showErrorAlert('خطأ', 'حدث خطأ: ' + (err.message || err.error_description || err));
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

/**
 * Edit existing question
 */
export function editQuestion(q) {
    // Scroll to form input
    const inputField = document.getElementById('NewQText');
    inputField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => inputField.focus(), 500);

    // Populate Fields
    document.getElementById('NewQText').value = q.question_text || '';
    document.getElementById('OptA').value = q.choice_a || '';
    document.getElementById('OptB').value = q.choice_b || '';
    document.getElementById('OptC').value = q.choice_c || '';
    document.getElementById('OptD').value = q.choice_d || '';
    document.getElementById('CorrectOpt').value = q.correct_answer || 'a';

    // Set Editing State
    editingQuestionId = q.id;
    existingQuestionImages = {
        q: q.question_image,
        a: q.choice_a_image,
        b: q.choice_b_image,
        c: q.choice_c_image,
        d: q.choice_d_image
    };

    // Sync with core state
    setEditingQuestionId(q.id);
    setExistingQuestionImages(existingQuestionImages);

    // UI Feedback
    const btn = document.getElementById('addQuestionBtn');
    btn.innerHTML = `<i class="fas fa-edit" style="margin-left:5px;"></i> تعديل السؤال`;
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-warning');

    Swal.fire({
        toast: true, position: 'top-end', icon: 'info', title: 'وضع التعديل', timer: 1500, showConfirmButton: false
    });
}

/**
 * Reset question form
 */
export function resetQuestionForm() {
    document.getElementById('NewQText').value = '';
    document.getElementById('OptA').value = '';
    document.getElementById('OptB').value = '';
    document.getElementById('OptC').value = '';
    document.getElementById('OptD').value = '';
    document.getElementById('QImg').value = null;
    document.getElementById('OptAImg').value = null;
    document.getElementById('OptBImg').value = null;
    document.getElementById('OptCImg').value = null;
    document.getElementById('OptDImg').value = null;
    document.getElementById('CorrectOpt').value = 'a';

    editingQuestionId = null;
    existingQuestionImages = {};

    // Sync with core state
    setEditingQuestionId(null);
    setExistingQuestionImages({});

    const btn = document.getElementById('addQuestionBtn');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-save" style="margin-left:5px;"></i> حفظ السؤال`;
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-primary');
    }
}

/**
 * Delete a question
 */
export async function deleteQuestion(qId, examId) {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "لن تتمكن من استعادة هذا السؤال بعد حذفه!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        await supabase.from('questions').delete().eq('id', qId);

        const { data: exam } = await supabase.from('exams').select('*').eq('id', examId).single();
        renderExamQuestions(exam);

        showSuccessAlert('تم الحذف!', 'تم حذف السؤال بنجاح.', 1500);
    }
}

/**
 * Save exam freemium setting (Instant)
 */
export async function saveExamFreemiumSetting(examId, isFree) {
    const { error } = await supabase.from('exams').update({ is_free: isFree }).eq('id', examId);

    if (error) {
        showErrorAlert('خطأ', 'تعذر حفظ إعدادات الامتحان');
        console.error(error);
    } else {
        showSuccessAlert('تم الحفظ', 'تم تحديث إعدادات الامتحان بنجاح', 1500);
    }
}

/**
 * Open edit exam modal
 */
export async function openEditExamModal(exam) {
    const { openModal, closeModal } = await import('./admin-core.js');

    openModal({
        title: 'تعديل بيانات الامتحان',
        body: `
            <div class="form-group">
                <label>عنوان الامتحان</label>
                <input id="editExamTitle" class="form-control" value="${exam.title}">
            </div>
            <div class="form-group">
                <label>مدة الامتحان (بالدقائق)</label>
                <input type="number" id="editExamTime" class="form-control" value="${exam.time_limit || 30}" min="1">
            </div>
        `,
        onSave: async () => {
            const updates = {
                title: document.getElementById('editExamTitle').value,
                time_limit: parseInt(document.getElementById('editExamTime').value) || 30
            };

            const { error } = await supabase
                .from('exams')
                .update(updates)
                .eq('id', exam.id);

            if (error) {
                showErrorAlert('خطأ', 'فشل تحديث الامتحان');
                return;
            }

            showSuccessAlert('تم', 'تم تحديث بيانات الامتحان');
            closeModal();

            // Reload the exam view
            const { data: updatedExam } = await supabase
                .from('exams')
                .select('*')
                .eq('id', exam.id)
                .single();
            if (updatedExam) renderExamQuestions(updatedExam);
        }
    });
}

// Expose functions globally for onclick handlers
window.saveQuestion = saveQuestion;
window.editQuestion = editQuestion;
window.resetQuestionForm = resetQuestionForm;
window.deleteQuestion = deleteQuestion;
window.saveExamFreemiumSetting = saveExamFreemiumSetting;
window.openEditExamModal = openEditExamModal;
