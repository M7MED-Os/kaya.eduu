import { supabase } from "./supabaseClient.js";
import { clearCache } from "./utils.js";
import { APP_CONFIG } from "./constants.js";
import { showErrorAlert, showSuccessAlert, showConfirmDialog, showInfoAlert } from "./utils/alerts.js";
import { subscriptionService, initSubscriptionService, showSubscriptionPopup } from "./subscription.js";
import { checkAuth } from "./auth.js";

const urlParams = new URLSearchParams(window.location.search);
const examId = urlParams.get('id');

let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // { questionId: 'a' }
let examTitle = "";
let hierarchyInfo = { subject: "", chapter: "", lesson: "" };
let flaggedQuestions = new Set();
let timerInterval = null;
let timeElapsed = 0; // in seconds
let totalTime = 0; // calculated based on questions
let squadId = urlParams.get('squad_id');
let challengeId = urlParams.get('challenge_id');

// Mistakes Mode Params
const mode = urlParams.get('mode');
const isMistakesMode = mode === 'mistakes';
const subjectIdForMistakes = urlParams.get('subject_id');

const loadingEl = document.getElementById("loading");
const examView = document.getElementById("examView");
const resultView = document.getElementById("resultView");
const reviewView = document.getElementById("reviewView");
const questionsContainer = document.getElementById("questionsContainer");
const reviewContainer = document.getElementById("reviewContainer");
const examTitleMobile = document.getElementById("examTitleMobile");
const progressBar = document.getElementById("progressBar");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");
const timerDisplay = document.getElementById("timerDisplay");
const timerBox = document.getElementById("timerBox");
const reviewBtn = document.getElementById("reviewBtn");
const backToResultBtn = document.getElementById("backToResultBtn");
const examFooter = document.getElementById("examFooter");
const headerFinishBtn = document.getElementById("headerFinishBtn");
const desktopNavGrid = document.getElementById("desktopNavGrid");
const mobileNavGrid = document.getElementById("mobileNavGrid");

// Check Auth & ID
if (!examId && !isMistakesMode) {
    showErrorAlert('خطأ', 'امتحان غير موجود').then(() => {
        window.location.href = "dashboard.html";
    });
}

async function initExam() {
    try {
        // ✅ 1. Auth Check
        const { user, profile } = await checkAuth();
        if (!user || !profile) {
            showErrorAlert('خطأ', 'يجب تسجيل الدخول أولاً').then(() => window.location.href = 'login.html');
            return;
        }

        // 2. Init Subscription
        await initSubscriptionService(profile);
        window.currentUserProfile = profile;

        if (isMistakesMode) {
            // --- Mistakes Exam Mode ---
            if (!subscriptionService.canAccessFeature('mistakes_bank')) {
                loadingEl.innerHTML = '';
                await showSubscriptionPopup();
                window.location.href = `subject.html?id=${subjectIdForMistakes}`;
                return;
            }

            if (!subjectIdForMistakes) throw new Error('Missing subject ID');
            const { data: sData } = await supabase.from('subjects').select('name_ar').eq('id', subjectIdForMistakes).single();
            examTitle = `مراجعة أخطاء: ${sData?.name_ar || 'المادة'}`;
            hierarchyInfo = { subject: sData?.name_ar || '', chapter: 'بنك الأخطاء', lesson: 'مراجعة أخطاء' };

            const { data: mData, error: mError } = await supabase.from('user_mistakes').select('questions(*)').eq('user_id', user.id).eq('subject_id', subjectIdForMistakes);
            if (mError) throw mError;
            if (!mData || mData.length === 0) {
                showInfoAlert('مبروك!', 'معندكش أخطاء').then(() => window.location.href = `subject.html?id=${subjectIdForMistakes}`);
                return;
            }
            currentQuestions = mData.map(m => m.questions).filter(q => q !== null);
            currentQuestions = shuffleArray(currentQuestions);
        } else {
            // --- Standard Mode ---
            const accessCheck = await subscriptionService.validateExamAccess(examId);
            if (!accessCheck.canAccess) {
                loadingEl.innerHTML = '';
                await showSubscriptionPopup();
                return;
            }
            const exam = accessCheck.exam;
            examTitle = exam.title;

            // Hierarchy from RPC metadata
            hierarchyInfo.subject = exam.subject_name_ar || "";
            hierarchyInfo.chapter = exam.chapter_title || "";
            hierarchyInfo.lesson = exam.lesson_title || "";

            const qs = await subscriptionService.fetchExamQuestions(examId);
            if (!qs || qs.length === 0) {
                loadingEl.innerHTML = "<p>لا توجد أسئلة.</p>";
                return;
            }
            currentQuestions = shuffleArray(qs);

            // Restore
            const sa = localStorage.getItem(`exam_progress_${examId}`);
            if (sa) userAnswers = JSON.parse(sa);
            const st = localStorage.getItem(`exam_timer_${examId}`);
            if (st) timeElapsed = parseInt(st, 10) || 0;
        }

        // Common Finish
        if (loadingEl) loadingEl.style.display = "none";
        if (examView) examView.style.display = "block";
        if (examFooter) examFooter.style.display = "flex";

        // Set mobile header title
        if (examTitleMobile) examTitleMobile.textContent = examTitle;
        totalTime = currentQuestions.length * 60;
        renderQuestions();
        renderNavigator();
        startTimer();
        showQuestion(currentQuestionIndex);

    } catch (err) {
        console.error('Init error:', err);
        if (loadingEl) loadingEl.innerHTML = `<p style="color:red">خطأ: ${err.message}</p>`;
    }
}

// Fixed Utility
function shuffleArray(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

function renderQuestions() {
    questionsContainer.innerHTML = "";

    currentQuestions.forEach((q, index) => {
        const card = document.createElement("div");
        card.className = "question-card";
        card.dataset.index = index;
        card.id = `q-card-${index}`;

        card.innerHTML = `
            <div class="q-meta">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="q-tag">سؤال ${index + 1} من ${currentQuestions.length}</span>
                    <button class="flag-btn" onclick="toggleFlag(${index})" id="flag-btn-${index}">
                        <i class="far fa-bookmark"></i> <span>علامة</span>
                    </button>
                </div>
            </div>
            <div class="question-text">${q.question_text || ''}</div>
            ${q.question_image ? `<img src="${q.question_image}" class="question-img" alt="سؤال" onclick="openLightbox(this.src)">` : ''}
            <div class="options-list">
                ${['a', 'b', 'c', 'd'].filter(opt => q[`choice_${opt}`] || q[`choice_${opt}_image`]).map(opt => {
            const isChecked = userAnswers[q.id] === opt;
            return `
                    <label class="option-label ${isChecked ? 'checked' : ''}" id="label-${q.id}-${opt}">
                         <input type="radio" name="q_${q.id}" value="${opt}" class="option-radio" 
                                ${isChecked ? 'checked' : ''} 
                                onchange="handleAnswerChange('${q.id}', '${opt}', ${index})">
                         <div class="option-content">
                            <span class="option-text">${q[`choice_${opt}`] || ''}</span>
                            ${q[`choice_${opt}_image`] ? `<img src="${q[`choice_${opt}_image`]}" class="choice-img" alt="خيار" onclick="event.preventDefault(); openLightbox(this.src)">` : ''}
                         </div>
                    </label>
                `;
        }).join('')}
            </div>
        `;
        questionsContainer.appendChild(card);
    });
}

function renderNavigator() {
    const grids = [desktopNavGrid, mobileNavGrid];
    grids.forEach(grid => {
        if (!grid) return;
        grid.innerHTML = "";
        currentQuestions.forEach((_, index) => {
            const dot = document.createElement("div");
            dot.className = "nav-dot";
            dot.dataset.qindex = index;
            dot.textContent = index + 1;

            // Restore state if answered
            if (userAnswers[currentQuestions[index].id]) {
                dot.classList.add('answered');
            }

            dot.onclick = () => {
                showQuestion(index);
                if (window.toggleDrawer && grid === mobileNavGrid) window.toggleDrawer();
            };
            grid.appendChild(dot);
        });
    });
}

window.handleAnswerChange = (qId, answer, index) => {
    saveAnswer(qId, answer);

    // UI Update: Highlight option
    const options = document.querySelectorAll(`input[name="q_${qId}"]`);
    options.forEach(opt => {
        const label = document.getElementById(`label-${qId}-${opt.value}`);
        if (label) label.classList.toggle('checked', opt.checked);
    });

    // Update navigator across both grids using data attribute
    const dots = document.querySelectorAll(`.nav-dot[data-qindex="${index}"]`);
    dots.forEach(dot => dot.classList.add('answered'));

    // Show Save Feedback
    showSaveIndicator();
};

window.toggleFlag = (index) => {
    const btn = document.getElementById(`flag-btn-${index}`);
    const dots = document.querySelectorAll(`.nav-dot[data-qindex="${index}"]`);

    if (flaggedQuestions.has(index)) {
        flaggedQuestions.delete(index);
        btn.classList.remove('active');
        btn.innerHTML = '<i class="far fa-bookmark"></i> <span>علامة</span>';
        dots.forEach(dot => dot.classList.remove('flagged'));
    } else {
        flaggedQuestions.add(index);
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-bookmark"></i> <span>علامة</span>';
        dots.forEach(dot => dot.classList.add('flagged'));
    }
}

function showSaveIndicator() {
    const badge = document.getElementById('saveBadge');
    if (!badge) return;
    badge.classList.add('show');
    setTimeout(() => badge.classList.remove('show'), 1500);
}

window.saveAnswer = async (qId, answer) => {
    userAnswers[qId] = answer;
    localStorage.setItem(`exam_progress_${examId}`, JSON.stringify(userAnswers));
};

function showQuestion(index) {
    if (index < 0 || index >= currentQuestions.length) return;

    const allCards = document.querySelectorAll(".question-card");
    allCards.forEach(c => c.classList.remove("active"));

    const targetCard = document.getElementById(`q-card-${index}`);
    if (targetCard) targetCard.classList.add("active");

    currentQuestionIndex = index;

    const progress = ((index + 1) / currentQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;

    // Update Navigator Active State across both grids
    const allDots = document.querySelectorAll(".nav-dot");
    allDots.forEach(d => d.classList.remove("active"));
    const activeDots = document.querySelectorAll(`.nav-dot[data-qindex="${index}"]`);
    activeDots.forEach(d => d.classList.add("active"));

    // Nav Buttons
    prevBtn.style.opacity = index === 0 ? "0.3" : "1";
    prevBtn.style.pointerEvents = index === 0 ? "none" : "auto";

    if (index === currentQuestions.length - 1) {
        nextBtn.style.display = "none";
        submitBtn.style.display = "inline-block";
        submitBtn.innerHTML = `<i class="fas fa-paper-plane"></i> <span class="nav-btn-text">سلم الامتحان</span>`;
    } else {
        nextBtn.style.display = "inline-block";
        submitBtn.style.display = "none";
    }

    // Update question counter in footer
    const qCountEl = document.getElementById('qCount');
    if (qCountEl) qCountEl.textContent = `${index + 1} / ${currentQuestions.length}`;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Timer Functions
function startTimer() {
    timerInterval = setInterval(() => {
        timeElapsed++;
        updateTimerDisplay();

        // Persist time
        localStorage.setItem(`exam_timer_${examId}`, timeElapsed);

        // Warning when 2 minutes left
        if (totalTime - timeElapsed <= 120 && totalTime - timeElapsed > 0) {
            timerBox.classList.add('warning');
        }

        // Auto-submit when time is up
        if (timeElapsed >= totalTime) {
            clearInterval(timerInterval);
            calculateResult();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const remaining = Math.max(0, totalTime - timeElapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Navigation Events
prevBtn.addEventListener("click", () => showQuestion(currentQuestionIndex - 1));
nextBtn.addEventListener("click", () => showQuestion(currentQuestionIndex + 1));

// Submit Logic with Warning
function handleFinishExam() {
    const totalQ = currentQuestions.length;
    const answeredQ = Object.keys(userAnswers).length;
    const hasFlagged = flaggedQuestions.size > 0;

    if (answeredQ < totalQ || hasFlagged) {
        // Show Warning Modal
        const warningModal = document.getElementById('warningModal');
        const warningOverlay = document.getElementById('warningOverlay');
        const warningTitle = warningModal.querySelector('h3');
        const warningText = warningModal.querySelector('p');

        if (answeredQ < totalQ && hasFlagged) {
            warningTitle.textContent = 'في أسئلة محلتهاش ومعلم عليها!';
            warningText.textContent = `لسه في ${totalQ - answeredQ} سؤال محلتهمش و ${flaggedQuestions.size} سؤال معلم عليهم. عايز ترجع تكمل ولا تسلم الامتحان؟`;
        } else if (answeredQ < totalQ) {
            warningTitle.textContent = 'في أسئلة محلتهاش!';
            warningText.textContent = `لسه في ${totalQ - answeredQ} سؤال محلتهمش. عايز ترجع تكمل ولا تسلم الامتحان؟`;
        } else {
            warningTitle.textContent = 'في أسئلة معلم عليها!';
            warningText.textContent = `لسه في ${flaggedQuestions.size} سؤال معلم عليهم. عايز ترجع تكمل ولا تسلم الامتحان؟`;
        }

        warningModal.style.display = 'flex';
        warningOverlay.style.display = 'block';
    } else {
        calculateResult();
    }
}

submitBtn.addEventListener("click", handleFinishExam);
if (headerFinishBtn) {
    headerFinishBtn.addEventListener("click", handleFinishExam);
}

// Warning Modal Buttons
document.getElementById('continueExamBtn').addEventListener('click', () => {
    document.getElementById('warningModal').style.display = 'none';
    document.getElementById('warningOverlay').style.display = 'none';
});

document.getElementById('confirmSubmitAnywayBtn').addEventListener('click', () => {
    document.getElementById('warningModal').style.display = 'none';
    document.getElementById('warningOverlay').style.display = 'none';
    calculateResult();
});

async function calculateResult() {
    if (timerInterval) clearInterval(timerInterval);

    // UI Cleanup
    if (examFooter) examFooter.style.display = "none";
    if (headerFinishBtn) headerFinishBtn.style.display = "none";
    const progressWrapper = document.querySelector('.progress-wrapper');
    if (progressWrapper) progressWrapper.style.display = "none";
    const sidebar = document.querySelector('.nav-sidebar');
    const mobileToggles = document.querySelectorAll('.mobile-nav-toggle');
    if (sidebar) sidebar.style.display = "none";
    mobileToggles.forEach(t => t.style.display = "none");

    // Show Loading inside result view
    if (examView) examView.style.display = "none";
    if (resultView) resultView.style.display = "block";
    const scoreValEl = document.getElementById("scoreValue");
    if (scoreValEl) scoreValEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i>';

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        let resultData;
        if (isMistakesMode) {
            // 1. Submit via Mistakes Practice RPC
            const { data, error } = await supabase.rpc('submit_mistakes_practice', {
                p_subject_id: subjectIdForMistakes,
                p_answers: userAnswers,
                p_time_spent: timeElapsed
            });
            if (error) throw error;
            resultData = data;

            // Clean specific mistakes cache if any (optional)
        } else {
            // 2. Standard Exam submission logic
            if (challengeId) {
                const { data: chall } = await supabase.from('squad_exam_challenges').select('created_at, status').eq('id', challengeId).single();
                if (chall) {
                    let joinMins = 60, graceMins = 45;
                    const { data: config } = await supabase.from('app_configs').select('value').eq('key', 'squad_settings').maybeSingle();
                    if (config?.value) {
                        joinMins = config.value.join_mins || 60;
                        graceMins = config.value.grace_mins || 45;
                    }
                    const startTime = new Date(chall.created_at).getTime();
                    const totalWindow = (joinMins + graceMins) * 60 * 1000;
                    if (Date.now() > (startTime + totalWindow) && chall.status !== 'completed') {
                        challengeId = null;
                    }
                }
            }

            const { data, error } = await supabase.rpc('submit_exam_secure', {
                p_exam_id: examId,
                p_answers: userAnswers,
                p_time_spent: timeElapsed,
                p_challenge_id: challengeId
            });
            if (error) throw error;
            resultData = data;

            // Clear exam-specific storage
            localStorage.removeItem(`exam_progress_${examId}`);
            localStorage.removeItem(`exam_timer_${examId}`);
            if (examId) clearCache(`exam_cache_${examId}`);
        }

        const score = resultData.score;
        const totalQuestions = resultData.total;
        const totalEarned = resultData.total_earned || 0;
        const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

        // UI Updates
        if (scoreValEl) scoreValEl.textContent = `${percentage}%`;
        const scoreSub = document.getElementById("scoreSubtext");
        if (scoreSub) scoreSub.textContent = `حللت ${score} من ${totalQuestions} أسئلة`;

        // Clear user stats cache (forces fresh sync on dashboard)
        clearCache(`user_stats_${user.id}`);

        // --- UI Details ---
        const correctCountEl = document.getElementById("correctCount");
        const wrongCountEl = document.getElementById("wrongCount");
        const timeSpentEl = document.getElementById("timeSpent");

        if (correctCountEl) correctCountEl.textContent = score;
        if (wrongCountEl) wrongCountEl.textContent = totalQuestions - score;
        if (timeSpentEl) timeSpentEl.textContent = formatTime(timeElapsed);

        const hierarchyEl = document.getElementById("examHierarchy");
        if (hierarchyEl) {
            let hParts = [];
            if (hierarchyInfo.subject) hParts.push(`<span style="color:var(--primary-color)">${hierarchyInfo.subject}</span>`);
            if (hierarchyInfo.chapter) hParts.push(hierarchyInfo.chapter);
            if (hierarchyInfo.lesson) hParts.push(hierarchyInfo.lesson);
            hParts.push(`<span style="font-weight:800; color:#1e293b">${examTitle}</span>`);
            hierarchyEl.innerHTML = hParts.join(" <i class='fas fa-chevron-left' style='font-size:0.7rem; margin:0 5px; opacity:0.5'></i> ");
        }

        if (examTitleMobile) {
            examTitleMobile.innerHTML = `${examTitle} <span style="font-size:0.75rem; color:var(--primary-color); font-weight:normal; margin-right:5px;">(${isMistakesMode ? 'تمرين' : 'مراجعة'})</span>`;
        }

        // Animate Score
        let currentCountAnim = 0;
        if (scoreValEl) {
            scoreValEl.textContent = "0%";
            const animTimer = setInterval(() => {
                if (percentage === 0) {
                    scoreValEl.textContent = "0%";
                    clearInterval(animTimer);
                    handleExamCompletionFlow(totalEarned, percentage, resultData);
                    return;
                }
                currentCountAnim += 1;
                scoreValEl.textContent = `${currentCountAnim}%`;
                if (currentCountAnim >= percentage) {
                    clearInterval(animTimer);
                    handleExamCompletionFlow(totalEarned, percentage, resultData);
                }
            }, 15);
        }

        const resultTitle = document.getElementById("resultTitle");
        const resultMsg = document.getElementById("resultMessage");

        if (resultTitle && resultMsg) {
            if (percentage >= 85) {
                resultTitle.textContent = "ممتاز! 🥇";
                resultTitle.style.color = "var(--primary-color)";
                resultMsg.textContent = `جبت ${score} من ${totalQuestions}. كمل بنفس المستوى!`;
            } else if (percentage >= 50) {
                resultTitle.textContent = "جيد جداً";
                resultTitle.style.color = "var(--secondary-color)";
                resultMsg.textContent = `جبت ${score} من ${totalQuestions}. محتاج شوية تركيز المرة الجاية.`;
            } else {
                resultTitle.textContent = "محتاج تذاكر تاني";
                resultTitle.style.color = "#EF4444";
                resultMsg.textContent = `جبت ${score} من ${totalQuestions}. راجع المحاضرة وحاول تاني.`;
            }
        }

    } catch (err) {
        console.error("Submission Error:", err);
        showErrorAlert('خطأ', 'فشل في إرسال النتيجة: ' + err.message);
        if (scoreValEl) scoreValEl.innerHTML = '<span style="color:red; font-size:1rem;">فشل الإرسال</span>';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleExamCompletionFlow(totalEarned, percentage, resultData) {
    // 1. Squad Mode: ask to share result
    if (squadId && !isMistakesMode) {
        const { isConfirmed } = await Swal.fire({
            title: 'عرض نتيجتك؟',
            text: 'تحب تشارك درجتك مع صحابك في الشلة؟ (درجتك هتظهر جوه كارت الامتحان)',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ماشي',
            cancelButtonText: 'لا',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b'
        });
        const signal = isConfirmed ? `[CMD:FINISH:${percentage}]` : '[CMD:FINISH:HIDDEN]';
        await shareResultInSquadChat(signal);
    }

    // 2. Standard Exam: show points reward popup
    if (!isMistakesMode && totalEarned > 0) {
        let breakdownHtml = `<div style="text-align:right;direction:rtl;font-size:0.95rem;">`;
        if (resultData.points_exam > 0) breakdownHtml += `<span style="color:#64748b">من حلك للامتحان:</span> <b>${resultData.points_exam} نقطة</b><br>`;
        if (resultData.bonus_perfect > 0) breakdownHtml += `<span style="color:#10b981">بونص التقفيل:</span> <b>+${resultData.bonus_perfect} نقطة</b><br>`;
        if (resultData.bonus_streak > 0) breakdownHtml += `<span style="color:#f59e0b">بونص الاستمرارية:</span> <b>+${resultData.bonus_streak} نقطة</b><br>`;
        breakdownHtml += `</div>`;
        const isFunny = Math.random() < 0.2;
        await Swal.fire({
            title: isFunny ? `عاش يا قلبي 😘 خدت ${totalEarned} نقطة` : `عاش عليك. خدت ${totalEarned} نقط`,
            html: breakdownHtml,
            icon: 'success',
            confirmButtonText: isFunny ? 'ماشي يقلبي 😂' : 'ماشي',
            confirmButtonColor: 'var(--primary-color)',
            timer: totalEarned > 15 ? 15000 : 8000
        });
    }
}
async function shareResultInSquadChat(text) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('squad_chat_messages').insert({
            squad_id: squadId,
            sender_id: user.id,
            challenge_id: challengeId,
            text: text // text is the [CMD:...] signal
        });
    } catch (err) {
        console.error("Shared result error:", err);
    }
}

// Review Functions
function renderReview() {
    reviewContainer.innerHTML = "";

    const wrongQuestions = [];
    const unansweredQuestions = [];
    const correctQuestions = [];

    currentQuestions.forEach(q => {
        const userAnswer = userAnswers[q.id];
        const isCorrect = userAnswer === q.correct_answer;

        if (!userAnswer) {
            unansweredQuestions.push(q);
        } else if (isCorrect) {
            correctQuestions.push(q);
        } else {
            wrongQuestions.push(q);
        }
    });

    // 1. Wrong Questions
    if (wrongQuestions.length > 0) {
        renderSection("إجابات خاطئة ❌", "wrong", wrongQuestions);
    }

    // 2. Unanswered Questions
    if (unansweredQuestions.length > 0) {
        renderSection("أسئلة لم يتم حلها ⚠️", "unanswered", unansweredQuestions);
    }

    // 3. Correct Questions
    if (correctQuestions.length > 0) {
        renderSection("إجابات صحيحة ✅", "correct", correctQuestions);
    }
}

function renderSection(title, type, questions) {
    const sectionTitle = document.createElement("div");
    sectionTitle.className = "review-section-title";
    const icon = type === 'wrong' ? 'fa-times-circle' : (type === 'correct' ? 'fa-check-circle' : 'fa-exclamation-circle');
    const color = type === 'wrong' ? '#ef4444' : (type === 'correct' ? '#10b981' : '#f59e0b');

    sectionTitle.innerHTML = `<i class="fas ${icon}" style="color: ${color}"></i> ${title}`;
    reviewContainer.appendChild(sectionTitle);

    questions.forEach((q) => {
        const index = currentQuestions.findIndex(origQ => origQ.id === q.id);
        const userAnswer = userAnswers[q.id];
        const correctAnswer = q.correct_answer;
        const isCorrect = userAnswer === correctAnswer;

        const reviewCard = document.createElement("div");
        reviewCard.className = `review-question ${isCorrect ? 'correct' : (userAnswer ? 'wrong' : 'unanswered')}`;

        // Build options HTML
        let optionsHTML = '';
        const choiceKeys = ['a', 'b', 'c', 'd'];

        for (const key of choiceKeys) {
            let optionClass = '';
            let icon = '';
            const text = q[`choice_${key}`] || '';
            const img = q[`choice_${key}_image`];

            if (key === correctAnswer) {
                optionClass = 'correct-answer';
                icon = '<i class="fas fa-check-circle" style="color: #10B981; margin-left: 0.5rem;"></i>';
            } else if (key === userAnswer) {
                optionClass = 'user-wrong';
                icon = '<i class="fas fa-times-circle" style="color: #EF4444; margin-left: 0.5rem;"></i>';
            }

            let content = '';
            content += `<span style="margin-left:5px;">${text}</span>`;
            if (img) content += `<img src="${img}" class="choice-img" style="margin-right:5px;" onclick="openLightbox(this.src)">`;

            optionsHTML += `<div class="review-option ${optionClass}" style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display:flex; align-items:center;">${content}</div>
                ${icon}
            </div>`;
        }

        let explanationHTML = q.explanation ? `<div class="review-explanation"><strong><i class="fas fa-lightbulb"></i> الشرح:</strong> ${q.explanation}</div>` : '';

        reviewCard.innerHTML = `
            <div class="review-header">
                <span style="font-weight: bold; color: var(--text-dark);">سؤال ${index + 1}</span>
                <span class="review-status ${isCorrect ? 'correct' : (userAnswer ? 'wrong' : 'unanswered')}">
                    ${isCorrect ? '✓ إجابة صحيحة' : (userAnswer ? '✗ إجابة خاطئة' : '⚠️ لم يتم الحل')}
                </span>
            </div>
            <div class="question-text" style="font-size: 1rem; margin-bottom: 1rem;">${q.question_text || ''}</div>
            ${q.question_image ? `<img src="${q.question_image}" class="question-img" style="max-height:200px; margin-top:0.5rem;" onclick="openLightbox(this.src)">` : ''}
            ${optionsHTML}
            ${explanationHTML}
        `;
        reviewContainer.appendChild(reviewCard);
    });
}

// Scroll Top Logic
const scrollTopBtn = document.getElementById("scrollTopBtn");
const mainWrapper = document.querySelector('.main-wrapper');

if (mainWrapper && scrollTopBtn) {
    mainWrapper.onscroll = function () {
        if (mainWrapper.scrollTop > 500) {
            scrollTopBtn.classList.add("show");
        } else {
            scrollTopBtn.classList.remove("show");
        }
    };

    scrollTopBtn.onclick = function () {
        mainWrapper.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

// Event Listeners for Review
if (reviewBtn) {
    reviewBtn.addEventListener("click", () => {
        resultView.style.display = "none";
        reviewView.style.display = "block";
        renderReview();
        window.scrollTo(0, 0);
    });
}

if (backToResultBtn) {
    backToResultBtn.addEventListener("click", () => {
        reviewView.style.display = "none";
        resultView.style.display = "block";
        window.scrollTo(0, 0);
    });
}

// Init
initExam();

// Lightbox Logic
window.openLightbox = (src) => {
    let lightbox = document.getElementById('imageLightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'imageLightbox';
        lightbox.innerHTML = `
            <span class="close-lightbox" onclick="closeLightbox()">&times;</span>
            <img class="lightbox-content" id="lightboxImg">
        `;
        document.body.appendChild(lightbox);

        // Close on background click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
    }
    const img = document.getElementById('lightboxImg');
    img.src = src;
    lightbox.style.display = 'block';
};

window.closeLightbox = () => {
    const lightbox = document.getElementById('imageLightbox');
    if (lightbox) lightbox.style.display = 'none';
};
