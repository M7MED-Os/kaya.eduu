import { supabase } from "./supabaseClient.js";

// ==========================================
// 1. STATE & AUTH
// ==========================================
let currentUser = null;
let enrollmentChartInstance = null;
let statusPieChartInstance = null;
let currentContext = {
    grade: null,
    termOrStream: null, // "term" for G1/2, "stream" for G3
    subject: null
};

document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
    setupModalListeners();


    // Responsive Sidebar Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.querySelector('.sidebar');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('mobile-open');
        });
    }

    // Close button for sidebar
    const closeSidebar = document.getElementById('closeSidebar');
    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
        });
    }

    // Close sidebar when clicking navigation items on mobile
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1553) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1553 &&
            sidebar.classList.contains('mobile-open') &&
            !sidebar.contains(e.target) &&
            e.target !== mobileToggle) {
            sidebar.classList.remove('mobile-open');
        }
    });

    // Real-time student search and filters
    const filterControls = ['studentSearch', 'filterStatus', 'filterGrade', 'filterStream', 'filterSort'];
    filterControls.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (id === 'filterGrade') updateStreamFilter();
                loadStudents();
            });
            if (id === 'studentSearch') {
                el.addEventListener('input', () => loadStudents());
            }
        }
    });

    function updateStreamFilter() {
        const grade = document.getElementById('filterGrade').value;
        const group = document.getElementById('streamFilterGroup');
        const select = document.getElementById('filterStream');

        if (grade === 'all') {
            group.style.display = 'none';
            return;
        }

        group.style.display = 'block';
        let options = '<option value="all">كل الشعب/الترم</option>';

        if (grade === '3') {
            options += `
                <option value="languages">اللغات</option>
                <option value="scientific_common">مواد علمي مشترك</option>
                <option value="science_bio">علمي علوم</option>
                <option value="science_math">علمي رياضة</option>
                <option value="literature">أدبي</option>
                <option value="non_scoring">خارج المجموع</option>
            `;
        } else {
            options += `
                <option value="1">الترم الأول</option>
                <option value="2">الترم الثاني</option>
            `;
        }
        select.innerHTML = options;
    }

    // Handle Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        };
    }
});

async function checkAdminAuth() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        const { data: profile } = await supabase.from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'admin') {
            window.location.href = 'dashboard.html';
            return;
        }

        currentUser = user;
        document.getElementById('loading').style.display = 'none';

        // Set default view to Students
        showStudentsView();

    } catch (err) {
        console.error("Auth Fail", err);
    }
}

// ==========================================
// 2. NAVIGATION & VIEWS
// ==========================================

window.selectContext = async (grade, termOrStream) => {
    // UI Update
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Ideally highlight the clicked one, but passed via onclick needs event target. 
    // Simplified: visual feedback on content area.

    currentContext.grade = grade;
    currentContext.termOrStream = termOrStream;
    currentContext.subject = null;

    const label = getContextLabel(grade, termOrStream);
    document.getElementById('pageTitle').textContent = `الرئيسية > ${label}`;

    showView('subjectListView');
    await loadSubjects();
};

function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function getContextLabel(grade, val) {
    const grades = { '1': 'الصف الأول', '2': 'الصف الثاني', '3': 'الصف الثالث' };
    const vals = {
        '1': 'الترم الأول', '2': 'الترم الثاني',
        'science_bio': 'علمي علوم', 'science_math': 'علمي رياضة', 'literature': 'أدبي',
        'scientific_common': 'مواد علمي مشترك',
        'languages': 'اللغات (مشترك)', 'non_scoring': 'مواد خارج المجموع'
    };
    return `${grades[grade]} - ${vals[val] || val}`;
}

// ==========================================
// 3. SUBJECT LIST MANAGEMENT
// ==========================================

async function loadSubjects() {
    const container = document.getElementById('subjectListView');
    container.innerHTML = `<div class="spinner"></div>`;

    // Filter Logic
    let query = supabase.from('subjects').select('*').eq('grade', currentContext.grade).order('order_index');

    if (currentContext.grade === '3') {
        query = query.eq('stream', currentContext.termOrStream);
    } else {
        query = query.eq('term', currentContext.termOrStream);
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
            <button class="btn btn-primary" onclick="openAddSubjectModal()">
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
                <div class="subject-card" onclick="openSubjectManager('${sub.id}')">
                    <div class="card-actions">
                         <button class="action-btn-sm" style="background:#e0f2fe; color:#0369a1;" 
                            onclick="event.stopPropagation(); window.openEditSubjectModal(${JSON.stringify(sub).replace(/"/g, '&quot;')})">
                            <i class="fas fa-edit"></i>
                        </button>
                         <button class="action-btn-sm" style="background:#fee2e2; color:#b91c1c;" 
                            onclick="event.stopPropagation(); deleteSubject('${sub.id}')">
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

window.openAddSubjectModal = () => {
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
            if (!name) return alert('الاسم مطلوب');

            const payload = {
                name_ar: name,
                grade: currentContext.grade,
                order_index: order
            };

            if (currentContext.grade === '3') payload.stream = currentContext.termOrStream;
            else payload.term = currentContext.termOrStream;

            const { error } = await supabase.from('subjects').insert(payload);
            if (error) alert(error.message);
            else { closeModal(); loadSubjects(); }
        }
    });
};

window.openEditSubjectModal = (sub) => {
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
            if (!name) return alert('الاسم مطلوب');

            const { error } = await supabase.from('subjects').update({
                name_ar: name,
                order_index: order
            }).eq('id', sub.id);

            if (error) alert(error.message);
            else { closeModal(); loadSubjects(); }
        }
    });
};

window.deleteSubject = async (id) => {
    if (!confirm('حذف المادة سيحذف كل المحتوى بداخلها. هل أنت متأكد؟')) return;
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) alert(error.message);
    else loadSubjects();
};


// ==========================================
// 4. SUBJECT MANAGER (TREE VIEW)
// ==========================================

window.openSubjectManager = async (subjectId) => {
    // 1. Fetch Subject
    const { data: subject } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
    if (!subject) return;

    currentContext.subject = subject;
    document.getElementById('pageTitle').textContent = `الرئيسية > ${subject.name_ar}`; // Breadcrumb update

    showView('subjectManagerView');
    await loadContentTree();
};

async function loadContentTree() {
    const treeContainer = document.getElementById('contentTree');
    treeContainer.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';

    // Fetch Hierarchy: Chapters -> Lessons -> Exams
    // Note: Exams can be under Chapters directly too.

    // Fetch all for this subject
    const { data: chapters } = await supabase.from('chapters')
        .select('*').eq('subject_id', currentContext.subject.id).order('order_index');

    const { data: lessons } = await supabase.from('lessons')
        .select('*').in('chapter_id', chapters.map(c => c.id)).order('order_index');

    // Fetch Exams related to this subject (via subject_id for speed)
    const { data: exams } = await supabase.from('exams')
        .select('*').eq('subject_id', currentContext.subject.id);

    // Build Map
    treeContainer.innerHTML = '';

    if (chapters.length === 0) {
        treeContainer.innerHTML = '<p class="empty-state" style="padding:1rem;">لا توجد أبواب.</p>';
        return;
    }

    chapters.forEach(chapter => {
        // --- Chapter Node ---
        const chNode = createTreeNode({ type: 'chapter', data: chapter, label: chapter.title, icon: 'fa-folder' });
        treeContainer.appendChild(chNode);

        // Filter contents
        const chLessons = lessons.filter(l => l.chapter_id === chapter.id);
        const chExams = exams.filter(e => e.chapter_id === chapter.id); // Chapter Final Exams

        // Render Lessons
        chLessons.forEach(lesson => {
            const lNode = createTreeNode({ type: 'lesson', data: lesson, label: lesson.title, icon: 'fa-book-open', indent: 1 });
            treeContainer.appendChild(lNode);

            // Lesson Exams
            const lExams = exams.filter(e => e.lesson_id === lesson.id);
            lExams.forEach(exam => {
                const eNode = createTreeNode({ type: 'exam', data: exam, label: exam.title, icon: 'fa-file-alt', indent: 2 });
                treeContainer.appendChild(eNode);
            });
        });

        // Render Chapter Exams (Finals)
        chExams.forEach(exam => {
            const eNode = createTreeNode({ type: 'exam', data: exam, label: `${exam.title} (شامل)`, icon: 'fa-star', indent: 1, color: '#d97706' });
            treeContainer.appendChild(eNode);
        });
    });
}

function createTreeNode({ type, data, label, icon, indent = 0, color = '' }) {
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

// ==========================================
// 5. EDITORS & FORMS
// ==========================================

window.openAddChapterModal = () => {
    if (!currentContext.subject) return alert("اختر مادة أولاً");

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

            if (error) alert(error.message);
            else { closeModal(); loadContentTree(); }
        }
    });
};

function openEditor(type, data) {
    const panel = document.getElementById('editorPanel');

    // --- CHAPTER EDITOR ---
    if (type === 'chapter') {
        panel.innerHTML = `
            <h3>تعديل الباب: ${data.title}</h3>
            <div class="form-actions" style="margin-bottom:2rem;">
                 <button class="btn btn-primary btn-sm" onclick="openAddLessonModal('${data.id}')">
                    <i class="fas fa-plus"></i> إضافة درس
                </button>
                 <button class="btn btn-outline btn-sm" onclick="openAddExamModal('chapter', '${data.id}')">
                    <i class="fas fa-plus"></i> إضافة امتحان شامل
                </button>
                 <button class="btn btn-outline btn-sm" style="color:red; float:left;" onclick="deleteItem('chapters', '${data.id}')">
                    <i class="fas fa-trash"></i> حذف الباب
                </button>
            </div>
        `;
    }

    // --- LESSON EDITOR ---
    else if (type === 'lesson') {
        panel.innerHTML = `
            <h3>تعديل الدرس: ${data.title}</h3>
            <div class="form-actions" style="margin-bottom:2rem;">
                 <button class="btn btn-primary btn-sm" onclick="openAddExamModal('lesson', '${data.id}')">
                    <i class="fas fa-plus"></i> إضافة امتحان
                </button>
                 <button class="btn btn-outline btn-sm" style="color:red; float:left;" onclick="deleteItem('lessons', '${data.id}')">
                    <i class="fas fa-trash"></i> حذف الدرس
                </button>
            </div>
        `;
    }

    // --- EXAM EDITOR (QUESTIONS) ---
    else if (type === 'exam') {
        renderExamQuestions(data);
    }
}

// Helpers for Add Modals
window.openAddLessonModal = (chapterId) => {
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

window.openAddExamModal = (parentType, parentId) => {
    openModal({
        title: 'إضافة امتحان',
        body: `<div class="form-group"><label>العنوان</label><input id="eTitle" class="form-control"></div>`,
        onSave: async () => {
            const payload = {
                title: document.getElementById('eTitle').value,
                subject_id: currentContext.subject.id
            };
            if (parentType === 'lesson') payload.lesson_id = parentId;
            else payload.chapter_id = parentId;

            await supabase.from('exams').insert(payload);
            closeModal(); loadContentTree();
        }
    });
}

window.deleteItem = async (table, id) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await supabase.from(table).delete().eq('id', id);
    loadContentTree();
    document.getElementById('editorPanel').innerHTML = ''; // Clear editor
};

window.openEditNodeModal = (type, data) => {
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
            if (!newTitle) return alert('العنوان مطلوب');

            const { error } = await supabase.from(tables[type]).update({
                title: newTitle,
                order_index: newOrder
            }).eq('id', data.id);

            if (error) alert(error.message);
            else {
                closeModal();
                loadContentTree();
            }
        }
    });
};

// ==========================================
// 6. QUESTION MANAGER (Inside Editor Panel)
// ==========================================

async function renderExamQuestions(exam) {
    const panel = document.getElementById('editorPanel');
    panel.innerHTML = `<div class="spinner"></div>`;

    const { data: questions } = await supabase.from('questions').select('*').eq('exam_id', exam.id).order('created_at');

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
             <h3 style="margin:0;">${exam.title} <small style="font-size:0.875rem; color:var(--secondary-color); font-weight:400;">(${questions?.length || 0} سؤال)</small></h3>
             <button class="btn btn-sm" style="background:#fee2e2; color:#ef4444; border:1px solid #fecaca;" onclick="deleteItem('exams', '${exam.id}')">
                <i class="fas fa-trash-alt"></i> حذف الامتحان
             </button>
        </div>
        
        <div style="background:white; padding:1.5rem; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:2rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
                <h4 style="margin:0; font-weight:700;"><i class="fas fa-plus-circle" style="color:var(--primary-color);"></i> إضافة سؤال جديد</h4>
                <button class="btn btn-outline btn-sm" onclick="openBulkAddModal('${exam.id}')">
                    <i class="fas fa-layer-group"></i> إضافة مجموعة
                </button>
            </div>
            
            <div class="form-group">
                <textarea id="NewQText" class="form-control" placeholder="اكتب نص السؤال هنا..." rows="3" style="resize:none; padding:1rem;"></textarea>
            </div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-top:1rem;">
                <div class="form-group" style="margin:0;"><input id="OptA" class="form-control" placeholder="الخيار A"></div>
                <div class="form-group" style="margin:0;"><input id="OptB" class="form-control" placeholder="الخيار B"></div>
                <div class="form-group" style="margin:0;"><input id="OptC" class="form-control" placeholder="الخيار C"></div>
                <div class="form-group" style="margin:0;"><input id="OptD" class="form-control" placeholder="الخيار D"></div>
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
                <button class="btn btn-primary" onclick="addQuestion('${exam.id}')" style="padding:0.6rem 2rem;">
                    <i class="fas fa-save"></i> حفظ السؤال
                </button>
            </div>
        </div>

        <div class="questions-list">
            ${questions && questions.length > 0 ? questions.map((q, i) => `
                <div class="question-card">
                    <div class="question-card-header">
                        <div class="question-text">س${i + 1}: ${q.question_text}</div>
                        <button class="btn" style="background:#fff1f2; color:#be123c; padding:6px 10px; border-radius:8px; font-size:0.8rem;" 
                                onclick="deleteQuestion('${q.id}', '${exam.id}')" title="حذف السؤال">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    <div class="options-grid">
                        <div class="option-item ${q.correct_answer === 'a' ? 'correct' : ''}">
                            <span class="option-label">A</span>
                            <span>${q.choice_a}</span>
                        </div>
                        <div class="option-item ${q.correct_answer === 'b' ? 'correct' : ''}">
                            <span class="option-label">B</span>
                            <span>${q.choice_b}</span>
                        </div>
                        <div class="option-item ${q.correct_answer === 'c' ? 'correct' : ''}">
                            <span class="option-label">C</span>
                            <span>${q.choice_c}</span>
                        </div>
                        <div class="option-item ${q.correct_answer === 'd' ? 'correct' : ''}">
                            <span class="option-label">D</span>
                            <span>${q.choice_d}</span>
                        </div>
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

window.addQuestion = async (examId) => {
    const text = document.getElementById('NewQText').value;
    const a = document.getElementById('OptA').value;
    const b = document.getElementById('OptB').value;
    const c = document.getElementById('OptC').value;
    const d = document.getElementById('OptD').value;
    const correct = document.getElementById('CorrectOpt').value;

    if (!text || !a || !b) return Swal.fire({
        icon: 'warning',
        title: 'عذراً',
        text: 'يرجى إكمال جميع البيانات المطلوبة',
        confirmButtonText: 'حسناً'
    });

    await supabase.from('questions').insert({
        exam_id: examId,
        question_text: text,
        choice_a: a, choice_b: b, choice_c: c, choice_d: d,
        correct_answer: correct
    });

    // Refresh current view (Hack: fetch exam data again and re-render)
    const { data: exam } = await supabase.from('exams').select('*').eq('id', examId).single();
    renderExamQuestions(exam);
};

window.deleteQuestion = async (qId, examId) => {
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

        Swal.fire({
            icon: 'success',
            title: 'تم الحذف!',
            text: 'تم حذف السؤال بنجاح.',
            timer: 1500,
            showConfirmButton: false
        });
    }
};


// ==========================================
// 7. SHARED MODAL LOGIC
// ==========================================

let activeModalCallback = null;

window.openModal = ({ title, body, onSave }) => {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;

    const footer = document.getElementById('modalFooter');
    footer.innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" id="modalSaveBtn">حفظ</button>
    `;

    activeModalCallback = onSave;
    document.getElementById('universalModal').classList.add('open');
};

function setupModalListeners() {
    document.getElementById('universalModal').addEventListener('click', (e) => {
        if (e.target.id === 'modalSaveBtn' && activeModalCallback) {
            activeModalCallback();
        }
    });
}

window.closeModal = () => {
    document.getElementById('universalModal').classList.remove('open');
    activeModalCallback = null;
};

// ==========================================
// 8. STUDENTS MANAGEMENT
// ==========================================

window.showStudentsView = async () => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('navStudents')?.classList.add('active');

    document.getElementById('pageTitle').textContent = 'الرئيسية > إدارة الطلاب';
    showView('studentsView');
    await loadStudents();
}

window.loadStudents = async () => {
    const tableBody = document.getElementById('studentsTableBody');
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem;"><div class="spinner"></div></td></tr>';

    const searchStr = document.getElementById('studentSearch').value.trim();
    const filterStatus = document.getElementById('filterStatus').value;
    const filterGrade = document.getElementById('filterGrade').value;
    const filterStream = document.getElementById('filterStream')?.value || 'all';
    const filterSort = document.getElementById('filterSort').value;

    let { data: students, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red;">خطأ في التحميل: ${error.message}</td></tr>`;
        return;
    }

    // 1. Calculate and Update Stats (before filtering search)
    updateStats(students);

    // 2. Apply Filters
    let filtered = students.filter(s => {
        // Search Filter
        const matchesSearch = !searchStr ||
            (s.full_name && s.full_name.toLowerCase().includes(searchStr.toLowerCase())) ||
            (s.email && s.email.toLowerCase().includes(searchStr.toLowerCase()));

        // Status Filter
        const expiry = s.subscription_ends_at ? new Date(s.subscription_ends_at) : null;
        const now = new Date();
        const isExp = expiry && expiry < now;
        let sStatus = "pending";
        if (s.is_active && !isExp) sStatus = "active";
        else if (s.is_active && isExp) sStatus = "expired";

        const matchesStatus = filterStatus === 'all' || sStatus === filterStatus;

        // Grade Filter
        const matchesGrade = filterGrade === 'all' || s.grade == filterGrade;

        // Stream Filter
        const matchesStream = filterStream === 'all' || s.stream == filterStream || s.term == filterStream;

        return matchesSearch && matchesStatus && matchesGrade && matchesStream;
    });

    // 3. Apply Sorting
    filtered.sort((a, b) => {
        if (filterSort === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        if (filterSort === 'points') return (b.points || 0) - (a.points || 0);
        if (filterSort === 'expiry') {
            if (!a.subscription_ends_at) return 1;
            if (!b.subscription_ends_at) return -1;
            return new Date(a.subscription_ends_at) - new Date(b.subscription_ends_at);
        }
        return 0;
    });

    if (!filtered || filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem;">لا يوجد طلاب يطابقون هذه الفلاتر</td></tr>';
        return;
    }

    tableBody.innerHTML = filtered.map(s => {
        const roleStr = s.role === 'admin' ? 'آدمن' : 'طالب';
        const roleClass = s.role === 'admin' ? 'badge-info' : 'badge-gray';

        // Translation Mapping
        const streamMap = {
            'science_bio': 'علمي علوم',
            'science_math': 'علمي رياضة',
            'literature': 'أدبي',
            'languages': 'اللغات',
            'scientific_common': 'علمي مشترك',
            'non_scoring': 'خارج المجموع'
        };
        const termMap = {
            '1': 'الترم الأول',
            '2': 'الترم الثاني'
        };

        const displayStreamOrTerm = s.grade === '3'
            ? (streamMap[s.stream] || s.stream || '-')
            : (termMap[s.term] || s.term || '-');

        // Status Logic
        const expiry = s.subscription_ends_at ? new Date(s.subscription_ends_at) : null;
        const now = new Date();
        const isExp = expiry && expiry < now;

        let statusHtml = '';
        if (!s.is_active) {
            statusHtml = `<span class="badge badge-warning"><i class="fas fa-clock"></i> معلق</span>`;
        } else if (isExp) {
            statusHtml = `<span class="badge badge-danger"><i class="fas fa-exclamation-circle"></i> منتهي</span>`;
        } else {
            statusHtml = `<span class="badge badge-success"><i class="fas fa-check-circle"></i> نشط</span>`;
        }

        // Expiry Logic
        let expiryHtml = '-';
        if (s.subscription_ends_at) {
            const absDiff = Math.abs(expiry - now);
            const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);

            let timeText = days > 0 ? `باقي ${days} يوم` : `باقي ${hours} ساعة`;
            if (isExp) timeText = days > 0 ? `منذ ${days} يوم` : `منذ ${hours} ساعة`;

            const timeColor = !s.is_active ? '#64748b' : (isExp ? '#ef4444' : '#059669');

            expiryHtml = `
                <div style="line-height:1.2;">
                    <div style="color:${timeColor}; font-weight:700; font-size:0.85rem; text-align:center;">${!s.is_active ? 'موقف' : timeText}</div>
                    <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px; text-align:center;">${new Date(s.subscription_ends_at).toLocaleDateString('ar-EG')}</div>
                </div>
            `;
        }

        return `
        <tr>
            <td data-label="الاسم">
                <div style="font-weight:700; color:#0f172a; margin-bottom:4px;">${s.full_name || 'بدون اسم'}</div>
                <div class="user-id">ID: ${s.id.substr(0, 8)}</div>
            </td>
            <td data-label="البريد" style="color:#64748b; font-size:0.85rem;">${s.email || '-'}</td>
            <td data-label="السنة"><span class="badge badge-info">${s.grade || '-'}</span></td>
            <td data-label="الشعبة">${displayStreamOrTerm}</td>
            <td data-label="النقاط"><strong>${s.points || 0}</strong></td>
            <td data-label="الدور"><span class="badge ${roleClass}">${roleStr}</span></td>
            <td data-label="الحالة">${statusHtml}</td>
            <td data-label="الانتهاء">${expiryHtml}</td>
            <td data-label="إجراءات">
                <div style="display:flex; align-items:center; gap:8px; justify-content: flex-end;">
                    ${(function () {
                if (!s.is_active || isExp) {
                    return `<button class="btn btn-sm" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; white-space:nowrap; padding:6px 12px;" 
                                        onclick="toggleStudentStatus('${s.id}', false)">
                                        <i class="fas fa-user-check"></i> ${isExp ? 'تجديد' : 'تفعيل'}</button>`;
                } else {
                    return `<button class="btn btn-sm" style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; white-space:nowrap; padding:6px 12px;" 
                                        onclick="toggleStudentStatus('${s.id}', true)">
                                        <i class="fas fa-user-slash"></i> تعطيل</button>`;
                }
            })()}
                    
                    <button class="btn btn-primary btn-sm" style="width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0; flex-shrink:0;" 
                            onclick="openEditStudent('${s.id}')" title="تعديل">
                        <i class="fas fa-pencil-alt" style="font-size:0.85rem;"></i>
                    </button>
                    
                    <button class="btn btn-sm" style="background:#fef2f2; color:#ef4444; border:1px solid #fee2e2; width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0; flex-shrink:0;" 
                            onclick="deleteStudent('${s.id}', '${s.full_name}')" title="حذف">
                        <i class="fas fa-trash-alt" style="font-size:0.85rem;"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
};

window.openEditStudent = async (id) => {
    const { data: student } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (!student) return;

    openModal({
        title: 'تعديل بيانات الطالب',
        body: `
            <div class="form-group">
                <label>الاسم</label>
                <input id="editName" class="form-control" value="${student.full_name || ''}">
            </div>
            <div class="form-group">
                <label>النقاط</label>
                <input type="number" id="editPoints" class="form-control" value="${student.points || 0}">
            </div>
            <div class="form-group">
                <label>الدور (Role)</label>
                <select id="editRole" class="form-control">
                    <option value="student" ${student.role !== 'admin' ? 'selected' : ''}>Student</option>
                    <option value="admin" ${student.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </div>
            <div class="form-group">
                <label>السنة الدراسية</label>
                <input id="editGrade" class="form-control" value="${student.grade || ''}">
            </div>
             <div class="form-group">
                <label>الشعبة (Stream)</label>
                <select id="editStream" class="form-control">
                    <option value="" ${!student.stream ? 'selected' : ''}>--</option>
                    <option value="science_bio" ${student.stream === 'science_bio' ? 'selected' : ''}>علمي علوم</option>
                    <option value="science_math" ${student.stream === 'science_math' ? 'selected' : ''}>علمي رياضة</option>
                    <option value="literature" ${student.stream === 'literature' ? 'selected' : ''}>أدبي</option>
                </select>
            </div>
            <div class="form-group">
                <label>الترم (Term)</label>
                <select id="editTerm" class="form-control">
                    <option value="" ${!student.term ? 'selected' : ''}>--</option>
                    <option value="1" ${student.term === '1' ? 'selected' : ''}>الترم الأول</option>
                    <option value="2" ${student.term === '2' ? 'selected' : ''}>الترم الثاني</option>
                </select>
            </div>
            <div class="form-group">
                <label>تاريخ انتهاء الاشتراك</label>
                <input type="datetime-local" id="editExpiry" class="form-control" value="${student.subscription_ends_at ? new Date(student.subscription_ends_at).toISOString().slice(0, 16) : ''}">
            </div>
            <div class="form-group">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                    <input type="checkbox" id="editIsActive" style="width:20px; height:20px;" ${student.is_active ? 'checked' : ''}>
                    <span>تفعيل الحساب (يسمح للطالب بدخول المنصة)</span>
                </label>
            </div>
        `,
        onSave: async () => {
            const updates = {
                full_name: document.getElementById('editName').value,
                points: parseInt(document.getElementById('editPoints').value) || 0,
                role: document.getElementById('editRole').value,
                grade: document.getElementById('editGrade').value,
                stream: document.getElementById('editStream').value || null,
                term: document.getElementById('editTerm').value || null,
                is_active: document.getElementById('editIsActive').checked,
                subscription_ends_at: document.getElementById('editExpiry').value || null,
            };

            const { error } = await supabase.from('profiles').update(updates).eq('id', id);

            if (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'خطأ',
                    text: error.message
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'تم التحديث!',
                    text: 'تم تعديل بيانات الطالب بنجاح.',
                    timer: 1500,
                    showConfirmButton: false
                });
                closeModal();
                loadStudents();
            }
        }
    });
};

// ==========================================
// 9. BULK ADD QUESTIONS
// ==========================================

window.openBulkAddModal = (examId) => {
    openModal({
        title: 'إضافة مجموعة أسئلة (Bulk Add)',
        body: `
            <div class="form-group">
                <label>انسخ مصفوفة JSON للأسئلة هنا:</label>
                <textarea id="bulkJsonInput" class="form-control" rows="10" placeholder='[
  {
    "question_text": "سؤال 1",
    "choice_a": "اختيار 1",
    "choice_b": "اختيار 2",
    "choice_c": "اختيار 3",
    "choice_d": "اختيار 4",
    "correct_answer": "a"
  }
]'></textarea>
                <small style="color:var(--text-light); display:block; margin-top:0.5rem;">
                    * تأكد أن التنسيق JSON صحيح. <br>
                    * الحقول المطلوبة: question_text, choice_a, choice_b, choice_c, choice_d, correct_answer
                </small>
            </div>
        `,
        onSave: async () => {
            const input = document.getElementById('bulkJsonInput').value.trim();
            if (!input) return;

            try {
                const questions = JSON.parse(input);
                if (!Array.isArray(questions)) throw new Error("يجب أن يكون المدخل مصفوفة [ ]");

                // Add exam_id to each question
                const preparedQuestions = questions.map(q => ({
                    ...q,
                    exam_id: examId
                }));

                const { error } = await supabase.from('questions').insert(preparedQuestions);

                if (error) throw error;

                Swal.fire({
                    icon: 'success',
                    title: 'تمت العملية بنجاح!',
                    text: `تم إضافة ${questions.length} سؤال بنجاح.`,
                });
                closeModal();

                // Refresh Current Exam View
                const { data: exam } = await supabase.from('exams').select('*').eq('id', examId).single();
                renderExamQuestions(exam);

            } catch (err) {
                console.error("Bulk Add Error:", err);
                Swal.fire({
                    icon: 'error',
                    title: 'خطأ في البيانات',
                    text: err.message
                });
            }
        }
    });
};

window.deleteStudent = async (id, name) => {
    const result = await Swal.fire({
        title: 'حذف طالب؟',
        text: `هل أنت متأكد من حذف الطالب (${name}) نهائياً؟ سيؤدي هذا لحذف حسابه وكل درجاته ولا يمكن التراجع!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، احذف نهائياً',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        try {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: 'تم الحذف!',
                text: 'تم حذف الطالب وحسابه بالكامل.',
                timer: 2000,
                showConfirmButton: false
            });
            loadStudents();
        } catch (err) {
            console.error("Delete Fail", err);
            Swal.fire({
                icon: 'error',
                title: 'فشل الحذف',
                text: err.message
            });
        }
    }
};

window.toggleStudentStatus = async (id, currentStatus) => {
    const newStatus = !currentStatus;

    if (newStatus) {
        // Activation flow
        openModal({
            title: 'تنشيط الاشتراك (إدارة ذكية)',
            body: `
                <div class="form-group">
                    <label>الخطط السريعة:</label>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                        <button class="btn btn-outline btn-sm" onclick="setDuration(30, 0, 0)">30 دقيقة</button>
                        <button class="btn btn-outline btn-sm" onclick="setDuration(0, 0, 1)">يوم واحد</button>
                        <button class="btn btn-outline btn-sm" onclick="setDuration(0, 0, 7)">أسبوع واحد</button>
                        <button class="btn btn-outline btn-sm" onclick="setDuration(0, 0, 30)">شهر (30 يوم)</button>
                    </div>
                </div>
                <div class="form-group" style="margin-top:20px;">
                    <label>تحديد مدة مخصصة:</label>
                    <div style="display:flex; gap:8px;">
                        <div style="flex:1"><small>أيام</small><input type="number" id="customDays" class="form-control" value="0"></div>
                        <div style="flex:1"><small>ساعات</small><input type="number" id="customHours" class="form-control" value="0"></div>
                        <div style="flex:1"><small>دقائق</small><input type="number" id="customMins" class="form-control" value="0"></div>
                    </div>
                </div>
            `,
            onSave: async () => {
                const days = parseInt(document.getElementById('customDays').value) || 0;
                const hours = parseInt(document.getElementById('customHours').value) || 0;
                const mins = parseInt(document.getElementById('customMins').value) || 0;

                if (days === 0 && hours === 0 && mins === 0) {
                    return Swal.fire({
                        icon: 'info',
                        title: 'تنبيه',
                        text: 'يرجى تحديد مدة التفعيل أولاً'
                    });
                }

                const now = new Date();
                const expiryDate = new Date(now.getTime());
                expiryDate.setDate(expiryDate.getDate() + days);
                expiryDate.setHours(expiryDate.getHours() + hours);
                expiryDate.setMinutes(expiryDate.getMinutes() + mins);

                const durationText = `${days} يوم، ${hours} ساعة، ${mins} دقيقة`;

                const { error } = await supabase.from('profiles').update({
                    is_active: true,
                    subscription_started_at: now.toISOString(),
                    subscription_ends_at: expiryDate.toISOString(),
                    last_duration_text: durationText
                }).eq('id', id);

                if (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'خطأ',
                        text: error.message
                    });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'تم التنشيط!',
                        text: 'تم تفعيل حساب الطالب بنجاح.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    closeModal();
                    loadStudents();
                }
            }
        });

        window.setDuration = (m, h, d) => {
            document.getElementById('customMins').value = m;
            document.getElementById('customHours').value = h;
            document.getElementById('customDays').value = d;
        };
    } else {
        // Deactivation
        const result = await Swal.fire({
            title: 'تعطيل الحساب؟',
            text: "هل تريد تعطيل هذا الحساب فوراً؟ لن يتمكن الطالب من الدخول حتى يتم التنشيط مرة أخرى.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'نعم، تعطيل',
            cancelButtonText: 'إلغاء'
        });

        if (result.isConfirmed) {
            const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', id);
            if (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'خطأ',
                    text: error.message
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'تم التعطيل',
                    text: 'تم تعطيل حساب الطالب بنجاح.',
                    timer: 1500,
                    showConfirmButton: false
                });
                loadStudents();
            }
        }
    }
};

function updateStats(students) {
    const now = new Date();
    const stats = {
        total: students.length,
        active: 0,
        pending: 0,
        expired: 0
    };

    students.forEach(s => {
        const expiry = s.subscription_ends_at ? new Date(s.subscription_ends_at) : null;
        const isExp = expiry && expiry < now;

        if (!s.is_active) stats.pending++;
        else if (isExp) stats.expired++;
        else stats.active++;
    });

    document.getElementById('statsTotal').textContent = stats.total;
    document.getElementById('statsActive').textContent = stats.active;
    document.getElementById('statsPending').textContent = stats.pending;
    document.getElementById('statsExpired').textContent = stats.expired;

    initCharts(students, stats);
}

function initCharts(students, stats) {
    const ctxLine = document.getElementById('enrollmentChart')?.getContext('2d');
    const ctxPie = document.getElementById('statusPieChart')?.getContext('2d');

    if (!ctxLine || !ctxPie) return;

    // --- 1. Line Chart Data (Last 7 Days) ---
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
    });

    const enrollmentCounts = last7Days.map(date => {
        return students.filter(s => s.created_at?.startsWith(date)).length;
    });

    if (enrollmentChartInstance) enrollmentChartInstance.destroy();
    enrollmentChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: last7Days.map(d => new Date(d).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })),
            datasets: [{
                label: 'المشتركون الجدد',
                data: enrollmentCounts,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#2563eb'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { borderDash: [5, 5] } },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            }
        }
    });

    // --- 2. Pie Chart Data (Status Distribution) ---
    if (statusPieChartInstance) statusPieChartInstance.destroy();
    statusPieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['نشط', 'معلق', 'منتهي'],
            datasets: [{
                data: [stats.active, stats.pending, stats.expired],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { family: 'Cairo' } } }
            }
        }
    });
}

// ==========================================
// 10. BROADCAST CENTER
// ==========================================

window.showBroadcastView = () => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('navBroadcast')?.classList.add('active');

    document.getElementById('pageTitle').textContent = 'الرئيسية > مركز التنبيهات';
    showView('broadcastView');
    loadBroadcastHistory();
};

window.toggleScheduleDate = (show) => {
    const group = document.getElementById('scheduleDateGroup');
    if (show) {
        group.style.display = 'block';
    } else {
        group.style.display = 'none';
    }
};

window.updateRadioStyles = (input) => {
    // Reset all labels
    document.querySelectorAll('input[name="publishType"]').forEach(radio => {
        const label = radio.parentElement;
        label.style.background = 'transparent';
        label.style.boxShadow = 'none';
        label.style.fontWeight = 'normal';
    });

    // Style active label
    if (input.checked) {
        const activeLabel = input.parentElement;
        activeLabel.style.background = 'white';
        activeLabel.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        activeLabel.style.fontWeight = 'bold';
    }
};

// Initialize Styles on Load
document.addEventListener('DOMContentLoaded', () => {
    const checkedRadio = document.querySelector('input[name="publishType"]:checked');
    if (checkedRadio) updateRadioStyles(checkedRadio);
});

window.sendBroadcast = async () => {
    const title = document.getElementById('bcTitle').value.trim();
    const message = document.getElementById('bcMessage').value.trim();
    const type = document.getElementById('bcType').value;
    const target = document.getElementById('bcTarget').value;

    // Scheduling Logic
    const publishType = document.querySelector('input[name="publishType"]:checked').value;
    let scheduledFor = new Date().toISOString();
    let expiresAt = document.getElementById('bcExpiryDate').value || null;

    if (publishType === 'later') {
        const scheduleInput = document.getElementById('bcScheduleDate').value;
        if (!scheduleInput) {
            return Swal.fire({ icon: 'warning', text: 'يرجى تحديد تاريخ ووقت النشر' });
        }
        scheduledFor = new Date(scheduleInput).toISOString();

        if (new Date(scheduledFor) <= new Date()) {
            return Swal.fire({ icon: 'warning', text: 'يجب أن يكون وقت النشر في المستقبل' });
        }
    }

    if (expiresAt) {
        expiresAt = new Date(expiresAt).toISOString();
        if (new Date(expiresAt) <= new Date(scheduledFor)) {
            return Swal.fire({ icon: 'warning', text: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ النشر' });
        }
    }

    if (!title || !message) {
        return Swal.fire({
            icon: 'warning',
            title: 'بيانات ناقصة',
            text: 'يرجى كتابة العنوان ومحتوى الرسالة'
        });
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('announcements').insert({
        title,
        message,
        type,
        target,
        author_id: user?.id,
        scheduled_for: scheduledFor,
        expires_at: expiresAt
    });

    if (error) {
        console.error("Broadcast Error:", error);
        Swal.fire({
            icon: 'error',
            title: 'فشل الإرسال',
            text: 'تأكد من تشغيل كود تحديث قاعدة البيانات الجديد: ' + error.message
        });
    } else {
        Swal.fire({
            icon: 'success',
            title: publishType === 'now' ? 'تم البث!' : 'تمت الجدولة!',
            text: publishType === 'now' ? 'تم إرسال التنبيه للطلاب بنجاح.' : 'سيظهر التنبيه للطلاب في الموعد المحدد.',
            timer: 2000,
            showConfirmButton: false
        });
        // Clear form
        document.getElementById('bcTitle').value = '';
        document.getElementById('bcMessage').value = '';
        document.getElementById('bcScheduleDate').value = '';
        document.getElementById('bcExpiryDate').value = '';
        loadBroadcastHistory();
    }
};

window.loadBroadcastHistory = async () => {
    const historyDiv = document.getElementById('broadcastHistory');

    const { data: bcs, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error || !bcs || bcs.length === 0) {
        historyDiv.innerHTML = `
            <div style="text-align: center; padding: 3rem; opacity: 0.5; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fas fa-history" style="font-size: 2rem; margin-bottom:1rem; display:block;"></i>
                <p>لا يوجد سجل رسائل بعد</p>
            </div>`;
        return;
    }

    const typeColors = {
        'info': { bg: '#eff6ff', border: '#bfdbfe', icon: 'fa-info-circle', color: '#1e40af' },
        'warning': { bg: '#fffbeb', border: '#fef3c7', icon: 'fa-exclamation-triangle', color: '#92400e' },
        'danger': { bg: '#fef2f2', border: '#fee2e2', icon: 'fa-exclamation-circle', color: '#991b1b' },
        'success': { bg: '#ecfdf5', border: '#d1fae5', icon: 'fa-check-circle', color: '#065f46' }
    };

    historyDiv.innerHTML = bcs.map(bc => {
        const style = typeColors[bc.type] || typeColors.info;
        const isScheduled = new Date(bc.scheduled_for) > new Date();
        const isExpired = bc.expires_at && new Date(bc.expires_at) < new Date();

        let statusBadge = '';
        if (isScheduled) statusBadge = `<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:99px; font-size:0.7rem;">مجدول</span>`;
        else if (isExpired) statusBadge = `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:99px; font-size:0.7rem;">منتهي</span>`;
        else statusBadge = `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:99px; font-size:0.7rem;">نشط</span>`;

        return `
            <div style="background: ${style.bg}; border: 1px solid ${style.border}; padding: 1.5rem; border-radius: 12px; margin-bottom: 1rem; position: relative;">
                <button onclick="cancelBroadcast('${bc.id}')" title="إلغاء التنبيه" style="position: absolute; top: 15px; left: 15px; background: white; border: 1px solid #fee2e2; color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;">
                    <i class="fas fa-trash-alt"></i>
                </button>

                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; padding-left: 40px;">
                    <h4 style="margin: 0; color: ${style.color}; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                        <i class="fas ${style.icon}"></i>
                        ${bc.title}
                        ${statusBadge}
                    </h4>
                </div>
                <p style="margin: 0; color: #334155; font-size: 0.95rem; line-height: 1.6;">${bc.message}</p>
                <div style="margin-top: 1rem; font-size: 0.8rem; color: #64748b; display: flex; flex-wrap: wrap; gap: 15px; background: rgba(255,255,255,0.5); padding: 8px; border-radius: 8px;">
                    <span><i class="fas fa-bullseye"></i> <b>المستهدف:</b> ${bc.target === 'all' ? 'الكل' : bc.target}</span>
                    <span><i class="far fa-clock"></i> <b>النشر:</b> ${new Date(bc.scheduled_for || bc.created_at).toLocaleString('ar-EG')}</span>
                    ${bc.expires_at ? `<span><i class="fas fa-hourglass-end"></i> <b>الانتهاء:</b> ${new Date(bc.expires_at).toLocaleString('ar-EG')}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
};

window.cancelBroadcast = async (id) => {
    const result = await Swal.fire({
        title: 'إلغاء التنبيه؟',
        text: 'سيتم حذف التنبيه نهائياً ولن يظهر للطلاب بعد الآن.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، إلغاء وحذف',
        cancelButtonText: 'تراجع'
    });

    if (result.isConfirmed) {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) {
            Swal.fire({ icon: 'error', title: 'خطأ', text: error.message });
        } else {
            Swal.fire({ icon: 'success', title: 'تم الحذف', text: 'تم إلغاء التنبيه بنجاح.', timer: 1500, showConfirmButton: false });
            loadBroadcastHistory();
        }
    }
};

