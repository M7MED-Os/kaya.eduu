import { supabase } from "./supabaseClient.js";
import { clearCacheByPattern } from "./utils.js";
import { showSuccessAlert, showErrorAlert, showWarningAlert, showDeleteConfirmDialog, showLoadingAlert } from "./utils/alerts.js";

// Import admin modules
import { initAdminCore, checkAdminAuth, showView, currentContext, openModal, closeModal, triggerCelebration } from "./admin/admin-core.js";
import { renderExamQuestions } from "./admin/admin-questions.js";
import { showFreemiumSettingsView, saveFreemiumSettings } from "./admin/freemium.js";
import "./admin/admin-subjects.js";
import "./admin/admin-content.js";

window.showFreemiumSettingsView = showFreemiumSettingsView;
window.saveFreemiumSettings = saveFreemiumSettings;

// Import Polls logic
import "./admin/polls.js";

// Local chart instances for student management (kept in main file)
let enrollmentChartInstance = null;
let statusPieChartInstance = null;

// Online presence tracking
let presenceChannel = null;
let onlineUsers = new Set();

// ==========================================
// STUDENT & SQUAD MANAGEMENT (kept in main file)
// ==========================================
// Note: Subject/Question/Content management moved to admin/ modules

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize core admin functionality
    const isAuthorized = await checkAdminAuth();
    if (!isAuthorized) return;

    initAdminCore();

    // Set default view to Students
    showStudentsView();

    // Setup student-specific filters (kept in main file)
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

    // Real-time squad search and filters
    const squadFilterControls = ['squadSearch', 'filterSquadGrade', 'filterSquadDept'];
    squadFilterControls.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => loadSquadsAdmin());
            el.addEventListener('change', () => loadSquadsAdmin());
        }
    });

    function updateStreamFilter() {
        const grade = document.getElementById('filterGrade').value;
        const group = document.getElementById('streamFilterGroup');
        const select = document.getElementById('filterStream');

        if (grade === 'all' || grade === 'first_year' || grade === 'second_year' || grade === '1' || grade === '2') {
            group.style.display = 'none';
            return;
        }

        group.style.display = 'block';
        let options = '<option value="all">كل الشعب</option>';

        if (grade === 'third_year' || grade === '3') {
            options += `
                <option value="science_science">علمي علوم</option>
                <option value="science_math">علمي رياضة</option>
                <option value="literary">أدبي</option>
            `;
        }
        select.innerHTML = options;
    }

    // Initialize presence tracking for admin
    initAdminPresence();
});

// ==========================================
// PRESENCE TRACKING FOR ADMIN
// ==========================================

function initAdminPresence() {
    presenceChannel = supabase.channel('online-users');

    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            onlineUsers.clear();

            // Collect all online user IDs
            Object.keys(state).forEach(key => {
                const presences = state[key];
                presences.forEach(presence => {
                    if (presence.user_id) {
                        onlineUsers.add(presence.user_id);
                    }
                });
            });

            // Update counter
            updateOnlineCounter();

            // Instead of reloading EVERYTHING, just update the status icons in the table
            refreshOnlineIcons();
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            const userName = newPresences[0]?.full_name || key;
            console.log('[Admin Presence] User joined:', userName);
        })
        .subscribe();
}

function updateOnlineCounter() {
    const counter = document.getElementById('statsOnline');
    if (counter) {
        counter.textContent = onlineUsers.size;
    }
}

function getOnlineStatus(student) {
    const userId = student.id;

    if (onlineUsers.has(userId)) {
        return { status: 'online', text: 'متصل الآن', color: '#16a34a', icon: 'fa-circle' };
    }

    // Check last_seen from student profile
    const lastSeen = student.last_seen;
    if (lastSeen) {
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

        if (diffMinutes < 5) {
            return { status: 'recent', text: `نشط منذ ${diffMinutes} دقيقة`, color: '#f59e0b', icon: 'fa-clock' };
        } else if (diffMinutes < 60) {
            return { status: 'away', text: `نشط منذ ${diffMinutes} دقيقة`, color: '#94a3b8', icon: 'fa-clock' };
        } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            return { status: 'away', text: `نشط منذ ${hours} ساعة`, color: '#94a3b8', icon: 'fa-clock' };
        }
    }

    return { status: 'offline', text: 'غير متصل', color: '#cbd5e1', icon: 'fa-circle' };
}

/**
 * Selective update of online status icons in the student table
 * to avoid full page reloads when presence changes.
 */
function refreshOnlineIcons() {
    const tableBody = document.getElementById('studentsTableBody');
    if (!tableBody) return;

    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
        // Find the status cell (index 7 in the current table structure)
        const studentId = row.querySelector('.btn-primary')?.getAttribute('href')?.split('=')[1];
        if (!studentId) return;

        const statusCell = row.querySelector('td[data-label="الحالة الآن"]');
        if (statusCell) {
            // Find the student's full data from the original list if possible
            // For now, let's just get the icon and color based on ID
            // Since we only need to know if they are in onlineUsers Set for "متصل الآن"
            const isOnline = onlineUsers.has(studentId);

            // If they are online, update icon to green circle
            if (isOnline) {
                statusCell.innerHTML = `
                    <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
                        <i class="fas fa-circle" style="color:#16a34a; font-size:0.5rem;"></i>
                        <span style="font-size:0.8rem; color:#16a34a; font-weight:600;">متصل الآن</span>
                    </div>
                `;
            } else {
                // If they were online and now offline, we might want to refresh the table 
                // to get the correct "active X mins ago" from DB, but let's avoid it for now
                // to prevent flickering. Or just leave it as is until next manual refresh.
                // The user's main complaint was the flickering/reloading.
            }
        }
    });

    // If the "Online Only" filter is active, we MUST reload the table to hide/show students
    const filterStatus = document.getElementById('filterStatus')?.value;
    if (filterStatus === 'online') {
        const lastReload = sessionStorage.getItem('last_online_reload') || 0;
        const now = Date.now();
        if (now - lastReload > 5000) { // Throttled reload for "Online Only" view
            loadStudents();
            sessionStorage.setItem('last_online_reload', now);
        }
    }
}

// ==========================================
// STUDENTS MANAGEMENT (Kept in main file)
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

        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'online' ? onlineUsers.has(s.id) : sStatus === filterStatus);

        // Grade Filter
        const student_year = s.academic_year;
        const matchesGrade = filterGrade === 'all' || student_year == filterGrade;

        // Stream/Term Filter
        const student_department = s.department;
        const student_term = s.current_term;
        const matchesStream = filterStream === 'all' || student_department == filterStream || student_term == filterStream;

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
        // Get student data
        const student_year = s.academic_year;
        const student_term = s.current_term;
        const student_department = s.department;

        const roleStr = s.role === 'admin' ? 'آدمن' : 'طالب';
        const roleClass = s.role === 'admin' ? 'badge-info' : 'badge-gray';

        // Translation Mapping for Secondary School
        const gradeMap = {
            'first_year': 'سنة أولى',
            'second_year': 'سنة تانية',
            'third_year': 'سنة تالتة',
            '1': 'سنة أولى',
            '2': 'سنة تانية',
            '3': 'سنة تالتة'
        };

        const streamMap = {
            'science_science': 'علمي علوم',
            'science_math': 'علمي رياضة',
            'literary': 'أدبي',
            'general': 'عام'
        };

        const termMap = {
            '1': 'ترم أول',
            '2': 'ترم ثاني',
            'first_term': 'ترم أول',
            'second_term': 'ترم ثاني'
        };

        // Display logic: Show stream - term (e.g., "علمي علوم - ترم أول")
        let displayInfo = [];

        // For year 3, show stream
        if ((student_year === 'third_year' || student_year === '3') && student_department) {
            displayInfo.push(streamMap[student_department] || student_department);
        }

        const displayStreamOrTerm = displayInfo.length > 0 ? displayInfo.join(' - ') : '-';

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
            <td data-label="السنة"><span class="badge badge-info">${gradeMap[student_year] || student_year || '-'}</span></td>
            <td data-label="الترم/القسم">${displayStreamOrTerm}</td>
            <td data-label="النقاط"><strong>${s.points || 0}</strong></td>
            <td data-label="الدور"><span class="badge ${roleClass}">${roleStr}</span></td>
            <td data-label="الحالة">${statusHtml}</td>
            <td data-label="الانتهاء">${expiryHtml}</td>
            <td data-label="الحالة الآن">${(() => {
                const onlineStatus = getOnlineStatus(s);
                return `<div style="display:flex; align-items:center; gap:6px; justify-content:center;">
                    <i class="fas ${onlineStatus.icon}" style="color:${onlineStatus.color}; font-size:0.5rem;"></i>
                    <span style="font-size:0.8rem; color:${onlineStatus.color}; font-weight:600;">${onlineStatus.text}</span>
                </div>`;
            })()}</td>
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
                    
                    <a href="student-profile.html?id=${s.id}" target="_blank" class="btn btn-primary btn-sm" style="width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0; flex-shrink:0; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;" title="معاينة البروفايل">
                        <i class="fas fa-eye" style="font-size:0.85rem;"></i>
                    </a>

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
                <select id="editGrade" class="form-control">
                    <option value="first_year" ${student.academic_year === 'first_year' ? 'selected' : ''}>سنة أولى</option>
                    <option value="second_year" ${student.academic_year === 'second_year' ? 'selected' : ''}>سنة تانية</option>
                    <option value="third_year" ${student.academic_year === 'third_year' ? 'selected' : ''}>سنة تالتة</option>
                </select>
            </div>
            <div class="form-group">
                <label>الترم الدراسي</label>
                <select id="editTerm" class="form-control">
                    <option value="first_term" ${student.current_term === 'first_term' ? 'selected' : ''}>الترم الأول</option>
                    <option value="second_term" ${student.current_term === 'second_term' ? 'selected' : ''}>الترم الثاني</option>
                </select>
            </div>
            <div class="form-group">
                <label>الشعبة (للسنة التالتة)</label>
                <select id="editStream" class="form-control">
                    <option value="" ${!student.department ? 'selected' : ''}>-- بدون شعبة --</option>
                    <option value="science_science" ${student.department === 'science_science' ? 'selected' : ''}>علمي علوم</option>
                    <option value="science_math" ${student.department === 'science_math' ? 'selected' : ''}>علمي رياضة</option>
                    <option value="literary" ${student.department === 'literary' ? 'selected' : ''}>أدبي</option>
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
            <div class="form-group">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; color: var(--primary-color); font-weight: bold;">
                    <input type="checkbox" id="editShowLeaderboard" style="width:20px; height:20px;" ${student.show_on_leaderboard !== false ? 'checked' : ''}>
                    <span>الظهور في لوحة المتصدرين</span>
                </label>
            </div>
        `,
        onSave: async () => {
            const gradeVal = document.getElementById('editGrade').value;
            const streamVal = document.getElementById('editStream').value || null;
            const termVal = document.getElementById('editTerm').value || null;

            // gradeVal is already in the correct format (first_year, second_year, etc.)
            const academic_year = gradeVal;

            const updates = {
                full_name: document.getElementById('editName').value,
                points: parseInt(document.getElementById('editPoints').value) || 0,
                role: document.getElementById('editRole').value,
                academic_year: academic_year,
                current_term: termVal,
                department: streamVal,
                is_active: document.getElementById('editIsActive').checked,
                show_on_leaderboard: document.getElementById('editShowLeaderboard').checked,
                subscription_ends_at: document.getElementById('editExpiry').value ? new Date(document.getElementById('editExpiry').value).toISOString() : null,
            };

            const { error } = await supabase.from('profiles').update(updates).eq('id', id);

            if (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'خطأ',
                    text: error.message
                });
            } else {
                // Clean up old data via RPC (optional - won't fail if function doesn't exist)
                try {
                    await supabase.rpc('cleanup_student_data', {
                        p_user_id: id,
                        p_academic_year: updates.academic_year,
                        p_current_term: updates.current_term || '',
                        p_department: updates.department || ''
                    });
                } catch (rpcError) {
                    console.warn('cleanup_student_data RPC not available:', rpcError);
                }

                Swal.fire({
                    icon: 'success',
                    title: 'تم التحديث!',
                    text: 'تم تعديل بيانات الطالب وتنظيف السجلات القديمة بنجاح.',
                    timer: 1500,
                    showConfirmButton: false
                });

                // Clear any leaderboard cache to reflect changes immediately
                clearCacheByPattern('leaderboard_');
                clearCacheByPattern('squad_leaderboard_');

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
                    * الحقول المطلوبة: question_text, choice_a, choice_b, correct_answer <br>
                    * الحقول الاختيارية: choice_c, choice_d (اتركها للأسئلة الصح والغلط)
                </small>
            </div>
        `,
        onSave: async () => {
            const input = document.getElementById('bulkJsonInput').value.trim();
            if (!input) return;

            try {
                const questions = JSON.parse(input);
                if (!Array.isArray(questions)) throw new Error("يجب أن يكون المدخل مصفوفة [ ]");

                // Add exam_id and ensure all choice fields exist for DB compatibility
                const preparedQuestions = questions.map(q => ({
                    question_text: q.question_text || "",
                    choice_a: q.choice_a || "",
                    choice_b: q.choice_b || "",
                    choice_c: q.choice_c || "",
                    choice_d: q.choice_d || "",
                    correct_answer: q.correct_answer || "a",
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
            const { error } = await supabase.rpc('admin_delete_student', { p_student_id: id });
            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: 'تم الحذف!',
                text: 'تم حذف الطالب وكل بياناته المرتبطة بنجاح.',
                timer: 2000,
                showConfirmButton: false
            });

            // Clear cache to reflect deletion in leaderboard
            clearCacheByPattern('leaderboard_');
            clearCacheByPattern('squad_leaderboard_');

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
                    triggerCelebration('main');

                    // Clear any leaderboard cache to reflect changes immediately
                    clearCacheByPattern('leaderboard_');
                    clearCacheByPattern('squad_leaderboard_');

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

                // Clear any leaderboard cache to reflect changes immediately
                clearCacheByPattern('leaderboard_');
                clearCacheByPattern('squad_leaderboard_');

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

// ==========================================
// 11. SQUADS MANAGEMENT
// ==========================================

window.showSquadsView = () => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('navSquads')?.classList.add('active');
    document.getElementById('pageTitle').textContent = 'الرئيسية > إدارة الشلل';
    showView('squadsView');
    loadSquadSettings(); // Load global configs first
    loadSquadsAdmin();
};

async function loadSquadsAdmin() {
    const tbody = document.getElementById('squadsTableBody');
    const searchValue = document.getElementById('squadSearch')?.value.toLowerCase() || '';
    const filterGrade = document.getElementById('filterSquadGrade')?.value || 'all';
    const filterDept = document.getElementById('filterSquadDept')?.value || 'all';

    tbody.innerHTML = '<tr><td colspan="6"><div class="spinner"></div></td></tr>';

    let query = supabase.from('squads').select(`
        *,
        profiles!squads_owner_id_fkey (full_name),
        squad_members!squad_members_squad_id_fkey (count)
    `);

    // Fetch all for local filtering (since cross-table complex searches are better handled simply if dataset is small)
    const { data: squads, error } = await query.order('points', { ascending: false });

    if (error) return Swal.fire('Error', error.message, 'error');

    // Stats Accumulators
    let totalMembers = 0;
    let totalPoints = 0;

    const filteredSquads = squads.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchValue) || s.id.toLowerCase().includes(searchValue);
        const matchesGrade = filterGrade === 'all' || s.academic_year == filterGrade;
        const matchesDept = filterDept === 'all' || s.department == filterDept;

        if (matchesSearch && matchesGrade && matchesDept) {
            totalMembers += s.squad_members?.[0]?.count || 0;
            totalPoints += s.points || 0;
            return true;
        }
        return false;
    });

    // Update Stats UI
    document.getElementById('statsTotalSquads').textContent = filteredSquads.length;
    document.getElementById('statsAvgPoints').textContent = filteredSquads.length > 0 ? Math.round(totalPoints / filteredSquads.length) : 0;
    document.getElementById('statsTotalMembers').textContent = totalMembers;

    if (filteredSquads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:2rem; color:#64748b;">لا يوجد نتائج تطابق بحثك</td></tr>';
        return;
    }

    tbody.innerHTML = filteredSquads.map(s => {
        const streamMap = {
            'science_science': 'علمي علوم',
            'science_math': 'علمي رياضة',
            'literary': 'أدبي',
            'general': 'عام'
        };
        const gradeMap = { '1': 'أولى ثانوي', '2': 'تانية ثانوي', '3': 'تالتة ثانوي' };

        return `
        <tr>
            <td data-label="الشلة">
                <div style="font-weight:800; color:var(--primary-color); font-size:1.05rem;">${s.name}</div>
                <div style="font-size:0.75rem; color:#94a3b8; font-family:monospace;">Code: ${s.id.split('-')[0].toUpperCase()}</div>
            </td>
            <td data-label="المستوى / القسم">
                <div style="font-weight:600;">الفرقة ${gradeMap[s.academic_year] || s.academic_year}</div>
                <div style="font-size:0.8rem; color:#64748b;">${streamMap[s.department] || s.department || 'عام'}</div>
            </td>
            <td data-label="المالك">
                <div style="font-weight:600; cursor:pointer; color:#0369a1;" onclick="openEditStudent('${s.owner_id}')">
                   <i class="fas fa-user-circle"></i> ${s.profiles?.full_name || 'غير معروف'}
                </div>
            </td>
            <td data-label="النقاط"><span class="badge badge-info" style="font-size:1rem; padding: 4px 12px;">${s.points || 0}</span></td>
            <td data-label="الأعضاء">
                <button class="btn btn-outline btn-sm" style="padding: 4px 10px; border-radius:8px;" onclick="viewSquadMembers('${s.id}', '${s.name}')">
                    <i class="fas fa-users"></i> ${s.squad_members?.[0]?.count || 0}
                </button>
            </td>
            <td data-label="إجراءات">
                <div style="display:flex; gap:8px; justify-content: flex-end;">
                    <a href="squad-profile.html?id=${s.id}" target="_blank" class="btn btn-sm" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0;" title="معاينة البروفايل">
                        <i class="fas fa-eye"></i>
                    </a>
                    <button class="btn btn-sm" style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0;" 
                            onclick="openEditSquadModal(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="تعديل الشلة">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm" style="background:#fef2f2; color:#ef4444; border:1px solid #fee2e2; width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0;" 
                            onclick="deleteSquad('${s.id}')" title="حذف الشلة">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-sm" style="background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; width:34px; height:34px; display:flex; align-items:center; justify-content:center; padding:0;" 
                            onclick="resetSquadPoints('${s.id}')" title="تصفير النقاط">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

window.openEditSquadModal = (squad) => {
    // Labels mapping for Secondary School
    const gradeLabels = { '1': 'سنة أولى', '2': 'سنة تانية', '3': 'سنة تالتة' };
    const deptLabels = {
        'general': 'عام',
        'science_science': 'علمي علوم',
        'science_math': 'علمي رياضة',
        'literary': 'أدبي'
    };

    const isGradeSelected = (v) => squad.academic_year === v || squad.academic_year === gradeLabels[v];
    const isDeptSelected = (v) => squad.department === v || squad.department === deptLabels[v];

    openModal({
        title: 'تعديل بيانات الشلة',
        body: `
            <div class="form-group">
                <label>اسم الشلة</label>
                <input type="text" id="editSquadName" class="form-control" value="${squad.name}">
            </div>
            <div class="form-group">
                <label>السنة الدراسية</label>
                <select id="editSquadGrade" class="form-control">
                    <option value="1" ${isGradeSelected('1') ? 'selected' : ''}>سنة أولى</option>
                    <option value="2" ${isGradeSelected('2') ? 'selected' : ''}>سنة تانية</option>
                    <option value="3" ${isGradeSelected('3') ? 'selected' : ''}>سنة تالتة</option>
                </select>
            </div>
            <div class="form-group">
                <label>الشعبة</label>
                <select id="editSquadDept" class="form-control">
                    <option value="general" ${isDeptSelected('general') ? 'selected' : ''}>عام</option>
                    <option value="science_science" ${isDeptSelected('science_science') ? 'selected' : ''}>علمي علوم</option>
                    <option value="science_math" ${isDeptSelected('science_math') ? 'selected' : ''}>علمي رياضة</option>
                    <option value="literary" ${isDeptSelected('literary') ? 'selected' : ''}>أدبي</option>
                </select>
            </div>
            <div class="form-group">
                <label>النقاط الحالية</label>
                <input type="number" id="editSquadPoints" class="form-control" value="${squad.points || 0}">
            </div>
        `,
        onSave: async () => {
            const updates = {
                name: document.getElementById('editSquadName').value,
                academic_year: document.getElementById('editSquadGrade').value,
                department: document.getElementById('editSquadDept').value,
                points: parseInt(document.getElementById('editSquadPoints').value) || 0
            };

            const { error } = await supabase.from('squads').update(updates).eq('id', squad.id);

            if (error) {
                Swal.fire('خطأ', error.message, 'error');
            } else {
                Swal.fire('تم!', 'تم تحديث بيانات الشلة بنجاح', 'success');
                closeModal();
                loadSquadsAdmin();
            }
        }
    });
};

window.deleteSquad = async (id) => {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "حذف الشلة سيحذف كل الرسائل والمهام والأعضاء بداخلها!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        try {
            const { error } = await supabase.rpc('admin_delete_squad', { p_squad_id: id });
            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: 'تم!',
                text: 'تم حذف الشلة بكل بياناتها بنجاح',
                timer: 2000,
                showConfirmButton: false
            });
            loadSquadsAdmin();
        } catch (err) {
            console.error("Squad Delete Fail", err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: err.message
            });
        }
    }
};


window.viewSquadMembers = async (squadId, squadName) => {
    openModal({
        title: `أعضاء شلة: ${squadName}`,
        body: '<div id="modalMemberList" class="text-center" style="padding:2rem;"><div class="spinner"></div> جاري تحميل الأعضاء...</div>',
        onSave: () => closeModal()
    });

    try {
        const { data: members, error } = await supabase
            .from('squad_members')
            .select(`
                profile_id,
                profiles!squad_members_profile_id_fkey (full_name, points)
            `)
            .eq('squad_id', squadId);

        if (error) throw error;

        const body = document.getElementById('modalMemberList');
        if (!members || members.length === 0) {
            body.innerHTML = '<p class="text-center">لا يوجد أعضاء في هذه الشلة!</p>';
            return;
        }

        body.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${members.map(m => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9;">
                        <span style="font-weight: 700; color: #1e293b;">${m.profiles?.full_name || 'طالب مجهول'}</span>
                        <button class="btn btn-sm" style="color: #ef4444; background: #fff1f2; border: 1px solid #fecaca; padding: 4px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700;" 
                                onclick="removeMemberFromSquadAdmin('${squadId}', '${m.profile_id}', '${squadName}')">
                            <i class="fas fa-user-minus"></i> طرد
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

    } catch (err) {
        document.getElementById('modalMemberList').innerHTML = `<p style="color:#ef4444;">خطأ: ${err.message}</p>`;
    }
};

window.removeMemberFromSquadAdmin = async (squadId, profileId, squadName) => {
    const result = await Swal.fire({
        title: 'طرد عضو؟',
        text: 'هل أنت متأكد من طرد هذا الطالب من الشلة؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، اطرد',
        cancelButtonText: 'تراجع'
    });

    if (result.isConfirmed) {
        const { error } = await supabase.from('squad_members').delete().match({ squad_id: squadId, profile_id: profileId });
        if (error) Swal.fire('Error', error.message, 'error');
        else {
            Swal.fire('تم!', 'تم طرد العضو بنجاح', 'success');
            viewSquadMembers(squadId, squadName); // Reload list
            loadSquadsAdmin(); // Update counts in main table
        }
    }
};

window.resetSquadPoints = async (id) => {
    const result = await Swal.fire({
        title: 'تصفير نقاط الشلة؟',
        text: "هذا الإجراء سيعيد نقاط الشلة إلى صفر!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'تصفير الآن',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        const { error } = await supabase.from('squads').update({ points: 0 }).eq('id', id);
        if (error) Swal.fire('Error', error.message, 'error');
        else {
            Swal.fire('تم!', 'تم تصفير النقاط بنجاح', 'success');
            loadSquadsAdmin();
        }
    }
};
window.showLeaderboardMgmtView = async () => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('navLeaderboard')?.classList.add('active');

    document.getElementById('pageTitle').textContent = 'الرئيسية > إدارة الأوائل';
    showView('leaderboardMgmtView');

    // Load current settings
    await loadLeaderboardSettings();
};

async function loadLeaderboardSettings() {
    try {
        const { data, error } = await supabase
            .from('app_configs')
            .select('value')
            .eq('key', 'leaderboard_settings')
            .maybeSingle();

        if (error) throw error;

        if (data && data.value) {
            document.getElementById('settingTopStudents').value = data.value.top_students || 50;
            document.getElementById('settingTopSquads').value = data.value.top_squads || 10;
            document.getElementById('settingRefreshInterval').value = data.value.refresh_interval || 10;
        }
    } catch (err) {
        console.error("Error loading settings:", err);
        // Fallback to defaults already in HTML
    }
}

window.saveLeaderboardSettings = async () => {
    const topStudents = parseInt(document.getElementById('settingTopStudents').value);
    const topSquads = parseInt(document.getElementById('settingTopSquads').value);
    const refreshInterval = parseInt(document.getElementById('settingRefreshInterval').value);

    if (isNaN(topStudents) || topStudents < 1 || isNaN(topSquads) || topSquads < 1 || isNaN(refreshInterval) || refreshInterval < 1) {
        return Swal.fire('خطأ', 'يرجى إدخال أرقام صحيحة', 'error');
    }

    Swal.fire({
        title: 'جاري الحفظ...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // Use upsert to save settings
        const { error } = await supabase
            .from('app_configs')
            .upsert({
                key: 'leaderboard_settings',
                value: {
                    top_students: topStudents,
                    top_squads: topSquads,
                    refresh_interval: refreshInterval
                },
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        Swal.fire('تم الحفظ!', 'تم تحديث إعدادات قائمة الأوائل بنجاح.', 'success');
    } catch (err) {
        console.error("Save failed:", err);
        Swal.fire('خطأ', 'حدثت مشكلة أثناء الحفظ: ' + err.message, 'error');
    }
};

// --- SQUAD SETTINGS LOGIC ---
async function loadSquadSettings() {
    try {
        const { data, error } = await supabase
            .from('app_configs')
            .select('value')
            .eq('key', 'squad_settings')
            .maybeSingle();

        if (error) throw error;
        if (data && data.value) {
            document.getElementById('settingSquadJoinMins').value = data.value.join_mins || 60;
            document.getElementById('settingSquadGraceMins').value = data.value.grace_mins || 45;
            document.getElementById('settingSquadMaxMembers').value = data.value.max_members || 10;
            document.getElementById('settingSquadThreshold').value = data.value.success_threshold || 80;
        }
    } catch (err) {
        console.error("Error loading squad settings:", err);
    }
}

window.saveSquadSettings = async () => {
    const joinMins = parseInt(document.getElementById('settingSquadJoinMins').value);
    const graceMins = parseInt(document.getElementById('settingSquadGraceMins').value);
    const maxMembers = parseInt(document.getElementById('settingSquadMaxMembers').value);
    const threshold = parseInt(document.getElementById('settingSquadThreshold').value);

    if (isNaN(joinMins) || isNaN(graceMins) || isNaN(maxMembers) || isNaN(threshold)) {
        return Swal.fire('خطأ', 'يرجى إدخال أرقام صحيحة', 'error');
    }

    Swal.fire({ title: 'جاري الحفظ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { error } = await supabase
            .from('app_configs')
            .upsert({
                key: 'squad_settings',
                value: {
                    join_mins: joinMins,
                    grace_mins: graceMins,
                    max_members: maxMembers,
                    success_threshold: threshold
                },
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        Swal.fire('تم الحفظ!', 'تم تحديث إعدادات التحديات بنجاح.', 'success');
    } catch (err) {
        console.error("Save failed:", err);
        Swal.fire('خطأ', 'حدثت مشكلة أثناء الحفظ: ' + err.message, 'error');
    }
};
