import { supabase, showView, openModal, closeModal, showSuccessAlert, showErrorAlert, showDeleteConfirmDialog } from "./admin-core.js";

/**
 * Show Polls Management View
 */
export async function showPollsView() {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('navPolls')?.classList.add('active');

    document.getElementById('pageTitle').textContent = 'الرئيسية > إدارة الاستفتاءات';
    showView('pollsView');
    await loadPolls();
    await loadPollSettings();
}

/**
 * Load polls into table
 */
export async function loadPolls() {
    const tableBody = document.getElementById('pollsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem;"><div class="spinner"></div></td></tr>';

    const { data: polls, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">خطأ في التحميل: ${error.message}</td></tr>`;
        return;
    }

    if (!polls || polls.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem;">لا يوجد استفتاءات حالياً</td></tr>';
        return;
    }

    tableBody.innerHTML = polls.map(p => {
        const typeLabel = p.type === 'choice' ? 'اختيارات' : 'تقييم نجوم';
        const targetLabel = `${p.target_year === 'all' ? 'كل السنين' : 'فرقة ' + p.target_year} / ${p.target_department === 'all' ? 'كل الأقسام' : p.target_department}`;

        const displayDate = p.publish_date ? new Date(p.publish_date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-';
        const endDateLabel = p.end_date ? new Date(p.end_date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'بدون انتهاء';

        const now = new Date();
        const isScheduled = p.publish_date && new Date(p.publish_date) > now;
        const isExpired = p.end_date && new Date(p.end_date) < now;

        let statusBadge = '';
        if (isExpired) {
            statusBadge = '<span class="badge badge-gray" style="background:#f1f5f9; color:#64748b;">منتهي</span>';
        } else if (isScheduled) {
            statusBadge = '<span class="badge badge-warning">مجدول</span>';
        } else if (p.is_active) {
            statusBadge = '<span class="badge badge-success">نشط</span>';
        } else {
            statusBadge = '<span class="badge badge-gray">متوقف</span>';
        }

        return `
            <tr>
                <td data-label="السؤال" style="font-weight:600;">${p.question}</td>
                <td data-label="النوع">${typeLabel}</td>
                <td data-label="المستهدف">${targetLabel}</td>
                <td data-label="تاريخ النشر">${displayDate}</td>
                <td data-label="تاريخ الانتهاء">${endDateLabel}</td>
                <td data-label="الحالة">${statusBadge}</td>
                <td data-label="النتايج">
                    <div style="display:flex; gap:5px;">
                        <button class="btn btn-primary btn-sm" onclick="viewPollResults('${p.id}')" title="عرض الإحصائيات">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="viewPollParticipants('${p.id}')" title="عرض المشاركين">
                            <i class="fas fa-users"></i>
                        </button>
                    </div>
                </td>
                <td data-label="إجراءات">
                    <div style="display:flex; gap:8px; justify-content: flex-end;">
                        <button class="btn btn-sm btn-outline" onclick="editPoll('${p.id}')" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm ${p.is_active ? 'btn-outline' : 'btn-success'}" 
                                onclick="togglePollStatus('${p.id}', ${p.is_active})" title="${p.is_active ? 'إيقاف' : 'تفعيل'}">
                            <i class="fas ${p.is_active ? 'fa-pause' : 'fa-play'}"></i>
                        </button>
                        <button class="btn btn-sm" style="background:#fef2f2; color:#ef4444; border:1px solid #fee2e2;" 
                                onclick="deletePoll('${p.id}')" title="حذف">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Open modal to create or edit a poll
 */
export async function openCreatePollModal(editData = null) {
    const isEdit = !!editData;

    // Formatting date for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    };

    openModal({
        title: isEdit ? 'تعديل الاستفتاء' : 'إضافة استفتاء جديد',
        body: `
            <div class="form-group">
                <label>السؤال</label>
                <input id="pollQuestion" class="form-control" placeholder="مثال: إيه رأيك في مستوى المحاضرات؟" value="${isEdit ? editData.question : ''}">
            </div>
            <div class="form-group" ${isEdit ? 'style="display:none;"' : ''}>
                <label>نوع الاستفتاء</label>
                <select id="pollType" class="form-control" onchange="togglePollOptions()">
                    <option value="choice" ${isEdit && editData.type === 'choice' ? 'selected' : ''}>اختيارات متعددة</option>
                    <option value="rating" ${isEdit && editData.type === 'rating' ? 'selected' : ''}>تقييم بالنجوم</option>
                </select>
            </div>
            <div id="choiceOptionsGroup" class="form-group" style="${isEdit && editData.type === 'rating' ? 'display:none;' : ''}">
                <label>الاختيارات (اختيار في كل سطر)</label>
                <textarea id="pollOptions" class="form-control" rows="4" placeholder="خيار 1\nخيار 2\nخيار 3">${isEdit ? (editData.options || []).join('\n') : ''}</textarea>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-top:1rem;">
                <div class="form-group">
                    <label>السنة المستهدفة</label>
                    <select id="pollTargetYear" class="form-control">
                        <option value="all" ${isEdit && editData.target_year === 'all' ? 'selected' : ''}>كل السنين</option>
                        <option value="1" ${isEdit && editData.target_year === '1' ? 'selected' : ''}>سنة أولى ثانوي</option>
                        <option value="2" ${isEdit && editData.target_year === '2' ? 'selected' : ''}>سنة تانية ثانوي</option>
                        <option value="3" ${isEdit && editData.target_year === '3' ? 'selected' : ''}>سنة تالتة ثانوي</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>القسم المستهدف</label>
                    <select id="pollTargetDept" class="form-control">
                        <option value="all" ${isEdit && editData.target_department === 'all' ? 'selected' : ''}>كل الشعب</option>
                        <option value="general" ${isEdit && editData.target_department === 'general' ? 'selected' : ''}>عام</option>
                        <option value="science_science" ${isEdit && editData.target_department === 'science_science' ? 'selected' : ''}>علمي علوم</option>
                        <option value="science_math" ${isEdit && editData.target_department === 'science_math' ? 'selected' : ''}>علمي رياضة</option>
                        <option value="literary" ${isEdit && editData.target_department === 'literary' ? 'selected' : ''}>أدبي</option>
                    </select>
                </div>
            </div>
            <div class="form-group" style="margin-top: 1rem; background: #f8fafc; padding: 1rem; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <label style="margin: 0; font-weight: 800; color: #1e293b;">إلزامي (لازم يجاوب عليه) ⚠️</label>
                <label class="switch">
                    <input type="checkbox" id="pollIsRequired" ${!isEdit || editData.is_required !== false ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
                <div class="form-group">
                    <label>تاريخ النشر (الجدولة)</label>
                    <input type="datetime-local" id="pollPublishDate" class="form-control" value="${isEdit ? formatDate(editData.publish_date) : ''}">
                    <small style="color:#64748b;">اتركه فارغاً للنشر فوراً</small>
                </div>
                <div class="form-group">
                    <label>تاريخ الانتهاء</label>
                    <input type="datetime-local" id="pollEndDate" class="form-control" value="${isEdit ? formatDate(editData.end_date) : ''}">
                    <small style="color:#64748b;">اتركه فارغاً ليستمر للأبد</small>
                </div>
            </div>
        `,
        onSave: async () => {
            const question = document.getElementById('pollQuestion').value.trim();
            const type = document.getElementById('pollType').value;
            const optionsRaw = document.getElementById('pollOptions').value.trim();
            const year = document.getElementById('pollTargetYear').value;
            const dept = document.getElementById('pollTargetDept').value;
            const publishDate = document.getElementById('pollPublishDate').value || null;
            const endDate = document.getElementById('pollEndDate').value || null;

            if (!question) return showErrorAlert('يرجى كتابة السؤال');

            let options = [];
            if (type === 'choice') {
                options = optionsRaw.split('\n').map(o => o.trim()).filter(o => o);
                if (options.length < 2) return showErrorAlert('يرجى إضافة خيارين على الأقل');
            }

            const payload = {
                question,
                type,
                options,
                target_year: year,
                target_department: dept,
                publish_date: publishDate ? new Date(publishDate).toISOString() : new Date().toISOString(),
                end_date: endDate ? new Date(endDate).toISOString() : null,
                is_required: document.getElementById('pollIsRequired').checked
            };

            const dbCall = isEdit
                ? supabase.from('polls').update(payload).eq('id', editData.id)
                : supabase.from('polls').insert(payload);

            const { error } = await dbCall;

            if (error) {
                showErrorAlert(error.message);
            } else {
                showSuccessAlert(isEdit ? 'تم تحديث الاستفتاء' : 'تم إضافة الاستفتاء بنجاح');
                closeModal();
                loadPolls();
            }
        }
    });

    window.togglePollOptions = () => {
        const typeSelect = document.getElementById('pollType');
        const group = document.getElementById('choiceOptionsGroup');
        if (typeSelect && group) group.style.display = typeSelect.value === 'choice' ? 'block' : 'none';
    };
}

/**
 * Handle Edit initiation
 */
export async function editPoll(id) {
    const { data: poll, error } = await supabase.from('polls').select('*').eq('id', id).single();
    if (error) return showErrorAlert('خطأ في تحميل بيانات الاستفتاء');
    openCreatePollModal(poll);
}

/**
 * Toggle poll is_active status
 */
export async function togglePollStatus(id, currentStatus) {
    const { error } = await supabase
        .from('polls')
        .update({ is_active: !currentStatus })
        .eq('id', id);

    if (error) {
        showErrorAlert(error.message);
    } else {
        loadPolls();
    }
}

/**
 * Delete poll
 */
export async function deletePoll(id) {
    const confirmed = await showDeleteConfirmDialog('هل أنت متأكد من حذف هذا الاستفتاء وكل النتايج المرتبطة به؟');
    if (confirmed) {
        const { error } = await supabase.from('polls').delete().eq('id', id);
        if (error) {
            showErrorAlert(error.message);
        } else {
            showSuccessAlert('تم الحذف بنجاح');
            loadPolls();
        }
    }
}

/**
 * View poll results
 */
export async function viewPollResults(pollId) {
    const { data: poll, error: pollError } = await supabase.from('polls').select('*').eq('id', pollId).single();
    const { data: responses, error: resError } = await supabase.from('poll_responses').select('*').eq('poll_id', pollId);

    if (pollError || resError) return showErrorAlert('خطأ في تحميل النتائج');

    let contentHtml = '';
    const totalVotes = responses.length;

    if (totalVotes === 0) {
        contentHtml = '<div style="text-align:center; padding:2rem;">لا يوجد تصويتات حتى الآن</div>';
    } else if (poll.type === 'choice') {
        const counts = {};
        poll.options.forEach(opt => counts[opt] = 0);
        responses.forEach(r => {
            const opt = poll.options[parseInt(r.response)];
            if (opt) counts[opt]++;
        });

        contentHtml = `
            <div style="margin-bottom: 1.5rem; text-align:center;">
                <span class="badge badge-info" style="font-size:1rem;">إجمالي الأصوات: ${totalVotes}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
                ${poll.options.map(opt => {
            const count = counts[opt] || 0;
            const percent = Math.round((count / totalVotes) * 100);
            return `
                        <div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span style="font-weight:600;">${opt}</span>
                                <span>${count} صوت (${percent}%)</span>
                            </div>
                            <div style="height:10px; background:#f1f5f9; border-radius:5px; overflow:hidden;">
                                <div style="width:${percent}%; height:100%; background:#03A9F4;"></div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    } else {
        const ratings = responses.map(r => parseInt(r.response));
        const sum = ratings.reduce((a, b) => a + b, 0);
        const avg = (sum / totalVotes).toFixed(1);

        contentHtml = `
            <div style="text-align:center; padding:1.5rem;">
                <div style="font-size: 3rem; font-weight: 800; color: #f59e0b;">${avg}</div>
                <div style="color:#64748b; margin-top:0.5rem;">متوسط التقييم من 5 نجوم</div>
                <div style="margin-top:1.5rem;">
                    <span class="badge badge-info">إجمالي المشاركين: ${totalVotes} طالب</span>
                </div>
            </div>
        `;
    }

    openModal({
        title: `نتائج: ${poll.question}`,
        body: contentHtml,
        onSave: () => closeModal()
    });

    const saveBtn = document.getElementById('modalSaveBtn');
    if (saveBtn) saveBtn.textContent = 'إغلاق';
}

/**
 * View individual poll participants and their responses
 */
export async function viewPollParticipants(pollId) {
    const { data: poll, error: pollError } = await supabase.from('polls').select('*').eq('id', pollId).single();
    if (pollError) return showErrorAlert('خطأ في تحميل بيانات الاستفتاء');

    const modalContainer = document.querySelector('#universalModal .modal-container');
    if (modalContainer) modalContainer.classList.add('modal-lg');

    // Show loading in modal
    openModal({
        title: `المشاركون: ${poll.question}`,
        body: '<div style="text-align:center; padding:3rem;"><div class="spinner"></div></div>',
        onSave: () => {
            if (modalContainer) modalContainer.classList.remove('modal-lg');
            closeModal();
        }
    });

    const { data: responses, error: resError } = await supabase
        .from('poll_responses')
        .select('*, profiles(full_name, email)')
        .eq('poll_id', pollId)
        .order('created_at', { ascending: false });

    if (resError) {
        document.getElementById('modalBody').innerHTML = '<div style="text-align:center; padding:3rem; color:#ef4444;">خطأ في تحميل المشاركين</div>';
        return;
    }

    if (responses.length === 0) {
        document.getElementById('modalBody').innerHTML = '<div style="text-align:center; padding:3rem; color:#64748b;">لا يوجد مشاركون حتى الآن في هذا الاستفتاء</div>';
        return;
    }

    // Modern Header with search
    const headerHtml = `
        <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; background: #f8fafc; padding: 1rem; border-radius: 12px; border: 1px solid #f1f5f9;">
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="badge badge-info" style="font-size:0.9rem; padding: 6px 12px;">إجمالي الاستجابات: ${responses.length}</span>
            </div>
            <div style="position:relative; flex: 1; max-width: 300px;">
                <i class="fas fa-search" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); color:#94a3b8;"></i>
                <input type="text" id="participantSearch" placeholder="بحث باسم الطالب أو الإيميل..." 
                    style="width:100%; padding: 10px 35px 10px 10px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.9rem; outline:none;"
                    onkeyup="filterParticipantsTable()">
            </div>
        </div>
    `;

    const tableHtml = `
        ${headerHtml}
        <div class="table-responsive-wrapper" style="border:none; border-radius: 12px; max-height: 50vh; overflow-y: auto;">
            <table class="responsive-table" id="participantsTable">
                <thead style="position: sticky; top: 0; z-index: 10; background: #f8fafc;">
                    <tr>
                        <th style="padding: 1.25rem 1rem;">الطالب</th>
                        <th style="padding: 1.25rem 1rem;">الإيميل</th>
                        <th style="padding: 1.25rem 1rem;">الرد / التقييم</th>
                        <th style="padding: 1.25rem 1rem; text-align: center;">التاريخ</th>
                    </tr>
                </thead>
                <tbody>
                    ${responses.map(r => {
        let responseLabel = '';
        let badgeClass = 'badge-info';

        if (poll.type === 'choice') {
            responseLabel = poll.options[parseInt(r.response)] || 'غير معروف';
        } else if (poll.type === 'rating') {
            const stars = parseInt(r.response);
            responseLabel = `${stars} <i class="fas fa-star" style="color:#f59e0b;"></i>`;
            badgeClass = stars >= 4 ? 'badge-success' : (stars <= 2 ? 'badge-danger' : 'badge-warning');
        } else {
            responseLabel = r.response;
        }

        const date = new Date(r.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });

        return `
                            <tr class="participant-row">
                                <td style="padding: 1rem; font-weight:700; color: #1e293b;">${r.profiles?.full_name || 'بدون اسم'}</td>
                                <td style="padding: 1rem; color:#64748b; font-size: 0.85rem;">${r.profiles?.email || '-'}</td>
                                <td style="padding: 1rem;">
                                    <span class="badge ${badgeClass}" style="font-size:0.85rem; min-width: 60px; justify-content: center;">
                                        ${responseLabel}
                                    </span>
                                </td>
                                <td style="padding: 1rem; font-size:0.8rem; color:#94a3b8; text-align: center;">${date}</td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('modalBody').innerHTML = tableHtml;

    const saveBtn = document.getElementById('modalSaveBtn');
    if (saveBtn) {
        saveBtn.textContent = 'إغلاق';
        saveBtn.classList.replace('btn-primary', 'btn-outline');
    }

    // Global filtering function for the modal
    window.filterParticipantsTable = () => {
        const query = document.getElementById('participantSearch').value.toLowerCase();
        const rows = document.querySelectorAll('.participant-row');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    };
}

/**
 * Load global poll flow settings from database
 */
export async function loadPollSettings() {
    try {
        const { data, error } = await supabase
            .from('app_configs')
            .select('value')
            .eq('key', 'poll_settings')
            .maybeSingle();

        if (error) throw error;

        const defaultSettings = {
            welcome: { enabled: false, text: 'أهلاً بكم في استفتاء أطياف' },
            thank_you: { enabled: false, text: 'شكراً لمشاركتك معنا' }
        };

        const settings = data?.value || defaultSettings;

        // Populate UI
        document.getElementById('pollWelcomeEnable').checked = settings.welcome?.enabled || false;
        document.getElementById('pollWelcomeText').value = settings.welcome?.text || '';

        document.getElementById('pollEndEnable').checked = settings.thank_you?.enabled || false;
        document.getElementById('pollEndText').value = settings.thank_you?.text || '';

    } catch (err) {
        console.error("Error loading poll settings:", err);
    }
}

/**
 * Save poll settings to database
 */
export async function savePollSettings() {
    const settings = {
        welcome: {
            enabled: document.getElementById('pollWelcomeEnable').checked,
            text: document.getElementById('pollWelcomeText').value.trim()
        },
        thank_you: {
            enabled: document.getElementById('pollEndEnable').checked,
            text: document.getElementById('pollEndText').value.trim()
        }
    };

    try {
        Swal.fire({ title: 'جاري الحفظ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const { error } = await supabase
            .from('app_configs')
            .upsert({
                key: 'poll_settings',
                value: settings,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        Swal.fire('تم الحفظ!', 'تم تحديث إعدادات تجربة الاستفتاء بنجاح.', 'success');
    } catch (err) {
        console.error("Save failed:", err);
        showErrorAlert('حدثت مشكلة أثناء الحفظ: ' + err.message);
    }
}

// Attach to window for global access
window.showPollsView = showPollsView;
window.loadPolls = loadPolls;
window.openCreatePollModal = openCreatePollModal;
window.editPoll = editPoll;
window.togglePollStatus = togglePollStatus;
window.deletePoll = deletePoll;
window.viewPollResults = viewPollResults;
window.viewPollParticipants = viewPollParticipants;
window.togglePollOptions = () => {
    const typeSelect = document.getElementById('pollType');
    const group = document.getElementById('choiceOptionsGroup');
    if (typeSelect && group) group.style.display = typeSelect.value === 'choice' ? 'block' : 'none';
};
window.savePollSettings = savePollSettings;
