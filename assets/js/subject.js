import { supabase } from "./supabaseClient.js";
import { getCache, setCache } from "./utils.js";
import { APP_CONFIG } from "./constants.js";
import { checkAuth } from "./auth.js";
import { initSubscriptionService, subscriptionService, showSubscriptionPopup } from "./subscription.js";

// Utility to get Query Params
const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('id');
const mode = urlParams.get('mode');
const squadIdInUrl = urlParams.get('squad_id');

let allExamGroups = [];
let resultsOffset = 0;
const resultsLimit = 3;
let allSolvedExams = []; // Shared solved exams state
let currentUserProfile = null;

async function loadSubjectContent() {
    if (!subjectId) {
        window.location.href = "dashboard.html";
        return;
    }

    // 1. Initial Auth Check
    const auth = await checkAuth();
    if (!auth) return;

    currentUserProfile = auth.profile;

    // Initialize subscription service
    await initSubscriptionService(auth.profile);

    const titleEl = document.getElementById("subjectTitle");
    const gridEl = document.getElementById("examsGrid");
    const loadingEl = document.getElementById("loading");

    try {
        // Cache key for this subject's data
        const cacheKey = `subject_${subjectId}_data`;
        const cachedData = getCache(cacheKey);

        let subject, chapters, allLessons, exams;

        if (cachedData) {
            // Use cached data
            ({ subject, chapters, allLessons, exams } = cachedData);
            if (subject) titleEl.textContent = subject.name_ar;
        } else {
            // Fetch fresh data
            // Fetch subject info
            const { data: subjectData, error: subjectError } = await supabase
                .from('subjects')
                .select('name_ar')
                .eq('id', subjectId)
                .single();

            if (subjectError) throw subjectError;
            subject = subjectData;
            if (subject) titleEl.textContent = subject.name_ar;

            // Fetch chapters
            const { data: chaptersData, error: chaptersError } = await supabase
                .from('chapters')
                .select('*')
                .eq('subject_id', subjectId)
                .order('created_at');

            if (chaptersError) throw chaptersError;
            chapters = chaptersData;

            // Fetch all lessons directly (independent of subscription for rendering)
            const { data: lessonsData } = await supabase
                .from('lessons')
                .select('*')
                .in('chapter_id', chapters.map(c => c.id))
                .order('order_index');
            allLessons = lessonsData || [];

            // Fetch all exams for this subject
            const { data: examsData, error: examsError } = await supabase
                .from('exams')
                .select('*')
                .or(`subject_id.eq.${subjectId},lesson_id.in.(${allLessons.map(l => l.id).join(',') || 'null'})`)
                .order('order_index');

            if (examsError) console.error('Exams error:', examsError);
            exams = examsData;

            // Cache the data for 5 minutes
            setCache(cacheKey, { subject, chapters, allLessons, exams }, 5);
        }

        // Always fetch fresh solved exams (user-specific, changes frequently)
        const { data: results } = await supabase
            .from('results')
            .select('exam_id')
            .eq('user_id', auth.user.id);

        allSolvedExams = results ? [...new Set(results.map(r => r.exam_id))] : [];

        // Render content
        renderContent(chapters || [], allLessons, exams || [], gridEl, mode, squadIdInUrl, allSolvedExams);

        // NEW: Load Mistakes Bank
        loadMistakesBank();

        // NEW: Handle Premium Banner
        const banner = document.getElementById('premiumBanner');
        const bannerBtn = document.getElementById('premiumBannerBtn');
        const closeBanner = document.getElementById('closePremiumBanner');

        if (banner) {
            const isPremium = subscriptionService.isPremium();
            const curriculumEnabled = subscriptionService.freemiumConfig?.curriculum_enabled === true;

            if (!isPremium && !curriculumEnabled) {
                banner.style.display = 'flex';
                if (bannerBtn) {
                    bannerBtn.onclick = () => window.location.href = 'pending.html';
                }
                if (closeBanner) {
                    closeBanner.onclick = () => banner.style.display = 'none';
                }
            } else {
                banner.style.display = 'none';
            }
        }

        // Hide loading (with null check)
        if (loadingEl) {
            loadingEl.style.display = "none";
        }

    } catch (err) {
        console.error('Error loading subject:', err);
        if (loadingEl) {
            loadingEl.innerHTML = '<p style="color: red;">حدث خطأ في تحميل المحتوى</p>';
        }
    }
}

function renderContent(chapters, lessons, exams, container, mode, squadId, solvedExams = []) {
    container.innerHTML = "";
    container.className = "";

    // Style adjustments for Accordion
    const accordionStyle = document.createElement('style');
    accordionStyle.innerHTML = `
        .chapter-card {
            background: white;
            border-radius: var(--radius-md);
            margin-bottom: 1.5rem;
            box-shadow: var(--shadow-sm);
            overflow: hidden;
            border: 1px solid #E5E7EB;
            direction: rtl;
            text-align: right;
        }
        .chapter-header {
            padding: 1.5rem;
            background: var(--bg-white);
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid transparent;
            transition: all 0.3s ease;
            direction: rtl;
        }
        .chapter-header:hover {
            background: #F9FAFB;
        }
        .chapter-header.active {
            background: var(--primary-color);
            color: white;
            border-bottom-color: rgba(255,255,255,0.1);
        }
        .chapter-header h2 {
            font-size: 1.4rem;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-direction: row;
        }
        .chapter-body {
            display: none;
            padding: 1.5rem;
            background: white;
            animation: fadeIn 0.3s ease;
            direction: rtl;
            text-align: right;
        }
        .chapter-body.show {
            display: block;
        }
        .lesson-item {
            padding: 1rem;
            border-bottom: 1px solid #eee;
            margin-bottom: 0.5rem;
        }
        .lesson-item:last-child {
            border-bottom: none;
        }
        .lesson-title {
            font-weight: bold;
            font-size: 1.1rem;
            color: var(--text-dark);
            margin-bottom: 0.8rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .lesson-title.locked {
            color: #9ca3af;
        }
        .exam-buttons {
            display: flex;
            gap: 0.8rem;
            flex-wrap: wrap;
            align-items: center;
        }
        .exam-btn-sm {
            padding: 0.4rem 1rem;
            font-size: 0.85rem;
            background: white;
            border: 1px solid var(--primary-color);
            color: var(--primary-color);
            border-radius: 20px;
            text-decoration: none;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }
        .exam-btn-sm:hover {
            background: var(--primary-color);
            color: white;
        }
        .exam-btn-sm.locked {
            background: #f3f4f6;
            border-color: #d1d5db;
            color: #9ca3af;
            cursor: not-allowed;
        }
        .lecture-btn-sm {
            padding: 0.4rem 1.2rem;
            font-size: 0.85rem;
            background: var(--primary-color);
            color: white;
            border-radius: 20px;
            text-decoration: none;
            transition: all 0.2s;
            display: inline-flex;
            display: none;
            align-items: center;
            gap: 5px;
            font-weight: 700;
            cursor: pointer;
        }
        .lecture-btn-sm:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(30, 179, 245, 0.3);
        }
        .lecture-btn-sm.locked {
            background: #e5e7eb;
            color: #9ca3af;
            cursor: not-allowed;
            pointer-events: none;
            box-shadow: none;
            transform: none;
        }
        .chapter-exam-section {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 2px dashed #eee;
        }
    `;
    document.head.appendChild(accordionStyle);

    if (!chapters || chapters.length === 0) {
        const noMsgEl = document.getElementById("noExamsMessage");
        if (noMsgEl) noMsgEl.style.display = "block";
        container.innerHTML = "";
        return;
    }

    const noMsgEl = document.getElementById("noExamsMessage");
    if (noMsgEl) noMsgEl.style.display = "none";

    // SECURITY: Use can_access flag from RPC (server-side check)
    // DO NOT use client-side isPremium() for access control!
    // Initialize subscription service is already handled in DOMContentLoaded
    // but we use the global instance here.

    chapters.forEach((chapter, index) => {
        const chapterLessons = lessons.filter(l => l.chapter_id === chapter.id);
        const chapterExams = exams.filter(e => e.chapter_id === chapter.id);

        const div = document.createElement("div");
        div.className = "chapter-card";

        // Generate HTML for Lessons
        let lessonsHtml = "";
        if (chapterLessons.length > 0) {
            chapterLessons.forEach(lesson => {
                const lessonExams = exams.filter(e => e.lesson_id === lesson.id);

                // SECURITY: Check each item independently using centralized service
                const canAccessLesson = subscriptionService.canAccessLessonContent(lesson);
                const canAccessExam = (exam) => subscriptionService.canAccessExam(exam);

                let examsHtml = "";

                if (lessonExams.length > 0) {
                    lessonExams.forEach((exam, idx) => {
                        const isSquadMode = mode === 'squad';
                        const isSolved = solvedExams.includes(exam.id);
                        const iconClass = isSquadMode ? 'fa-users' : (isSolved ? 'fa-check-circle' : 'fa-pen');
                        const iconColor = (!isSquadMode && isSolved) ? '#10b981' : 'inherit';
                        const examTitle = exam.title || `نموذج أسئلة ${idx + 1}`;

                        const canExamOpen = canAccessExam(exam);

                        if (!canExamOpen) {
                            // Locked exam
                            examsHtml += `
                                <a href="javascript:void(0)" onclick="window.showLockedExamPopup()" class="exam-btn-sm locked">
                                    <i class="fas fa-lock"></i> ${examTitle}
                                </a>`;
                        } else if (isSquadMode) {
                            examsHtml += `
                                <a href="javascript:void(0)" onclick="selectSquadExam('${exam.id}', '${examTitle}', '${squadId}')" class="exam-btn-sm">
                                    <i class="fas ${iconClass}"></i> ${examTitle}
                                </a>`;
                        } else {
                            examsHtml += `
                                <a href="exam.html?id=${exam.id}" class="exam-btn-sm" style="${isSolved ? 'border-color:#10b981; color:#10b981;' : ''}">
                                    <i class="fas ${iconClass}" style="color: ${iconColor}"></i> ${examTitle}
                                </a>`;
                        }
                    });
                } else {
                    examsHtml = `<span style="font-size:0.8rem; color:#999;">مفيش أسئلة دلوقتي</span>`;
                }

                // Check if lesson actually has content (HTML or Video)
                const hasContent = (lesson.content && lesson.content.trim() !== "") ||
                    (lesson.video_url && lesson.video_url.trim() !== "");

                lessonsHtml += `
                    <div class="lesson-item">
                        <div class="lesson-title ${!canAccessLesson ? 'locked' : ''}">
                            <i class="fas ${canAccessLesson ? 'fa-book-open' : 'fa-lock'}" style="color: ${canAccessLesson ? 'var(--secondary-color)' : '#9ca3af'};"></i>
                            ${lesson.title}
                            ${!canAccessLesson ? '<span style="font-size: 0.75rem; color: #9ca3af; margin-right: 0.5rem;">(للمشتركين)</span>' : ''}
                        </div>
                        <div class="exam-buttons">
                            ${canAccessLesson ?
                        (hasContent ?
                            `<a href="lecture.html?id=${lesson.id}" class="lecture-btn-sm">
                                عرض المحاضرة
                            </a>` :
                            `<a href="javascript:void(0)" class="lecture-btn-sm" style="background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0; cursor:default;">
                                قريباً 
                            </a>`) :
                        `<a href="javascript:void(0)" onclick="window.showLockedLessonPopup()" class="lecture-btn-sm locked">
                                    <i class="fas fa-lock"></i> عرض المحاضرة
                                </a>`
                    }
                            ${examsHtml}
                        </div>
                    </div>
                `;
            });
        } else {
            lessonsHtml = `<p style="text-align: center; color: #999;">جاري إضافة الدروس...</p>`;
        }

        // Generate HTML for Chapter-Level Exams
        let chapterExamsHtml = "";
        if (chapterExams.length > 0) {
            chapterExamsHtml = `<div class="chapter-exam-section">
                <h4 style="margin-bottom: 1rem; color: var(--primary-dark);">
                    <i class="fas fa-award"></i> امتحانات شاملة على الباب
                </h4>
                <div class="exam-buttons">`;

            chapterExams.forEach(exam => {
                const isSquadMode = mode === 'squad';
                const isSolved = solvedExams.includes(exam.id);
                const iconClass = isSquadMode ? 'fa-users' : (isSolved ? 'fa-check-circle' : 'fa-star');
                const iconColor = (!isSquadMode && isSolved) ? '#10b981' : 'inherit';
                const examTitle = exam.title;

                const canExamOpen = canAccessExam(exam);

                if (isSquadMode) {
                    chapterExamsHtml += `
                        <a href="javascript:void(0)" onclick="selectSquadExam('${exam.id}', '${examTitle}', '${squadId}')" class="exam-btn-sm" style="background: var(--bg-light); border-color: var(--text-light); color: var(--text-dark);">
                            <i class="fas ${iconClass}"></i> ${examTitle}
                        </a>`;
                } else if (!canExamOpen) {
                    chapterExamsHtml += `
                        <a href="javascript:void(0)" onclick="window.showLockedExamPopup()" class="exam-btn-sm locked">
                            <i class="fas fa-lock"></i> ${examTitle}
                        </a>`;
                } else {
                    chapterExamsHtml += `
                        <a href="exam.html?id=${exam.id}" class="exam-btn-sm" style="background: var(--bg-light); border-color: ${isSolved ? '#10b981' : 'var(--text-light)'}; color: ${isSolved ? '#10b981' : 'var(--text-dark)'};">
                            <i class="fas ${iconClass}" style="color: ${iconColor}"></i> ${examTitle}
                        </a>`;
                }
            });

            chapterExamsHtml += `</div></div>`;
        }

        div.innerHTML = `
            <div class="chapter-header" onclick="this.classList.toggle('active'); this.nextElementSibling.classList.toggle('show');">
                <h2>
                    <span style="background: var(--primary-color); color: white; width: 35px; height: 35px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">
                        ${index + 1}
                    </span>
                    ${chapter.title}
                </h2>
                <i class="fas fa-chevron-down"></i>
            </div>
            <div class="chapter-body">
                ${lessonsHtml}
                ${chapterExamsHtml}
            </div>
        `;

        container.appendChild(div);
    });
}

// Global popup functions
window.showLockedLessonPopup = function () {
    showSubscriptionPopup();
};

window.showLockedExamPopup = function () {
    showSubscriptionPopup();
};

// Squad Exam Selection System
window.selectSquadExam = async (examId, examTitle, squadId) => {
    try {
        const { isConfirmed } = await Swal.fire({
            title: 'عاوز تبدأ الامتحان ده مع صحابك؟',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'آيوة، يلا بينا!',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#10b981'
        });

        if (!isConfirmed) return;

        Swal.fire({
            title: 'جاري البدء...',
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const { data: { user } } = await supabase.auth.getUser();

        const { data: completedChallenges } = await supabase
            .from('squad_exam_challenges')
            .select('id')
            .eq('squad_id', squadId)
            .eq('exam_id', examId)
            .eq('status', 'completed')
            .limit(1);

        if (completedChallenges && completedChallenges.length > 0) {
            const { isConfirmed: proceedAnyway } = await Swal.fire({
                title: 'تنبيه !',
                text: 'انتو حليتو الامتحان ده مع بعض قبل كده النقط مش هتتحسب تاني.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'عارف ابدأ',
                cancelButtonText: 'لا خلاص',
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b'
            });

            if (!proceedAnyway) return;
        }

        let joinWindowMins = 60;
        try {
            const { data: config } = await supabase.from('app_configs').select('value').eq('key', 'squad_settings').maybeSingle();
            if (config?.value?.join_mins) joinWindowMins = config.value.join_mins;
        } catch (e) {
            console.error("Config fetch fail:", e);
        }

        const expiresAt = new Date(Date.now() + (joinWindowMins * 60 * 1000)).toISOString();
        const { data: challenge, error: challError } = await supabase
            .from('squad_exam_challenges')
            .insert({
                squad_id: squadId,
                exam_id: examId,
                created_by: user.id,
                expires_at: expiresAt,
                status: 'active'
            })
            .select()
            .single();

        if (challError) throw challError;

        await Swal.fire({
            icon: 'success',
            title: 'الامتحان بدأ! 🚀',
            text: 'روح خش الامتحان انت و صحابك من صفحة الشلة.',
            timer: 2000,
            showConfirmButton: false
        });

        window.location.href = 'squad.html';

    } catch (err) {
        console.error(err);
        Swal.fire('خطأ', 'مقدرناش نبدأ الامتحان.. جرب تاني', 'error');
    }
};

// --- Mistakes Bank Logic ---
async function loadMistakesBank() {
    const card = document.getElementById('mistakesBankCard');
    const premiumInner = document.getElementById('mistakesPremiumCard');
    const countText = document.getElementById('mistakesCountText');
    const viewBtn = document.getElementById('viewMistakesBtn');
    const practiceBtn = document.getElementById('practiceMistakesBtn');

    if (!card || !currentUserProfile) return;

    try {
        const { count, error } = await supabase
            .from('user_mistakes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUserProfile.id)
            .eq('subject_id', subjectId);

        if (error) throw error;

        // Always show the card now (but handle styles based on count)
        card.style.display = 'block';

        if (count > 0) {
            // Error State (Red)
            premiumInner.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
            premiumInner.style.boxShadow = '0 10px 25px rgba(239, 68, 68, 0.2)';
            countText.textContent = `عندك ${count} ${count > 10 ? 'غلطة' : (count > 2 ? 'أخطاء' : 'غلطات')}`;

            const canAccess = subscriptionService.canAccessFeature('mistakes_bank');

            // View (Review) Button
            if (viewBtn) {
                viewBtn.style.display = 'flex';
                if (canAccess) {
                    viewBtn.innerHTML = '<i class="fas fa-eye"></i> مراجعة';
                    viewBtn.style.opacity = '1';
                    viewBtn.style.cursor = 'pointer';
                    viewBtn.onclick = () => showMistakesList();
                } else {
                    viewBtn.innerHTML = '<i class="fas fa-lock"></i> Review (للمشتركين)';
                    viewBtn.style.opacity = '0.7';
                    viewBtn.style.cursor = 'not-allowed';
                    viewBtn.onclick = (e) => {
                        e.preventDefault();
                        subscriptionService.showUpgradePrompt('feature');
                    };
                }
            }

            // Practice Button
            if (practiceBtn) {
                practiceBtn.style.display = 'flex';
                if (canAccess) {
                    practiceBtn.innerHTML = '<i class="fas fa-bolt"></i> تدريب';
                    practiceBtn.style.opacity = '1';
                    practiceBtn.style.cursor = 'pointer';
                    practiceBtn.onclick = () => {
                        window.location.href = `exam.html?mode=mistakes&subject_id=${subjectId}`;
                    };
                } else {
                    practiceBtn.innerHTML = '<i class="fas fa-lock"></i> Practice (للمشتركين)';
                    practiceBtn.style.opacity = '0.7';
                    practiceBtn.style.cursor = 'not-allowed';
                    practiceBtn.onclick = (e) => {
                        e.preventDefault();
                        subscriptionService.showUpgradePrompt('feature');
                    };
                }
            }
        } else {
            // Celebration State (Green)
            premiumInner.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
            premiumInner.style.boxShadow = '0 10px 25px rgba(16, 185, 129, 0.2)';
            countText.textContent = "معندكش ولا غلطة.. عاش! 🔥";

            if (viewBtn) viewBtn.style.display = 'none';
            if (practiceBtn) practiceBtn.style.display = 'none';
        }
    } catch (err) {
        console.error("Mistakes bank load error:", err);
    }
}

// Custom Modal Controls - Attached to window for globality (module scope fix)
window.openMistakesModal = function () {
    const overlay = document.getElementById('mistakesModalOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

window.closeMistakesModal = function () {
    const overlay = document.getElementById('mistakesModalOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Bind events to IDs
document.getElementById('closeMistakesModalBtn')?.addEventListener('click', window.closeMistakesModal);
document.getElementById('mistakesModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'mistakesModalOverlay') window.closeMistakesModal();
});

async function showMistakesList() {
    const content = document.getElementById('mistakesModalContent');
    if (!content) return;
    content.className = 'rtl-content';
    content.innerHTML = '<div style="text-align:center; padding:3rem; color:#6b7280;"><i class="fas fa-spinner fa-spin" style="font-size:2rem; margin-bottom:1rem;"></i><br>جاري تحميل أخطائك...</div>';
    window.openMistakesModal();

    try {
        const { data, error } = await supabase
            .from('user_mistakes')
            .select(`
                questions(*, 
                    exams(
                        lessons(
                            title, 
                            order_index, 
                            chapters(title, order_index)
                        )
                    )
                )
            `)
            .eq('user_id', currentUserProfile.id)
            .eq('subject_id', subjectId)
            .order('last_failed_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            content.innerHTML = '<div style="text-align:center; padding:3rem; color:#6b7280;"><i class="fas fa-check-circle" style="font-size:3rem; color:#10b981; margin-bottom:1rem;"></i><br>عاش يا وحش! معندكش ولا غلطة لسه.</div>';
            return;
        }

        // Group by Chapter then Lesson
        // Structure: chapters[chapterTitle] = { orderIndex, lessons: { lessonTitle: { orderIndex, questions: [] } } }
        const hierarchy = {};
        data.forEach((m) => {
            const q = m.questions;
            if (!q) return;
            const lesson = q.exams?.lessons;
            const chapter = lesson?.chapters;

            const chapterTitle = chapter?.title || 'عام';
            const chapterOrder = chapter?.order_index ?? 999;
            const lessonTitle = lesson?.title || 'دروس عامة';
            const lessonOrder = lesson?.order_index ?? 999;

            if (!hierarchy[chapterTitle]) {
                hierarchy[chapterTitle] = {
                    orderIndex: chapterOrder,
                    lessons: {}
                };
            }

            if (!hierarchy[chapterTitle].lessons[lessonTitle]) {
                hierarchy[chapterTitle].lessons[lessonTitle] = {
                    orderIndex: lessonOrder,
                    questions: []
                };
            }
            hierarchy[chapterTitle].lessons[lessonTitle].questions.push(q);
        });

        // Sort chapters by order_index
        const sortedChapters = Object.entries(hierarchy).sort((a, b) => a[1].orderIndex - b[1].orderIndex);

        const choiceKeys = ['a', 'b', 'c', 'd'];
        let htmlContent = '';
        let totalProcessed = 0;

        sortedChapters.forEach(([chapterTitle, chapterObj]) => {
            // Add Chapter Header - Centered with reduced margins
            htmlContent += `
                <div style="margin: 1.5rem auto 1rem; padding: 0.5rem 1.25rem; background: #f3f4f6; border-radius: 12px; display: block; width: fit-content; text-align: center;">
                    <span style="font-weight: 900; font-size: 0.75rem; color: #4b5563; text-transform: uppercase; letter-spacing: 0.1em;">${chapterTitle}</span>
                </div>
            `;

            // Sort lessons within chapter
            const sortedLessons = Object.entries(chapterObj.lessons).sort((a, b) => a[1].orderIndex - b[1].orderIndex);

            sortedLessons.forEach(([lessonTitle, lessonObj]) => {
                htmlContent += `
                    <div style="margin: 1.5rem 0 1rem; border-right: 4px solid #ef4444; padding-right: 0.75rem; text-align: right;">
                        <span style="font-weight: 800; font-size: 0.95rem; color: #111827; text-transform: uppercase; letter-spacing: 0.05em;">${lessonTitle}</span>
                    </div>
                `;

                lessonObj.questions.forEach((q) => {
                    totalProcessed++;
                    const optionsHtml = choiceKeys
                        .filter(k => q[`choice_${k}`])
                        .map(k => {
                            const isCorrect = k === q.correct_answer;
                            return `
                                <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; border-radius: 12px; margin-bottom: 0.5rem; background: ${isCorrect ? '#f0fdf4' : '#f9fafb'}; border: 1px solid ${isCorrect ? '#bbf7d0' : '#f3f4f6'}; transition: all 0.2s; text-align: right; direction: rtl;">
                                    <div style="width: 24px; height: 24px; border-radius: 6px; background: ${isCorrect ? '#10b981' : '#fff'}; color: ${isCorrect ? '#fff' : '#6b7280'}; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; border: 1.5px solid ${isCorrect ? '#10b981' : '#d1d5db'}; flex-shrink: 0; padding-top: 1px;">
                                        ${k.toUpperCase()}
                                    </div>
                                    <div style="flex: 1; font-size: 0.88rem; font-weight: 600; color: ${isCorrect ? '#065f46' : '#374151'}; line-height: 1.5; text-align: right;">${q[`choice_${k}`]}</div>
                                    ${isCorrect ? '<i class="fas fa-check-circle" style="color: #10b981; font-size: 1rem; margin-top: 2px;"></i>' : ''}
                                </div>
                            `;
                        }).join('');

                    htmlContent += `
                        <div style="background: #fff; border-radius: 20px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #f3f4f6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); text-align: right; direction: rtl;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; text-align: right;">
                                <span style="font-size: 0.7rem; font-weight: 800; color: #ef4444; background: #fef2f2; padding: 0.25rem 0.75rem; border-radius: 8px; letter-spacing: 0.05em;">سؤال ${totalProcessed}</span>
                            </div>
                            <div style="font-size: 1rem; font-weight: 700; color: #111827; line-height: 1.6; margin-bottom: 1.25rem; text-align: right;">${q.question_text}</div>
                            ${q.question_image ? `<img src="${q.question_image}" style="width: 100%; border-radius: 16px; margin-bottom: 1.25rem; border: 1px solid #f3f4f6;">` : ''}
                            <div style="text-align: right;">${optionsHtml}</div>
                        </div>
                    `;
                });
            });
        });

        content.innerHTML = htmlContent;

    } catch (err) {
        console.error('Modal error:', err);
        content.innerHTML = '<div style="text-align:center; padding:3rem; color:#ef4444;"><i class="fas fa-exclamation-triangle" style="font-size:3rem; margin-bottom:1rem;"></i><br>Failed to load mistakes. Please try again.</div>';
    }
}

// Load Subject-Specific Results
async function loadSubjectResults() {
    const container = document.getElementById('subjectResultsContainer');
    const section = document.getElementById('subjectResultsSection');
    const btn = document.getElementById('loadMoreResultsBtn');
    if (!container || !section) return;

    resultsOffset = 0;
    allExamGroups = [];
    container.innerHTML = '<p style="text-align:center; color:#999;">جاري تحميل نتائجك...</p>';

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: results, error } = await supabase
            .from('results')
            .select(`
                *,
                exams!inner (
                    id,
                    title,
                    subject_id,
                    chapters:chapter_id (title),
                    lessons:lesson_id (
                        title,
                        chapters:chapter_id (title)
                    )
                )
            `)
            .eq('user_id', user.id)
            .eq('exams.subject_id', subjectId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!results || results.length === 0) {
            section.style.display = 'none';
            return;
        }

        // Group by exam_id
        const examGroupsMap = {};
        results.forEach(result => {
            if (!examGroupsMap[result.exam_id]) {
                examGroupsMap[result.exam_id] = [];
            }
            examGroupsMap[result.exam_id].push(result);
        });

        const groups = Object.values(examGroupsMap);
        groups.sort((a, b) => new Date(b[0].created_at) - new Date(a[0].created_at));

        allExamGroups = groups;
        section.style.display = 'block';
        container.innerHTML = '';
        renderSubjectResults(false);

    } catch (err) {
        console.error("Error loading subject results:", err);
    }
}

function renderSubjectResults(append = false) {
    const container = document.getElementById('subjectResultsContainer');
    const btn = document.getElementById('loadMoreResultsBtn');
    if (!container) return;

    if (append && btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
    }

    const batch = allExamGroups.slice(resultsOffset, resultsOffset + resultsLimit);

    batch.forEach(attempts => {
        const currentAttempt = attempts[0];
        const previousAttempt = attempts[1] || null;

        const examData = currentAttempt.exams || {};
        const examTitle = examData.title || 'امتحان';
        const chapterTitle = examData.chapters?.title || examData.lessons?.chapters?.title || "بدون باب";
        const lessonTitle = examData.lessons?.title || "";

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = 'margin-bottom: 1.5rem; padding: 1.5rem; border-right: 4px solid var(--primary-color); animation: fadeIn 0.3s ease;';

        if (!previousAttempt) {
            card.innerHTML = `
                <div style="font-size: 0.95rem; font-weight: bold; color: var(--primary-color); margin-bottom: 0.2rem;">
                    <i class="fas fa-folder-open"></i> ${chapterTitle}
                </div>
                <h4 style="font-size: 0.85rem; margin: 0 0 1rem 0; color: var(--text-light); font-weight: normal; line-height: 1.4;">
                    ${lessonTitle ? lessonTitle + ' - ' : ''}${examTitle}
                </h4>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <span style="font-size: 2rem; font-weight: 900; color: var(--primary-color);">
                            ${currentAttempt.percentage}%
                        </span>
                        <span style="display: block; font-size: 0.9rem; color: var(--text-light); margin-top: 0.3rem;">
                            الدرجة: ${currentAttempt.score} من ${currentAttempt.total_questions} صح
                        </span>
                    </div>
                    <div style="text-align: left;">
                        <span style="font-size: 0.85rem; color: var(--text-light);">
                            <i class="far fa-calendar-alt"></i> ${new Date(currentAttempt.created_at).toLocaleDateString('ar-EG')}
                        </span>
                    </div>
                </div>
            `;
        } else {
            const diff = currentAttempt.percentage - previousAttempt.percentage;
            const icon = diff > 0 ? '📈' : diff < 0 ? '📉' : '➖';
            const color = diff > 0 ? '#10B981' : diff < 0 ? '#EF4444' : '#94A3B8';
            const sign = diff > 0 ? '+' : '';

            card.innerHTML = `
                <div style="font-size: 0.95rem; font-weight: bold; color: var(--primary-color); margin-bottom: 0.2rem;">
                    <i class="fas fa-folder-open"></i> ${chapterTitle}
                </div>
                <h4 style="font-size: 0.85rem; margin: 0 0 1rem 0; color: var(--text-light); font-weight: normal; line-height: 1.4;">
                    ${lessonTitle ? lessonTitle + ' - ' : ''}${examTitle}
                </h4>
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem; align-items: center;">
                    <div style="text-align: center; padding: 0.75rem; background: var(--bg-light); border-radius: var(--radius-sm);">
                        <div style="font-size: 0.7rem; color: var(--text-light); margin-bottom: 0.3rem;">السابقة</div>
                        <div style="font-size: 1.4rem; font-weight: 900; color: var(--text-dark);">${previousAttempt.percentage}%</div>
                        <div style="font-size: 0.65rem; color: var(--text-light); margin-top: 0.2rem;">🕒 ${new Date(previousAttempt.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <div style="text-align: center; font-size: 1.5rem; line-height: 1;">
                        ${icon}
                        <div style="font-size: 0.8rem; font-weight: bold; color: ${color}; margin-top: 0.2rem;">
                            ${sign}${diff}%
                        </div>
                    </div>
                    <div style="text-align: center; padding: 0.75rem; background: #f0fdf4; border-radius: var(--radius-sm); border: 2px solid var(--primary-color);">
                        <div style="font-size: 0.7rem; color: var(--text-light); margin-bottom: 0.3rem;">الأخيرة</div>
                        <div style="font-size: 1.4rem; font-weight: 900; color: var(--primary-color);">${currentAttempt.percentage}%</div>
                        <div style="font-size: 0.65rem; color: var(--text-light); margin-top: 0.2rem;">🆕 ${new Date(currentAttempt.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</div>
                    </div>
                </div>
            `;
        }

        container.appendChild(card);
    });

    resultsOffset += batch.length;

    if (btn) {
        if (resultsOffset < allExamGroups.length) {
            btn.style.display = 'inline-block';
            btn.disabled = false;
            btn.innerHTML = 'عرض المزيد <i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i>';
        } else {
            btn.style.display = 'none';
        }
    }
}


document.addEventListener("DOMContentLoaded", () => {

    loadSubjectContent();
    loadSubjectResults();

    const loadMoreBtn = document.getElementById('loadMoreResultsBtn');
    if (loadMoreBtn) {
        loadMoreBtn.onclick = () => renderSubjectResults(true);
    }

    // Initialize premium banner
    initPremiumBanner();
});

/**
 * Initialize premium banner for non-premium users
 */
function initPremiumBanner() {
    if (!currentUserProfile || currentUserProfile.is_active === true) return;

    const banner = document.getElementById('premiumBanner');
    if (!banner) return;

    // Check session dismissal
    if (sessionStorage.getItem('premium_banner_dismissed')) return;

    // Show banner
    banner.style.display = 'flex';

    // Subscribe button
    const subscribeBtn = document.getElementById('premiumBannerBtn');
    if (subscribeBtn) {
        subscribeBtn.onclick = () => window.location.href = 'pending.html';
    }

    // Close button
    const closeBtn = document.getElementById('closePremiumBanner');
    if (closeBtn) {
        closeBtn.onclick = () => {
            banner.style.display = 'none';
            sessionStorage.setItem('premium_banner_dismissed', 'true');
        };
    }
}
