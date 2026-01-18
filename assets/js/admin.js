import { supabase } from "./supabaseClient.js";

// ==========================================
// 1. STATE & AUTH
// ==========================================
let currentUser = null;
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

    // Close sidebar when clicking navigation items on mobile
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 992) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 992 &&
            sidebar.classList.contains('mobile-open') &&
            !sidebar.contains(e.target) &&
            e.target !== mobileToggle) {
            sidebar.classList.remove('mobile-open');
        }
    });

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
        <div style="display:flex; justify-content:space-between; align-items:center;">
             <h3>${exam.title} <small style="font-size:0.8rem; color:#666;">(إدارة الأسئلة)</small></h3>
             <button class="btn btn-outline" style="color:red" onclick="deleteItem('exams', '${exam.id}')"><i class="fas fa-trash"></i></button>
        </div>
        <hr style="margin:1rem 0;">
        
        <div class="form-group" style="background:#f9fafb; padding:1.5rem; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h4 style="margin:0;">إضافة سؤال جديد</h4>
                <button class="btn btn-outline btn-sm" onclick="openBulkAddModal('${exam.id}')">
                    <i class="fas fa-layer-group"></i> إضافة مجموعة
                </button>
            </div>
            <textarea id="NewQText" class="form-control" placeholder="نص السؤال..." rows="2"></textarea>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                <input id="OptA" class="form-control" placeholder="Option A">
                <input id="OptB" class="form-control" placeholder="Option B">
                <input id="OptC" class="form-control" placeholder="Option C">
                <input id="OptD" class="form-control" placeholder="Option D">
            </div>
            <div style="margin-top:10px; display:flex; gap:10px;">
                <select id="CorrectOpt" class="form-control" style="width:150px;">
                    <option value="a">الإجابة: A</option>
                    <option value="b">الإجابة: B</option>
                    <option value="c">الإجابة: C</option>
                    <option value="d">الإجابة: D</option>
                </select>
                <button class="btn btn-primary" onclick="addQuestion('${exam.id}')">حفظ السؤال</button>
            </div>
        </div>

        <div class="questions-list" style="margin-top:2rem;">
            ${questions.map((q, i) => `
                <div style="padding:1rem; border:1px solid #eee; margin-bottom:10px; border-radius:6px; background:white;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>س${i + 1}: ${q.question_text}</strong>
                        <button class="btn-icon delete" style="color:red;" onclick="deleteQuestion('${q.id}', '${exam.id}')">&times;</button>
                    </div>
                    <div style="font-size:0.9rem; color:#666; margin-top:5px;">
                        A: ${q.choice_a} | B: ${q.choice_b} | C: ${q.choice_c} | D: ${q.choice_d} 
                        <br> <span style="color:green; font-weight:bold;">Correct: ${q.correct_answer.toUpperCase()}</span>
                    </div>
                </div>
            `).join('')}
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

    if (!text || !a || !b) return alert("اكمل البيانات");

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
    if (!confirm("حذف؟")) return;
    await supabase.from('questions').delete().eq('id', qId);
    const { data: exam } = await supabase.from('exams').select('*').eq('id', examId).single();
    renderExamQuestions(exam);
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
    // Highlight specific if needed

    document.getElementById('pageTitle').textContent = 'الرئيسية > إدارة الطلاب';
    showView('studentsView');
    await loadStudents();
}

window.loadStudents = async () => {
    const tableBody = document.getElementById('studentsTableBody');
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;"><div class="spinner"></div></td></tr>';

    const searchStr = document.getElementById('studentSearch').value.trim();

    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });

    if (searchStr) {
        query = query.ilike('full_name', `%${searchStr}%`);
    }

    const { data: students, error } = await query;

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">خطأ في التحميل: ${error.message}</td></tr>`;
        return;
    }

    if (!students || students.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">لا يوجد طلاب</td></tr>';
        return;
    }

    tableBody.innerHTML = students.map(s => {
        const roleBadge = s.role === 'admin'
            ? `<span style="background:#def7ec; color:#03543f; padding:2px 6px; border-radius:4px; font-size:0.8rem;">Admin</span>`
            : ``;

        // Translation Mapping
        const streamMap = {
            'science_bio': 'علمي علوم',
            'science_math': 'علمي رياضة',
            'literature': 'أدبي'
        };
        const termMap = {
            '1': 'الترم الأول',
            '2': 'الترم الثاني'
        };
        const roleMap = {
            'admin': 'آدمن',
            'student': 'طالب'
        };

        const displayStreamOrTerm = s.grade === '3'
            ? (streamMap[s.stream] || s.stream || '-')
            : (termMap[s.term] || s.term || '-');

        return `
        <tr>
            <td style="padding:1rem;">
                <div style="font-weight:bold;">${s.full_name || 'بدون اسم'} ${roleBadge}</div>
                <div style="font-size:0.8rem; color:#666;">ID: ${s.id.substr(0, 8)}...</div>
            </td>
            <td style="padding:1rem;">${s.email || '-'}</td>
            <td style="padding:1rem;">${s.grade || '-'}</td>
            <td style="padding:1rem;">
                ${displayStreamOrTerm}
            </td>
            <td style="padding:1rem;">${s.points || 0}</td>
            <td style="padding:1rem;">${roleMap[s.role] || s.role || 'طالب'}</td>
            <td style="padding:1rem;">
                ${s.is_active
                ? `<span style="color:green; font-weight:bold;"><i class="fas fa-check-circle"></i> مفعل</span>`
                : `<span style="color:#d97706; font-weight:bold;"><i class="fas fa-clock"></i> معلق</span>`}
            </td>
            <td style="padding:1rem;">
                <button class="btn btn-sm" 
                    style="background:${s.is_active ? '#f3f4f6' : '#dcfce7'}; color:${s.is_active ? '#374151' : '#15803d'}; margin-right:5px;" 
                    onclick="toggleStudentStatus('${s.id}', ${s.is_active})" title="${s.is_active ? 'تعطيل' : 'تفعيل'}">
                    <i class="fas ${s.is_active ? 'fa-user-slash' : 'fa-user-check'}"></i>
                </button>
                <button class="btn btn-primary btn-sm" onclick="openEditStudent('${s.id}')" title="تعديل">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm" onclick="deleteStudent('${s.id}', '${s.full_name}')" style="background:#fee2e2; color:#b91c1c; margin-right:5px;" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `}).join('');
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
            };

            const { error } = await supabase.from('profiles').update(updates).eq('id', id);

            if (error) alert(error.message);
            else {
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

                alert(`تم إضافة ${questions.length} سؤال بنجاح!`);
                closeModal();

                // Refresh Current Exam View
                const { data: exam } = await supabase.from('exams').select('*').eq('id', examId).single();
                renderExamQuestions(exam);

            } catch (err) {
                console.error("Bulk Add Error:", err);
                alert("خطأ في البيانات: " + err.message);
            }
        }
    });
};

window.deleteStudent = async (id, name) => {
    if (!confirm(`هل أنت متأكد من حذف الطالب (${name}) نهائياً؟ \nسيؤدي هذا لحذف حسابه وكل درجاته ولا يمكن التراجع عن هذه الخطوة.`)) return;

    try {
        // بمجرد الحذف من هنا، التريجر في SQL سيتولى حذف حسابه من Auth تلقائياً
        const { error } = await supabase.from('profiles').delete().eq('id', id);

        if (error) throw error;

        alert("تم حذف الطالب وحسابه بالكامل بنجاح ✅");
        loadStudents();
    } catch (err) {
        console.error("Delete Fail", err);
        alert("فشل الحذف: " + err.message);
    }
};

window.toggleStudentStatus = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    const confirmMsg = newStatus
        ? "هل تريد تفعيل حساب هذا الطالب ليتمكن من دخول المنصة؟"
        : "هل تريد تعطيل حساب هذا الطالب ومنعه من دخول المنصة؟";

    if (!confirm(confirmMsg)) return;

    const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', id);

    if (error) {
        alert("فشل التحديث: " + error.message);
    } else {
        loadStudents();
    }
};

