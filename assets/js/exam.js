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
const examTitleEl = document.getElementById("examTitle");
const progressBar = document.getElementById("progressBar");
const qCountEl = document.getElementById("qCount");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");
const timerDisplay = document.getElementById("timerDisplay");
const timerBox = document.getElementById("timerBox");
const reviewBtn = document.getElementById("reviewBtn");
const backToResultBtn = document.getElementById("backToResultBtn");

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
        examTitleEl.textContent = examTitle;

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

        currentQuestions = questions;

        // Smart Timer: 1 minute per question
        totalTime = questions.length * 60; // seconds

        renderQuestions();
        showQuestion(0);
        startTimer();

        loadingEl.style.display = "none";
        examView.style.display = "block";

    } catch (err) {
        console.error("Error:", err);
        loadingEl.innerHTML = `<p style="color:red">حدث خطأ: ${err.message}</p>`;
    }
}

function renderQuestions() {
    questionsContainer.innerHTML = "";

    currentQuestions.forEach((q, index) => {
        const card = document.createElement("div");
        card.className = "question-card";
        card.dataset.index = index;
        card.id = `q-card-${index}`;

        card.innerHTML = `
            <div class="question-number">سؤال ${index + 1} من ${currentQuestions.length}</div>
            <div class="question-text">${q.question_text}</div>
            <div class="options-grid">
                <label class="option-label">
                    <input type="radio" name="q_${q.id}" value="a" class="option-input" onchange="saveAnswer('${q.id}', 'a')">
                    <span class="option-text">${q.choice_a}</span>
                </label>
                <label class="option-label">
                    <input type="radio" name="q_${q.id}" value="b" class="option-input" onchange="saveAnswer('${q.id}', 'b')">
                    <span class="option-text">${q.choice_b}</span>
                </label>
                <label class="option-label">
                    <input type="radio" name="q_${q.id}" value="c" class="option-input" onchange="saveAnswer('${q.id}', 'c')">
                    <span class="option-text">${q.choice_c}</span>
                </label>
                <label class="option-label">
                    <input type="radio" name="q_${q.id}" value="d" class="option-input" onchange="saveAnswer('${q.id}', 'd')">
                    <span class="option-text">${q.choice_d}</span>
                </label>
            </div>
        `;
        questionsContainer.appendChild(card);
    });
}

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
    qCountEl.textContent = `${index + 1} / ${currentQuestions.length}`;

    const progress = ((index + 1) / currentQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;

    prevBtn.style.opacity = index === 0 ? "0.5" : "1";
    prevBtn.style.pointerEvents = index === 0 ? "none" : "auto";

    if (index === currentQuestions.length - 1) {
        nextBtn.style.display = "none";
        submitBtn.style.display = "inline-block";
    } else {
        nextBtn.style.display = "inline-block";
        submitBtn.style.display = "none";
    }
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

// Submit with Modal
submitBtn.addEventListener("click", () => {
    document.getElementById('confirmModal').classList.add('show');
});

window.closeModal = () => {
    document.getElementById('confirmModal').classList.remove('show');
};

window.confirmSubmit = () => {
    closeModal();
    calculateResult();
};

function calculateResult() {
    clearInterval(timerInterval);

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
    let current = 0;
    const timer = setInterval(() => {
        current += 1;
        scoreValEl.textContent = `${current}%`;
        if (current >= percentage) clearInterval(timer);
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

    currentQuestions.forEach((q, index) => {
        const userAnswer = userAnswers[q.id];
        const correctAnswer = q.correct_answer;
        const isCorrect = userAnswer === correctAnswer;

        const reviewCard = document.createElement("div");
        reviewCard.className = `review-question ${isCorrect ? 'correct' : 'wrong'}`;

        // Build options HTML
        let optionsHTML = '';
        const choices = {
            'a': q.choice_a,
            'b': q.choice_b,
            'c': q.choice_c,
            'd': q.choice_d
        };

        for (const [key, text] of Object.entries(choices)) {
            let optionClass = '';
            let icon = '';

            if (key === correctAnswer) {
                optionClass = 'correct-answer';
                icon = '<i class="fas fa-check-circle" style="color: #10B981; margin-left: 0.5rem;"></i>';
            }

            if (!isCorrect && key === userAnswer) {
                optionClass = 'user-wrong';
                icon = '<i class="fas fa-times-circle" style="color: #EF4444; margin-left: 0.5rem;"></i>';
            }

            optionsHTML += `
                <div class="review-option ${optionClass}">
                    ${text} ${icon}
                </div>
            `;
        }

        // Explanation
        let explanationHTML = '';
        if (q.explanation) {
            explanationHTML = `
                <div class="review-explanation">
                    <strong><i class="fas fa-lightbulb"></i> الشرح:</strong> ${q.explanation}
                </div>
            `;
        }

        reviewCard.innerHTML = `
            <div class="review-header">
                <span style="font-weight: bold; color: var(--text-dark);">سؤال ${index + 1}</span>
                <span class="review-status ${isCorrect ? 'correct' : 'wrong'}">
                    ${isCorrect ? '✓ إجابة صحيحة' : '✗ إجابة خاطئة'}
                </span>
            </div>
            <div class="question-text" style="font-size: 1.2rem; margin-bottom: 1.5rem;">
                ${q.question_text}
            </div>
            ${optionsHTML}
            ${explanationHTML}
        `;

        reviewContainer.appendChild(reviewCard);
    });
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
