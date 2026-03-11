import { supabase } from "../supabaseClient.js";
import { showSuccessAlert, showErrorAlert } from "../utils/alerts.js";

document.addEventListener('DOMContentLoaded', () => {
    const navReferences = document.getElementById('navReferences');
    if (navReferences) {
        navReferences.addEventListener('click', initReferencesView);
    }
});

let currentSelectedLessonId = null;

async function initReferencesView() {
    const subjectSelect = document.getElementById('refSubjectSelect');
    if (!subjectSelect || subjectSelect.options.length > 1) return; // Already initialized

    try {
        // Fetch Subjects
        const { data: subjects, error } = await supabase
            .from('subjects')
            .select('id, name_ar')
            .eq('is_active', true)
            .order('order_index');

        if (error) throw error;

        subjects.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.id;
            opt.textContent = sub.name_ar;
            subjectSelect.appendChild(opt);
        });

        // Subject Change Handler
        subjectSelect.addEventListener('change', loadLessonsForRef);

        // Save Handler
        document.getElementById('saveRefBtn').onclick = saveReferenceContent;

    } catch (err) {
        console.error('Error initializing references view:', err);
    }
}

async function loadLessonsForRef() {
    const subjectId = document.getElementById('refSubjectSelect').value;
    const listContainer = document.getElementById('refLessonsList');

    if (!subjectId) {
        listContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 1rem;">اختر مادة لعرض محاضراتها</p>';
        return;
    }

    listContainer.innerHTML = '<div style="text-align:center; padding:1rem;"><div class="spinner-sm"></div></div>';

    try {
        // Fetch chapters then lessons
        const { data: chapters } = await supabase.from('chapters').select('id, title').eq('subject_id', subjectId).order('order_index');

        if (!chapters || chapters.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 1rem;">لا توجد شباتر لهذه المادة</p>';
            return;
        }

        const chapterIds = chapters.map(c => c.id);
        const { data: lessons, error } = await supabase
            .from('lessons')
            .select('id, title, chapter_id')
            .in('chapter_id', chapterIds)
            .order('order_index');

        if (error) throw error;

        if (!lessons || lessons.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 1rem;">لا توجد محاضرات في هذه الشباتر</p>';
            return;
        }

        // Render Lessons Grouped by Chapter
        listContainer.innerHTML = chapters.map(ch => {
            const chLessons = lessons.filter(l => l.chapter_id === ch.id);
            if (chLessons.length === 0) return '';

            return `
                <div style="margin-bottom: 1rem;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: #94a3b8; padding: 0 0.5rem 0.25rem; text-transform: uppercase;">${ch.title}</div>
                    ${chLessons.map(l => `
                        <div class="ref-lesson-item" onclick="selectLessonForRef('${l.id}', '${l.title.replace(/'/g, "\\'")}')" 
                             style="padding: 0.75rem; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; margin-bottom: 2px;"
                             id="ref-lesson-${l.id}">
                            ${l.title}
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading lessons for ref:', err);
        listContainer.innerHTML = '<p style="color:red; padding:1rem;">خطأ في تحميل المحاضرات</p>';
    }
}

window.selectLessonForRef = async (id, title) => {
    // UI Highlights
    document.querySelectorAll('.ref-lesson-item').forEach(el => {
        el.style.background = 'transparent';
        el.style.color = 'inherit';
    });
    const selectedEl = document.getElementById(`ref-lesson-${id}`);
    if (selectedEl) {
        selectedEl.style.background = 'var(--primary-color)';
        selectedEl.style.color = 'white';
    }

    currentSelectedLessonId = id;

    // Show Editor
    document.getElementById('editorEmptyState').style.display = 'none';
    document.getElementById('refEditorArea').style.display = 'flex';
    document.getElementById('currentLessonTitle').textContent = title;
    document.getElementById('refContentText').value = '';
    document.getElementById('lastSavedAt').textContent = 'جاري التحميل...';

    try {
        const { data, error } = await supabase
            .from('lesson_references')
            .select('content, updated_at')
            .eq('lesson_id', id)
            .single();

        if (data) {
            document.getElementById('refContentText').value = data.content;
            document.getElementById('lastSavedAt').textContent = `آخر حفظ: ${new Date(data.updated_at).toLocaleString('ar-EG')}`;
        } else {
            document.getElementById('lastSavedAt').textContent = 'لا يوجد نص محفوظ لهذه المحاضرة حالياً';
        }
    } catch (err) {
        console.warn('No existing reference or error:', err);
        document.getElementById('lastSavedAt').textContent = 'جاهز للإضافة';
    }
};

async function saveReferenceContent() {
    if (!currentSelectedLessonId) return;

    const content = document.getElementById('refContentText').value.trim();
    if (!content) {
        return showErrorAlert('يرجى إدخال محتوى الكتاب أولاً');
    }

    const saveBtn = document.getElementById('saveRefBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
        // Upsert logic (insert on conflict update)
        const { error } = await supabase
            .from('lesson_references')
            .upsert({
                lesson_id: currentSelectedLessonId,
                content: content,
                updated_at: new Date().toISOString()
            }, { onConflict: 'lesson_id' });

        if (error) throw error;

        showSuccessAlert('تم حفظ نص المرجع بنجاح!');
        document.getElementById('lastSavedAt').textContent = `آخر حفظ: الآن`;

    } catch (err) {
        console.error('Save error:', err);
        showErrorAlert('حدث خطأ أثناء الحفظ: ' + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}
