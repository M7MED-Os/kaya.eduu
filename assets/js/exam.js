import { supabase } from "./supabaseClient.js";

const urlParams = new URLSearchParams(window.location.search);
const examId = urlParams.get('id');

let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // { questionId: 'a' }
let examTitle = "";
let timerInterval = null;
let timeElapsed = 0; // in seconds
let totalTime = 0; // calculated based on questions

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
if (!examId) {
    alert("امتحان غير موجود");
    window.location.href = "dashboard.html";
}

async function initExam() {
    try {
        // 1. Fetch Exam Details
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('*')
            .eq('id', examId)
            .single();

        if (examError || !exam) throw new Error("Exam not found");
        examTitle = exam.title;
        if (examTitleMobile) examTitleMobile.textContent = examTitle;

        // 2. Fetch Questions
        const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('*')
            .eq('exam_id', examId);

        if (qError) throw qError;

        if (!questions || questions.length === 0) {
            loadingEl.innerHTML = "<p>عفواً، لا توجد أسئلة في هذا الامتحان.</p>";
            return;
        }

        // Shuffle questions for randomized order
        currentQuestions = shuffleArray(questions);

        // Smart Timer: 1 minute per question
        totalTime = questions.length * 60; // seconds

        renderQuestions();
        renderNavigator();
        showQuestion(0);
        startTimer();

        loadingEl.style.display = "none";
        examView.style.display = "block";
        if (examFooter) examFooter.style.display = "flex";

    } catch (err) {
        console.error("Error:", err);
        loadingEl.innerHTML = `<p style="color:red">حدث خطأ: ${err.message}</p>`;
    }
}

// Utility: Fisher-Yates Shuffle
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
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
                <span class="q-tag">سؤال ${index + 1}</span>
                <span style="color: #718096; font-size: 0.9rem;">${currentQuestions.length} سؤال كلي</span>
            </div>
            <div class="question-text">${q.question_text}</div>
            <div class="options-list">
                ${['a', 'b', 'c', 'd'].map(opt => `
                    <label class="option-label" id="label-${q.id}-${opt}">
                        <input type="radio" name="q_${q.id}" value="${opt}" class="option-radio" onchange="handleAnswerChange('${q.id}', '${opt}', ${index})">
                        <span class="option-text">${q[`choice_${opt}`]}</span>
                    </label>
                `).join('')}
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
};

window.saveAnswer = (qId, answer) => {
    userAnswers[qId] = answer;
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
    } else {
        nextBtn.style.display = "inline-block";
        submitBtn.style.display = "none";
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Timer Functions
function startTimer() {
    timerInterval = setInterval(() => {
        timeElapsed++;
        updateTimerDisplay();

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

    if (answeredQ < totalQ) {
        // Show Warning Modal
        document.getElementById('warningModal').style.display = 'flex';
        document.getElementById('warningOverlay').style.display = 'block';
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

function calculateResult() {
    clearInterval(timerInterval);
    if (examFooter) examFooter.style.display = "none";
    if (timerBox) timerBox.style.display = "none";
    if (headerFinishBtn) headerFinishBtn.style.display = "none";

    const sidebar = document.querySelector('.nav-sidebar');
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    if (sidebar) sidebar.style.display = "none";
    if (mobileToggle) mobileToggle.style.display = "none";

    let score = 0;
    let correct = 0;
    let wrong = 0;
    let total = currentQuestions.length;

    currentQuestions.forEach(q => {
        if (userAnswers[q.id] === q.correct_answer) {
            score++;
            correct++;
        } else {
            wrong++;
        }
    });

    const percentage = Math.round((score / total) * 100);

    // Save result to database
    saveResultToDatabase(score, total, timeElapsed, userAnswers);

    // Show Result UI
    examView.style.display = "none";
    resultView.style.display = "block";

    const scoreValEl = document.getElementById("scoreValue");
    const resultTitle = document.getElementById("resultTitle");
    const resultMsg = document.getElementById("resultMessage");
    const correctCountEl = document.getElementById("correctCount");
    const wrongCountEl = document.getElementById("wrongCount");
    const timeSpentEl = document.getElementById("timeSpent");

    // Populate Stats
    correctCountEl.textContent = correct;
    wrongCountEl.textContent = wrong;
    timeSpentEl.textContent = formatTime(timeElapsed);

    // Animate Score
    let currentCountAnim = 0;
    const animTimer = setInterval(() => {
        if (percentage === 0) {
            scoreValEl.textContent = "0%";
            clearInterval(animTimer);
            return;
        }
        currentCountAnim += 1;
        scoreValEl.textContent = `${currentCountAnim}%`;
        if (currentCountAnim >= percentage) clearInterval(animTimer);
    }, 15);

    if (percentage >= 85) {
        resultTitle.textContent = "ممتاز يا بطل! 🥇";
        resultTitle.style.color = "var(--primary-color)";
        resultMsg.textContent = `جبت ${score} من ${total}. أداء رائع، كمل بنفس المستوى!`;
    } else if (percentage >= 50) {
        resultTitle.textContent = "جيد جداً 👍";
        resultTitle.style.color = "var(--secondary-color)";
        resultMsg.textContent = `جبت ${score} من ${total}. محتاج شوية تركيز المرة الجاية.`;
    } else {
        resultTitle.textContent = "محتاج تذاكر تاني 📚";
        resultTitle.style.color = "#EF4444";
        resultMsg.textContent = `جبت ${score} من ${total}. راجع الدرس وحاول تاني.`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Save Result to Database
async function saveResultToDatabase(score, total, timeSpent, answersData) {
    try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error("User not authenticated, cannot save result");
            return;
        }

        // Insert result
        const { data, error } = await supabase
            .from('results')
            .insert({
                user_id: user.id,
                exam_id: examId,
                score: score,
                total_questions: total,
                time_spent: timeSpent,
                answers: answersData
            });

        if (error) {
            console.error("Error saving result:", error);
        } else {
            console.log("✅ Result saved successfully!");
        }
    } catch (err) {
        console.error("Exception while saving result:", err);
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
        const choices = { 'a': q.choice_a, 'b': q.choice_b, 'c': q.choice_c, 'd': q.choice_d };

        for (const [key, text] of Object.entries(choices)) {
            let optionClass = '';
            let icon = '';

            if (key === correctAnswer) {
                optionClass = 'correct-answer';
                icon = '<i class="fas fa-check-circle" style="color: #10B981; margin-left: 0.5rem;"></i>';
            } else if (key === userAnswer) {
                optionClass = 'user-wrong';
                icon = '<i class="fas fa-times-circle" style="color: #EF4444; margin-left: 0.5rem;"></i>';
            }

            optionsHTML += `<div class="review-option ${optionClass}">${text} ${icon}</div>`;
        }

        let explanationHTML = q.explanation ? `<div class="review-explanation"><strong><i class="fas fa-lightbulb"></i> الشرح:</strong> ${q.explanation}</div>` : '';

        reviewCard.innerHTML = `
            <div class="review-header">
                <span style="font-weight: bold; color: var(--text-dark);">سؤال ${index + 1}</span>
                <span class="review-status ${isCorrect ? 'correct' : (userAnswer ? 'wrong' : 'unanswered')}">
                    ${isCorrect ? '✓ إجابة صحيحة' : (userAnswer ? '✗ إجابة خاطئة' : '⚠️ لم يتم الحل')}
                </span>
            </div>
            <div class="question-text" style="font-size: 1rem; margin-bottom: 1.25rem;">${q.question_text}</div>
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
