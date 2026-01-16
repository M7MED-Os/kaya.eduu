import { supabase } from "./supabaseClient.js";

// Utility to get Query Params
const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('id');

async function loadSubjectContent() {
    const titleEl = document.getElementById("subjectTitle");
    const gridEl = document.getElementById("examsGrid");
    const loadingEl = document.getElementById("loading");
    const noMsgEl = document.getElementById("noExamsMessage");

    if (!subjectId) {
        window.location.href = "dashboard.html";
        return;
    }

    try {
        // 0. Fetch Subject Details (Name, etc.)
        const { data: subject, error: subError } = await supabase
            .from('subjects')
            .select('name_ar')
            .eq('id', subjectId)
            .single();

        if (subError) {
            console.error("Subject fetch error:", subError);
            titleEl.textContent = "مادة غير معروفة";
        } else {
            titleEl.textContent = subject.name_ar;
        }

        // 1. Fetch Chapters for this subject
        const { data: chapters, error: chError } = await supabase
            .from('chapters')
            .select('*')
            .eq('subject_id', subjectId)
            .order('order_index', { ascending: true });

        if (chError) throw chError;

        if (!chapters || chapters.length === 0) {
            loadingEl.style.display = "none";
            noMsgEl.style.display = "block";
            return;
        }

        // 2. Fetch Lessons & Exams for all chapters (Efficiently)
        const chapterIds = chapters.map(c => c.id);

        const { data: lessons, error: lError } = await supabase
            .from('lessons')
            .select('*')
            .in('chapter_id', chapterIds)
            .order('order_index', { ascending: true });

        // Fix: Use subject_id for exams query optimization if possible, or just chapter/lesson IDs
        // Actually, let's fetch exams linked to these chapters OR lessons.
        const { data: exams, error: eError } = await supabase
            .from('exams')
            .select('*')
            .or(`chapter_id.in.(${chapterIds.join(',')}),lesson_id.in.(${lessons.length ? lessons.map(l => l.id).join(',') : 'uuid_nil()'})`)
            .order('created_at', { ascending: true });

        if (lError || eError) throw new Error("Partial Load Error");

        loadingEl.style.display = "none";
        renderContent(chapters, lessons, exams, gridEl);

    } catch (err) {
        console.error("Error loading content:", err);
        loadingEl.innerHTML = `<p style="color: red;">حدث خطأ: ${err.message}</p>`;
    }
}

function renderContent(chapters, lessons, exams, container) {
    container.innerHTML = "";
    container.className = ""; // Remove grid class for accordion layout

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
        }
        .chapter-body {
            display: none;
            padding: 1.5rem;
            background: white;
            animation: fadeIn 0.3s ease;
        }
        .chapter-body.show {
            display: block;
        }
        /* Lesson Item */
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
        .exam-buttons {
            display: flex;
            gap: 0.8rem;
            flex-wrap: wrap;
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
        .chapter-exam-section {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 2px dashed #eee;
        }
    `;
    document.head.appendChild(accordionStyle);

    chapters.forEach(chapter => {
        const chapterLessons = lessons.filter(l => l.chapter_id === chapter.id);
        const chapterExams = exams.filter(e => e.chapter_id === chapter.id); // Exams directly on chapter

        const div = document.createElement("div");
        div.className = "chapter-card";

        // Generate HTML for Lessons
        let lessonsHtml = "";
        if (chapterLessons.length > 0) {
            chapterLessons.forEach(lesson => {
                // Find exams for this specific lesson
                const lessonExams = exams.filter(e => e.lesson_id === lesson.id);
                let examsHtml = "";

                if (lessonExams.length > 0) {
                    lessonExams.forEach((exam, idx) => {
                        examsHtml += `
                            <a href="exam.html?id=${exam.id}" class="exam-btn-sm">
                                <i class="fas fa-pen"></i> نموذج أسئلة ${idx + 1}
                            </a>`;
                    });
                } else {
                    examsHtml = `<span style="font-size:0.8rem; color:#999;">لا توجد نماذج حالياً</span>`;
                }

                lessonsHtml += `
                    <div class="lesson-item">
                        <div class="lesson-title">
                            <i class="fas fa-book-open" style="color: var(--secondary-color);"></i>
                            ${lesson.title}
                        </div>
                        <div class="exam-buttons">
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
                chapterExamsHtml += `
                    <a href="exam.html?id=${exam.id}" class="exam-btn-sm" style="background: var(--bg-light); border-color: var(--text-light); color: var(--text-dark);">
                        <i class="fas fa-star"></i> ${exam.title}
                    </a>`;
            });

            chapterExamsHtml += `</div></div>`;
        }

        div.innerHTML = `
            <div class="chapter-header" onclick="this.classList.toggle('active'); this.nextElementSibling.classList.toggle('show');">
                <h2>
                    <span style="background: var(--primary-color); color: white; width: 35px; height: 35px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">
                        ${chapter.order_index || '#'}
                    </span>
                    ${chapter.title}
                </h2>
                <i class="fas fa-chevron-down"></i>
            </div>
            <div class="chapter-body ${chapter.id ? '' : 'show'}"> <!-- Show first one by default if needed, logic can be added -->
                ${lessonsHtml}
                ${chapterExamsHtml}
            </div>
        `;

        container.appendChild(div);
    });
}

// Load Subject-Specific Results
async function loadSubjectResults() {
    try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) return;

        // Fetch results for this subject only
        const { data: results, error } = await supabase
            .from('results')
            .select(`
                *,
                exams!inner (
                    id,
                    title,
                    subject_id
                )
            `)
            .eq('user_id', user.id)
            .eq('exams.subject_id', subjectId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!results || results.length === 0) {
            // No results for this subject yet
            return;
        }

        // Show results section
        const resultsSection = document.getElementById('subjectResultsSection');
        if (resultsSection) resultsSection.style.display = 'block';

        // Group by exam_id
        const examGroups = {};
        results.forEach(result => {
            if (!examGroups[result.exam_id]) {
                examGroups[result.exam_id] = [];
            }
            examGroups[result.exam_id].push(result);
        });

        // Render results
        renderSubjectResults(examGroups);

    } catch (err) {
        console.error("Error loading subject results:", err);
    }
}

function renderSubjectResults(examGroups) {
    const container = document.getElementById('subjectResultsContainer');
    if (!container) return;

    container.innerHTML = '';

    Object.values(examGroups).forEach(attempts => {
        // Sort by date
        attempts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const firstAttempt = attempts[0];
        const lastAttempt = attempts[attempts.length - 1];
        const examTitle = firstAttempt.exams?.title || 'امتحان';

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = 'margin-bottom: 1.5rem; padding: 1.5rem;';

        if (attempts.length === 1) {
            // Single attempt
            card.innerHTML = `
                <h3 style="font-size: 1.2rem; margin-bottom: 1rem; color: var(--text-dark);">
                    ${examTitle}
                </h3>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <span style="font-size: 2rem; font-weight: 900; color: var(--primary-color);">
                            ${firstAttempt.percentage}%
                        </span>
                        <span style="display: block; font-size: 0.9rem; color: var(--text-light); margin-top: 0.3rem;">
                            ${firstAttempt.score} من ${firstAttempt.total_questions} صح
                        </span>
                    </div>
                    <div style="text-align: left;">
                        <span style="font-size: 0.85rem; color: var(--text-light);">
                            ${new Date(firstAttempt.created_at).toLocaleDateString('ar-EG')}
                        </span>
                    </div>
                </div>
            `;
        } else {
            // Multiple attempts - show comparison
            const improvement = lastAttempt.percentage - firstAttempt.percentage;
            const improvementIcon = improvement > 0 ? '📈' : improvement < 0 ? '📉' : '➡️';
            const improvementColor = improvement > 0 ? '#10B981' : improvement < 0 ? '#EF4444' : '#6B7280';

            card.innerHTML = `
                <h3 style="font-size: 1.2rem; margin-bottom: 1rem; color: var(--text-dark);">
                    ${examTitle}
                    <span style="font-size: 0.9rem; color: var(--text-light);"> (${attempts.length} محاولات)</span>
                </h3>
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center;">
                    <!-- First Attempt -->
                    <div style="text-align: center; padding: 1rem; background: var(--bg-light); border-radius: var(--radius-sm);">
                        <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.5rem;">أول محاولة</div>
                        <div style="font-size: 1.8rem; font-weight: 900; color: var(--text-dark);">${firstAttempt.percentage}%</div>
                        <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.3rem;">
                            ${new Date(firstAttempt.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                        </div>
                    </div>

                    <!-- Improvement Arrow -->
                    <div style="text-align: center; font-size: 2rem;">
                        ${improvementIcon}
                        <div style="font-size: 0.9rem; font-weight: bold; color: ${improvementColor}; margin-top: 0.3rem;">
                            ${improvement > 0 ? '+' : ''}${improvement}%
                        </div>
                    </div>

                    <!-- Last Attempt -->
                    <div style="text-align: center; padding: 1rem; background: linear-gradient(135deg, rgba(0, 137, 123, 0.1), rgba(255, 152, 0, 0.1)); border-radius: var(--radius-sm); border: 2px solid var(--primary-color);">
                        <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.5rem;">آخر محاولة</div>
                        <div style="font-size: 1.8rem; font-weight: 900; color: var(--primary-color);">${lastAttempt.percentage}%</div>
                        <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.3rem;">
                            ${new Date(lastAttempt.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                        </div>
                    </div>
                </div>
            `;
        }

        container.appendChild(card);
    });
}


document.addEventListener("DOMContentLoaded", () => {
    loadSubjectContent();
    loadSubjectResults();
});
