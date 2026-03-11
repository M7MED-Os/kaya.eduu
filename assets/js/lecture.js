import { supabase } from "./supabaseClient.js";
import { checkAuth } from "./auth.js";
import { APP_CONFIG } from "./constants.js";
import { getCache, setCache } from "./utils.js";
import { subscriptionService, initSubscriptionService, showSubscriptionPopup } from "./subscription.js";

document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    const { user, profile } = await checkAuth();
    if (!user) return;

    // Initialize subscription service
    await initSubscriptionService(profile);

    // Store profile globally for access checks
    window.currentUserProfile = profile;

    // Update Navigation UI
    if (profile) {
        // Admin Buttons
        if (profile.role === 'admin') {
            const adminNavBtn = document.getElementById('adminNavBtn');
            if (adminNavBtn) adminNavBtn.style.display = 'block';
        }
    }

    // Get Lesson ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('id');

    if (!lessonId) {
        window.location.href = 'dashboard.html';
        return;
    }

    await loadLecture(lessonId);
});

async function loadLecture(lessonId) {
    const lectureContent = document.getElementById('lectureContent');
    const lectureTitle = document.getElementById('lectureTitle');
    const courseName = document.getElementById('courseName');
    const examLink = document.getElementById('examLink');
    const videoContainer = document.getElementById('videoContainer');
    const lectureVideo = document.getElementById('lectureVideo');
    const loadingEl = document.getElementById('loading');

    try {
        // ✅ STEP 1: Validate access using RPC function
        const accessCheck = await subscriptionService.validateLessonAccess(lessonId);

        if (accessCheck.error) {
            console.error('Access check error:', accessCheck.error);
            if (loadingEl) loadingEl.innerHTML = '<p style="color: red;">حدث خطأ في التحقق من الوصول</p>';
            return;
        }

        if (!accessCheck.canAccess) {
            // User doesn't have access - show popup
            if (loadingEl) loadingEl.innerHTML = '';
            await showSubscriptionPopup();
            return;
        }

        const lesson = accessCheck.lesson;

        // ✅ STEP 2: Update UI with lesson data
        lectureTitle.textContent = lesson.title;
        courseName.textContent = lesson.subject_name || 'المادة';

        // ✅ STEP 3: Display content (already filtered by RPC)
        if (lesson.content) {
            lectureContent.innerHTML = lesson.content;
            // Post-process content for enhanced UI
            wrapTables(lectureContent);
            wrapBilingualCards(lectureContent);
            generateTOC(lectureContent);
            initFocusMode();
        } else {
            lectureContent.innerHTML = '<p style="text-align: center; color: #64748b;">لا يوجد محتوى متاح</p>';
        }

        // ✅ STEP 4: Display video (already filtered by RPC)
        if (lesson.video_url) {
            const videoId = extractYouTubeID(lesson.video_url);
            if (videoId) {
                lectureVideo.src = `https://www.youtube.com/embed/${videoId}`;
                videoContainer.style.display = 'block';
            }
        } else {
            videoContainer.style.display = 'none';
        }

        // ✅ STEP 5: Handle exam link
        // Fetch exams for this lesson
        const { data: exams, error: examsError } = await supabase
            .from('exams')
            .select('id, title')
            .eq('lesson_id', lessonId);

        if (!examsError && exams && exams.length > 0) {
            const firstExam = exams[0];

            // Check if user can access exam
            const examAccessCheck = await subscriptionService.validateExamAccess(firstExam.id);

            if (examAccessCheck.canAccess) {
                // User can access exam
                examLink.href = `exam.html?id=${firstExam.id}`;
                examLink.style.display = 'inline-flex';
                examLink.style.alignItems = 'center';
                examLink.style.gap = '8px';
                examLink.style.opacity = '1';
                examLink.innerHTML = '<i class="fas fa-clipboard-check"></i> ابدأ الامتحان';
                examLink.onclick = null;
            } else {
                // User cannot access exam - show locked state
                examLink.href = '#';
                examLink.style.display = 'inline-flex';
                examLink.style.alignItems = 'center';
                examLink.style.gap = '8px';
                examLink.style.opacity = '0.6';
                examLink.style.cursor = 'not-allowed';
                examLink.innerHTML = '<i class="fas fa-lock"></i> الامتحان (للمشتركين)';
                examLink.onclick = (e) => {
                    e.preventDefault();
                    showUpgradePrompt('exam');
                };
            }
        } else {
            examLink.style.display = 'none';
        }

    } catch (err) {
        console.error('Error loading lecture:', err);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'حدث خطأ أثناء تحميل المحاضرة',
            confirmButtonText: 'حسناً'
        }).then(() => {
            window.location.href = 'dashboard.html';
        });
    }
}

/**
 * Wrap adjacent .en and .ar paragraphs into a single .translation-card
 */
function wrapBilingualCards(container) {
    const children = Array.from(container.children);
    let i = 0;
    while (i < children.length) {
        const current = children[i];
        const next = children[i + 1];

        if (current.classList.contains('en') && next && next.classList.contains('ar')) {
            const card = document.createElement('div');
            card.className = 'translation-card';
            container.insertBefore(card, current);
            card.appendChild(current);
            card.appendChild(next);
            i += 2;
        } else {
            i++;
        }
    }
}

/**
 * Automatically wrap tables in .table-wrapper for horizontal scroll
 */
function wrapTables(container) {
    const tables = container.querySelectorAll('table');
    tables.forEach(table => {
        // Only wrap if not already wrapped
        if (!table.parentElement.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

/**
 * Generate Dynamic Table of Contents
 */
function generateTOC(container) {
    const headers = container.querySelectorAll('h2, h3');
    const tocContainer = document.getElementById('tocContainer');
    const tocList = document.getElementById('tocList');
    const tocOverlay = document.getElementById('tocOverlay');
    const tocToggleBtn = document.getElementById('tocToggleBtn');

    if (headers.length < 2) {
        if (tocContainer) tocContainer.style.display = 'none';
        if (tocToggleBtn) tocToggleBtn.style.display = 'none';
        return;
    }

    if (tocContainer) tocContainer.style.display = 'block';
    if (tocList) tocList.innerHTML = '';

    headers.forEach((header, index) => {
        if (!header.id) header.id = `section-${index}`;
        const item = document.createElement('div');
        item.className = 'toc-item';
        const link = document.createElement('a');
        link.href = `#${header.id}`;
        link.className = `toc-link ${header.tagName.toLowerCase()}-link`;
        link.textContent = header.innerText.split('\n')[0].trim();
        link.onclick = (e) => {
            e.preventDefault();
            closeTOC();
            const offset = 120;
            const elementPosition = header.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        };
        item.appendChild(link);
        tocList.appendChild(item);
    });

    const openTOC = () => {
        if (!tocContainer || !tocOverlay) return;
        tocContainer.classList.add('open');
        tocOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeTOC = () => {
        if (!tocContainer || !tocOverlay) return;
        tocContainer.classList.remove('open');
        tocOverlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (tocToggleBtn) tocToggleBtn.onclick = openTOC;
    if (tocOverlay) tocOverlay.onclick = closeTOC;

    window.addEventListener('scroll', () => {
        let current = '';
        const scrollPos = window.pageYOffset + 150;
        headers.forEach(header => {
            if (scrollPos > header.offsetTop) current = header.id;
        });
        document.querySelectorAll('.toc-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) link.classList.add('active');
        });
    });
}

/**
 * Initialize Focus Mode
 */
function initFocusMode() {
    const btn = document.getElementById('focusModeBtn');
    if (!btn) return;

    btn.onclick = () => {
        const isActive = document.body.classList.toggle('focus-mode');
        btn.classList.toggle('active');
        btn.querySelector('span').textContent = isActive ? 'Unfocus' : 'Focus';
        btn.querySelector('i').className = isActive ? 'fas fa-compress' : 'fas fa-expand';
    };
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeID(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
