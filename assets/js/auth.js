import { supabase } from "./supabaseClient.js";

// ==========================
// 1. Auth State Management
// ==========================

// Check if user is logged in on protected pages
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        // Not logged in, redirect to login if page is protected
        const protectedPages = ["dashboard.html", "subject.html", "leaderboard.html", "profile.html"];
        const currentPage = window.location.pathname.split("/").pop();
        if (protectedPages.includes(currentPage)) {
            window.location.href = "login.html";
        }
        return null;
    }

    // User is logged in
    const { data: profile } = await supabase.from('profiles')
        .select('role, is_active, subscription_ends_at, full_name, points')
        .eq('id', session.user.id)
        .single();

    const protectedPages = ["dashboard.html", "subject.html", "leaderboard.html", "profile.html"];
    const currentPage = window.location.pathname.split("/").pop();

    // 1. Check Activation & Expiry
    const now = new Date();
    const expiry = profile?.subscription_ends_at ? new Date(profile.subscription_ends_at) : null;
    const isExpired = expiry && now > expiry;

    if (profile && profile.role !== 'admin') {
        if (!profile.is_active || isExpired) {
            if (protectedPages.includes(currentPage)) {
                window.location.href = "pending.html";
                return null;
            }
        }
    }

    // 2. Dashboard Warnings
    if (currentPage === "dashboard.html" && profile && expiry && !isExpired) {
        const diffMs = expiry - now;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays <= 3) {
            showSubscriptionWarning(expiry);
        }
    }

    // 3. Redirections for auth/pending pages - Only redirect from pending if NOT expired
    const authPages = ["login.html", "register.html"];
    if (authPages.includes(currentPage)) {
        window.location.href = "dashboard.html";
    }

    if (currentPage === "pending.html" && profile && profile.is_active && !isExpired) {
        window.location.href = "dashboard.html";
    }

    return { ...session.user, profile };
}

function showSubscriptionWarning(expiry) {
    const parent = document.querySelector('header.dashboard-header .container') || document.body;

    // Check if already exists
    if (document.getElementById('expiryWarning')) return;

    const dateStr = expiry.toLocaleDateString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: 'numeric'
    });

    const banner = document.createElement('div');
    banner.id = 'expiryWarning';
    banner.style = `
        background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
        border-right: 5px solid #fb8c00;
        color: #e65100;
        padding: 1.25rem;
        border-radius: 16px;
        margin-top: 1.5rem;
        display: flex;
        align-items: center;
        gap: 15px;
        box-shadow: 0 10px 20px rgba(251, 140, 0, 0.1);
        animation: slideIn 0.5s ease-out;
    `;

    banner.innerHTML = `
        <div style="background:#fb8c00; color:white; width:45px; height:45px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
            <i class="fas fa-hourglass-half"></i>
        </div>
        <div style="flex:1">
            <h4 style="margin:0; font-size:1.1rem; font-weight:900;">اشتراكك أوشك على الانتهاء! ⚠️</h4>
            <p style="margin:2px 0 0; font-size:0.9rem; opacity:0.9;">سيفصل الحساب تلقائياً في: <b>${dateStr}</b></p>
        </div>
        <a href="pending.html" style="background:#fb8c00; color:white; padding:8px 16px; border-radius:10px; text-decoration:none; font-size:0.85rem; font-weight:bold; transition:0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">تجديد الآن</a>
    `;

    if (parent === document.body) {
        banner.style.position = 'fixed';
        banner.style.top = '20px';
        banner.style.left = '20px';
        banner.style.right = '20px';
        banner.style.zIndex = '10000';
    }

    parent.prepend(banner);
}

// ==========================
// 2. Logout
// ==========================

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error);
        } else {
            window.location.href = "login.html";
        }
    });
}

// ==========================
// 3. Toast Notifications
// ==========================

function showToast(message, type = "success") {
    // 1. Get or Create Container
    let container = document.querySelector(".toast-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container); // Appending to body is fine now as CSS handles fixed position
    }

    // 2. Create Toast
    const toast = document.createElement("div");
    toast.className = `toast ${type}`; // Correct: "toast success"

    // Add content (Icon + Message)
    const iconClass = type === "success" ? "fa-check-circle" : "fa-exclamation-circle";
    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span class="toast-message">${message}</span>
    `;

    // 3. Append to Container
    container.appendChild(toast);

    // 4. Handle Removal (Animation is handled by CSS keyframes on mount)
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.4s ease forwards";
        toast.addEventListener("animationend", () => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove(); // Cleanup container if empty
            }
        });
    }, 3000);
}

// ==========================
// 4. Input Error Handling
// ==========================

function showInputError(inputElement, message) {
    if (!inputElement) return;
    clearInputError(inputElement);
    inputElement.classList.add("input-error");
    const errorMsg = document.createElement("small");
    errorMsg.className = "error-message";
    errorMsg.textContent = message;
    inputElement.parentNode.insertBefore(errorMsg, inputElement.nextSibling);
    inputElement.addEventListener("input", () => clearInputError(inputElement), {
        once: true,
    });
}

function clearInputError(inputElement) {
    if (!inputElement) return;
    inputElement.classList.remove("input-error");
    const errorMsg = inputElement.parentNode.querySelector(".error-message");
    if (errorMsg) errorMsg.remove();
}

// ==========================
// 5. Registration Form
// ==========================

const registerForm = document.getElementById("registerForm");
if (registerForm) {
    const gradeSelect = document.getElementById("grade");
    const termGroup = document.getElementById("termGroup");
    const streamGroup = document.getElementById("streamGroup");

    // Dynamic field visibility
    if (gradeSelect) {
        gradeSelect.addEventListener("change", () => {
            const grade = gradeSelect.value;
            if (grade === "1" || grade === "2") {
                termGroup.style.display = "block";
                streamGroup.style.display = "none";
            } else if (grade === "3") {
                termGroup.style.display = "none";
                streamGroup.style.display = "block";
            } else {
                termGroup.style.display = "none";
                streamGroup.style.display = "none";
            }
        });
    }

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const full_name_input = document.getElementById("fullname");
        const email_input = document.getElementById("email");
        const password_input = document.getElementById("password");
        const grade_input = document.getElementById("grade");
        const term_input = document.getElementById("term");
        const stream_input = document.getElementById("stream");

        const full_name = full_name_input.value.trim();
        const email = email_input.value.trim();
        const password = password_input.value;
        const grade = grade_input.value;
        const term = term_input.value;
        const stream = stream_input.value;

        let isValid = true;
        if (!full_name) {
            showInputError(full_name_input, "اكتب اسمك بالكامل");
            isValid = false;
        }
        if (!email) {
            showInputError(email_input, "اكتب إيميلك");
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showInputError(email_input, "اكتب إيميل صح (مثال: name@gmail.com)");
            isValid = false;
        }
        if (!password) {
            showInputError(password_input, "اكتب كلمة السر");
            isValid = false;
        } else if (password.length < 6) {
            showInputError(password_input, "كلمة السر لازم تكون 6 حروف على الأقل");
            isValid = false;
        }
        if (!grade) {
            showInputError(grade_input, "اختار السنة الدراسية");
            isValid = false;
        }

        if (!isValid) return;

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "جاري التسجيل...";

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name,
                        grade,
                        term: term || null,
                        stream: stream || null,
                    },
                },
            });

            if (error) throw error;

            showToast("تم التسجيل بنجاح! تحقق من إيميلك لتفعيل الحساب.", "success");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);
        } catch (error) {
            console.error("Registration error:", error);
            showToast(error.message || "حدث خطأ أثناء التسجيل", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "تسجيل حساب جديد";
        }
    });
}

// ==========================
// 6. Login Form
// ==========================

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email_input = document.getElementById("email");
        const password_input = document.getElementById("password");

        const email = email_input.value.trim();
        const password = password_input.value;

        let isValid = true;
        if (!email) {
            showInputError(email_input, "اكتب إيميلك");
            isValid = false;
        }
        if (!password) {
            showInputError(password_input, "اكتب كلمة السر");
            isValid = false;
        }

        if (!isValid) return;

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "جاري تسجيل الدخول...";

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                if (error.message.includes("Email not confirmed")) {
                    throw new Error("لازم تفعل حسابك الأول من الإيميل اللي وصلك");
                } else if (error.message.includes("Invalid login credentials")) {
                    throw new Error("الإيميل أو كلمة السر غلط");
                }
                throw error;
            }

            showToast("تم تسجيل الدخول بنجاح!", "success");
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1000);
        } catch (error) {
            console.error("Login error:", error);
            showToast(error.message || "حدث خطأ أثناء تسجيل الدخول", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "تسجيل الدخول";
        }
    });
}

// ==========================
// 7. Forgot Password (طلب استعادة)
// ==========================
const forgotForm = document.getElementById("forgotPasswordForm");
if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById("email");
        const email = emailInput.value.trim();

        if (!email) {
            showInputError(emailInput, "برجاء كتابة البريد الإلكتروني");
            return;
        }

        const btn = forgotForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'https://kaya-eduu.vercel.app/reset-password.html',
            });

            if (error) throw error;

            showToast("تم إرسال رابط الاستعادة لإيميلك بنجاح!", "success");
            emailInput.value = "";
        } catch (err) {
            console.error("Reset request error:", err);
            showToast(err.message || "حدث خطأ أثناء الإرسال", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "إرسال رابط إعادة التعيين";
        }
    });
}

// ==========================
// 8. Reset Password (تعيين الكلمة الجديدة)
// ==========================
const resetForm = document.getElementById("resetPasswordForm");
if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const passInput = document.getElementById("newPassword");
        const confirmInput = document.getElementById("confirmPassword");

        const password = passInput.value;
        const confirm = confirmInput.value;

        let isValid = true;
        if (password.length < 6) {
            showInputError(passInput, "كلمة السر يجب أن تكون 6 أحرف على الأقل");
            isValid = false;
        }
        if (password !== confirm) {
            showInputError(confirmInput, "كلمات السر غير متطابقة");
            isValid = false;
        }

        if (!isValid) return;

        const btn = resetForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            showToast("تم تحديث كلمة السر بنجاح!", "success");
            setTimeout(() => window.location.href = "login.html", 2000);
        } catch (err) {
            console.error("Update password error:", err);
            showToast(err.message || "فشل تحديث كلمة السر", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "تأكيد كلمة المرور";
        }
    });
}

// ==========================
// 9. Dashboard - Load User Profile
// ==========================

async function loadUserProfile() {
    try {
        const user = await checkAuth();
        if (!user) return;

        const userMetadata = user.user_metadata;
        const fullName = userMetadata?.full_name || "الطالب";

        // Try to fetch from profiles table
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Profile Fetch Error:", error);
        }

        // Use profile data if available, otherwise fallback to metadata
        const dataToRender = profile || userMetadata;


        if (!profile) {
            // Profile doesn't exist, create it (Self-healing)
            const { error: insertError } = await supabase.from("profiles").insert({
                id: user.id,
                full_name: fullName,
                email: user.email,
                grade: userMetadata?.grade || null,
                term: userMetadata?.term || null,
                stream: userMetadata?.stream || null,
            });

            if (!insertError) updateNameUI(fullName);
        }

        // Update UI elements that depend on the profile data
        if (profile) {
            updateNameUI(profile.full_name);

            // Update Points Stat Card
            const pointsEl = document.getElementById('stats-points');
            if (pointsEl) pointsEl.textContent = profile.points || 0;

            if (profile.role === 'admin') {
                const adminBtn = document.getElementById('adminNavBtn');
                if (adminBtn) adminBtn.style.display = 'block';

                const pwaAdminBtn = document.getElementById('pwaAdminBtn');
                if (pwaAdminBtn) pwaAdminBtn.classList.add('is-admin');
            } else {
                const adminBtn = document.getElementById('adminNavBtn');
                if (adminBtn) adminBtn.remove();

                const pwaAdminBtn = document.getElementById('pwaAdminBtn');
                if (pwaAdminBtn) pwaAdminBtn.remove();
            }
        }

        // Parallel Execution: Render Subjects & Load Results
        // This makes the dashboard load much faster by not waiting for one to finish before starting the other
        const tasks = [];

        // 1. Subjects
        tasks.push(renderSubjects(dataToRender));

        // 2. Results & Stats
        tasks.push(loadUserDashboardData(user.id));

        await Promise.all(tasks);

    } catch (err) {
        console.error("Profile Fetch Error:", err);
    } finally {
        const loadingEl = document.getElementById("loading");
        if (loadingEl) {
            loadingEl.style.opacity = "0";
            setTimeout(() => {
                if (loadingEl.parentNode) loadingEl.remove();
            }, 500);
        }
    }
}

// fetchLeaderboard is now handled in leaderboard.html via direct script


async function loadUserDashboardData(userId) {
    try {
        // Parallel Fetch: 
        // 1. Stats (Lightweight, all history)
        // 2. Recent Results (Heavy, limit 5)

        const statsPromise = supabase
            .from('results')
            .select('score, total_questions, percentage, exam_id') // Fetch ONLY needed columns
            .eq('user_id', userId);

        const historyPromise = supabase
            .from('results')
            .select(`
                *,
                exams (
                    title,
                    subject_id,
                    chapter_id,
                    lesson_id,
                    chapters:chapter_id (title),
                    lessons:lesson_id (
                        title,
                        chapters:chapter_id (title)
                    )
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5); // Fixed Limit

        const [statsResponse, historyResponse] = await Promise.all([statsPromise, historyPromise]);

        if (statsResponse.error) throw statsResponse.error;
        if (historyResponse.error) throw historyResponse.error;

        const allResults = statsResponse.data || [];
        const recentResults = historyResponse.data || [];

        // --- 1. Update Stats UI ---
        const totalSolved = allResults.reduce((sum, r) => sum + (r.score || 0), 0);
        const totalExams = new Set(allResults.map(r => r.exam_id)).size;

        // Calculate Accuracy
        const totalPossible = allResults.reduce((sum, r) => sum + (r.total_questions || 0), 0);
        const avgScore = allResults.length > 0 ? Math.round(allResults.reduce((sum, r) => sum + r.percentage, 0) / allResults.length) : 0;
        const bestScore = allResults.length > 0 ? Math.max(...allResults.map(r => r.percentage)) : 0;
        const accuracy = totalPossible > 0 ? Math.round((totalSolved / totalPossible) * 100) : 0;

        const qEl = document.getElementById('stats-questions');
        const eEl = document.getElementById('stats-exams');
        const aEl = document.getElementById('stats-accuracy');

        if (qEl) qEl.textContent = totalSolved;
        if (eEl) eEl.textContent = totalExams;
        if (aEl) aEl.textContent = `%${accuracy}`;

        // Update Results Stats Section
        renderResultsStats(totalExams, avgScore, bestScore);

        // --- 2. Update History List UI ---
        if (recentResults.length > 0) {
            const resultsSection = document.getElementById('resultsSection');
            if (resultsSection) resultsSection.style.display = 'block';

            // Group recent results (should be simple as we just want a list, but keeping grouping logic for safety)
            const examGroups = {};
            recentResults.forEach(result => {
                if (!examGroups[result.exam_id]) examGroups[result.exam_id] = [];
                examGroups[result.exam_id].push(result);
            });

            // Need subjects map for the list renderer
            const subjects = await loadSubjectsFromDB(); // This might be cached or filtered, ideally renderResultsList should handle its own lookups or we pass it.
            // Simplified: The previous renderResultsList fetched subjects again. Let's fix that too.
            // For now, let's call the optimized render function directly
            renderResultsList(examGroups, recentResults);
        }

    } catch (err) {
        console.error("Dashboard Data Error:", err);
    }
}

// Helper to keep UI update logic DRY
function updateNameUI(name) {
    const firstName = name.split(" ")[0];
    const studentNameEl = document.getElementById("studentName");

    if (studentNameEl) studentNameEl.textContent = firstName;
    // navUserName text is now static "البروفايل" as per user request
}

// ==========================
// 10. Dynamic Subject Rendering (Database-Driven)
// ==========================

// Cache for subjects to avoid repeated queries
let subjectsCache = {};

async function loadSubjectsFromDB(grade) {
    if (subjectsCache[grade]) return subjectsCache[grade];

    let query = supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

    if (grade) {
        query = query.eq('grade', grade); // Server-side optimized filter
    }

    const { data: subjects, error } = await query;

    if (error) {
        console.error('Error loading subjects:', error);
        return [];
    }

    subjectsCache[grade] = subjects;
    return subjects;
}

async function renderSubjects(userMetadata) {
    const grid = document.getElementById("subjectsGrid");
    if (!grid) return;

    grid.innerHTML = ""; // Clear content

    const grade = userMetadata?.grade; // "1", "2", "3"
    const stream = userMetadata?.stream; // "science_bio", ...
    const term = userMetadata?.term; // "1", "2"

    if (!grade) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 2rem;">يرجى تحديث بياناتك الدراسية</p>`;
        return;
    }

    // Load ONLY relevant subjects from database
    const allSubjects = await loadSubjectsFromDB(grade);

    // Filter Logic
    if (grade === "1" || grade === "2") {
        // ==========================
        // Grade 1 & 2 Logic (Simple)
        // ==========================
        const filteredSubjects = allSubjects.filter(s => s.grade === grade && s.term === term);

        if (filteredSubjects.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 2rem;">لا توجد مواد مضافة لهذا الترم بعد.</p>`;
            return;
        }

        renderSection("", filteredSubjects, grid);

    } else if (grade === "3") {
        // ==========================
        // Grade 3 Logic (Grouped)
        // ==========================

        // 1. Languages (All G3)
        const languagesList = allSubjects.filter(s => s.grade === "3" && s.stream === "languages");

        // 2. Specialized Subjects
        const specializedList = allSubjects.filter(s => {
            if (s.grade !== "3") return false;

            // Common Scientific (Bio + Math)
            if (s.stream === "scientific_common") {
                return (stream === "science_bio" || stream === "science_math");
            }

            // Specific Streams
            if (stream === "science_bio" && s.stream === "science_bio") return true;
            if (stream === "science_math" && s.stream === "science_math") return true;
            if (stream === "literature" && s.stream === "literature") return true;

            return false;
        });

        // 3. Non-Scoring (All G3)
        const nonScoringList = allSubjects.filter(s => s.grade === "3" && s.stream === "non_scoring");

        // Render in fixed order
        let hasSubjects = false;

        if (languagesList.length > 0) {
            renderSection("اللغات", languagesList, grid);
            hasSubjects = true;
        }

        if (specializedList.length > 0) {
            renderSection("مواد التخصص", specializedList, grid);
            hasSubjects = true;
        }

        if (nonScoringList.length > 0) {
            renderSection("المواد غير المضافة للمجموع", nonScoringList, grid);
            hasSubjects = true;
        }

        if (!hasSubjects) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 2rem;">لا توجد مواد مضافة لهذا القسم بعد.</p>`;
        }
    }
}

function renderSection(title, subjects, container) {
    if (!subjects || subjects.length === 0) return;

    // Render Section Title (if provided)
    if (title) {
        const titleEl = document.createElement("h3");
        titleEl.textContent = title;
        titleEl.className = "section-header";
        // Ensure it spans full width in CSS Grid
        titleEl.style.cssText = "grid-column: 1 / -1; margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.25rem; color: var(--primary-dark); border-bottom: 2px solid #eee; padding-bottom: 0.5rem;";

        // Remove top margin for the first item if grid is empty
        if (container.children.length === 0) {
            titleEl.style.marginTop = "0";
        }

        container.appendChild(titleEl);
    }

    // Render Cards
    subjects.forEach(subject => {
        const card = document.createElement("div");
        card.className = "card subject-card";
        // Default icon if none provided (though DB redesign didn't enforce icon, let's assume valid FA class or default)
        const iconClass = subject.icon || "fa-book";

        card.innerHTML = `
            <div class="subject-header">
                <i class="fas ${iconClass} subject-icon"></i>
                <h3>${subject.name_ar}</h3>
            </div>
            <div class="subject-body">
                <a href="subject.html?id=${subject.id}" class="btn btn-primary subject-btn">دخول المادة</a>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==========================
// 11. Results Display
// ==========================

// Heavily modified to accept data directly instead of fetching


function renderResultsStats(totalExams, avgScore, bestScore) {
    const statsGrid = document.getElementById('resultsStatsGrid');
    if (!statsGrid) return;

    statsGrid.innerHTML = `
        <div class="stat-card">
            <span class="stat-number">${totalExams}</span>
            <span class="stat-label">امتحانات مختلفة</span>
        </div>
        <div class="stat-card">
            <span class="stat-number">${avgScore}%</span>
            <span class="stat-label">متوسط الدرجات</span>
        </div>
        <div class="stat-card">
            <span class="stat-number">${bestScore}%</span>
            <span class="stat-label">أفضل درجة</span>
        </div>
    `;
}

async function renderResultsList(examGroups) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    container.innerHTML = '';

    // Load subjects for name lookup
    const subjects = await loadSubjectsFromDB();
    const subjectsMap = {};
    subjects.forEach(s => subjectsMap[s.id] = s);

    // Get all latest attempts (one per exam)
    const latestAttempts = [];
    Object.values(examGroups).forEach(attempts => {
        // Sort by date and get the latest
        attempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        latestAttempts.push(attempts[0]);
    });

    // Sort by most recent and take top 5
    latestAttempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const recentFive = latestAttempts.slice(0, 5);

    if (recentFive.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light);">لم تحل أي امتحانات بعد</p>';
        return;
    }

    recentFive.forEach(result => {
        const examData = result.exams || {};
        const examTitle = examData.title || 'امتحان';
        const subjectId = examData.subject_id || '';
        const subjectName = subjectsMap[subjectId]?.name_ar || 'مادة';

        // Hierarchy logic: Check exam's direct chapter, then lesson's chapter
        const chapterTitle = examData.chapters?.title || examData.lessons?.chapters?.title || "";
        const lessonTitle = examData.lessons?.title || "";

        // Final Hierarchy: Chapter - Lesson - Exam
        let hierarchyParts = [];
        if (chapterTitle) hierarchyParts.push(chapterTitle);
        if (lessonTitle) hierarchyParts.push(lessonTitle);
        hierarchyParts.push(examTitle);
        const hierarchyText = hierarchyParts.join(" - ");

        const attempts = examGroups[result.exam_id] || [];
        attempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        let comparisonHTML = '';
        let datesHTML = `<div style="font-size: 0.75rem; color: var(--text-light);"><i class="far fa-calendar-alt"></i> ${new Date(result.created_at).toLocaleDateString('ar-EG')}</div>`;

        if (attempts.length >= 2) {
            const current = attempts[0].percentage;
            const previous = attempts[1].percentage;
            const diff = current - previous;

            const icon = diff > 0 ? '📈' : diff < 0 ? '📉' : '➖';
            const color = diff > 0 ? '#10B981' : diff < 0 ? '#EF4444' : '#94A3B8';
            const sign = diff > 0 ? '+' : '';

            comparisonHTML = `<div style="font-size: 0.85rem; font-weight: bold; color: ${color}; margin-top: 4px;">${icon} ${sign}${diff}%</div>`;

            datesHTML = `
                <div style="font-size: 0.7rem; color: var(--text-light); text-align: left;">
                    <div title="آخر محاولة">🆕 ${new Date(attempts[0].created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</div>
                    <div title="المحاولة السابقة" style="opacity: 0.7;">🕒 ${new Date(attempts[1].created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</div>
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = 'margin-bottom: 1rem; padding: 1.2rem; border-right: 4px solid var(--primary-color);';

        const percentageColor = result.percentage >= 85 ? '#10B981' : result.percentage >= 50 ? 'var(--secondary-color)' : '#EF4444';

        if (attempts.length === 1) {
            // Single attempt
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div style="flex: 1; min-width: 200px;">
                        <div style="font-weight: bold; color: var(--primary-color); margin-bottom: 0.2rem;">
                            <i class="fas fa-book"></i> ${subjectName}
                        </div>
                        <h4 style="font-size: 0.8rem; margin: 0; color: var(--text-light); font-weight: normal; line-height: 1.4;">
                            ${hierarchyText}
                        </h4>
                    </div>
                    <div style="text-align: center; min-width: 80px;">
                        <div style="font-size: 1.8rem; font-weight: 900; color: ${percentageColor}; line-height: 1;">
                            ${result.percentage}%
                        </div>
                    </div>
                    <div style="min-width: 100px;">
                        ${datesHTML}
                    </div>
                </div>
            `;
        } else {
            // Multiple attempts - Unified Grid Layout matching subject page
            const current = attempts[0];
            const previous = attempts[1];
            const diff = current.percentage - previous.percentage;
            const icon = diff > 0 ? '📈' : diff < 0 ? '📉' : '➖';
            const color = diff > 0 ? '#10B981' : diff < 0 ? '#EF4444' : '#94A3B8';
            const sign = diff > 0 ? '+' : '';

            card.innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <div style="font-size: 0.95rem; font-weight: bold; color: var(--primary-color); margin-bottom: 0.2rem;">
                        <i class="fas fa-book"></i> ${subjectName}
                    </div>
                    <h4 style="font-size: 0.8rem; margin: 0; color: var(--text-light); font-weight: normal; line-height: 1.4;">
                        ${hierarchyText}
                    </h4>
                </div>
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center;">
                    <!-- Previous Attempt -->
                    <div style="text-align: center; padding: 0.8rem; background: var(--bg-light); border-radius: var(--radius-sm);">
                        <div style="font-size: 0.7rem; color: var(--text-light); margin-bottom: 0.3rem;">المرة السابقة</div>
                        <div style="font-size: 1.5rem; font-weight: 900; color: var(--text-dark);">${previous.percentage}%</div>
                        <div style="font-size: 0.65rem; color: var(--text-light); margin-top: 0.2rem;">🕒 ${new Date(previous.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</div>
                    </div>

                    <!-- Trend Column -->
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem;">${icon}</div>
                        <div style="font-size: 0.8rem; font-weight: bold; color: ${color};">${sign}${diff}%</div>
                    </div>

                    <!-- Current Attempt -->
                    <div style="text-align: center; padding: 0.8rem; background: #f0fdf4; border-radius: var(--radius-sm); border: 2px solid var(--primary-color);">
                        <div style="font-size: 0.7rem; color: var(--text-light); margin-bottom: 0.3rem;">آخر محاولة</div>
                        <div style="font-size: 1.5rem; font-weight: 900; color: var(--primary-color);">${current.percentage}%</div>
                        <div style="font-size: 0.65rem; color: var(--text-light); margin-top: 0.2rem;">🆕 ${new Date(current.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</div>
                    </div>
                </div>
            `;
        }

        container.appendChild(card);
    });

    // Add "View All" link if there are more results
    if (latestAttempts.length > 5) {
        const viewAllDiv = document.createElement('div');
        viewAllDiv.style.cssText = 'text-align: center; margin-top: 1rem;';
        viewAllDiv.innerHTML = `
            <a href="#" class="btn btn-outline" style="font-size: 0.9rem;">
                عرض كل النتائج (${latestAttempts.length})
            </a>
        `;
        container.appendChild(viewAllDiv);
    }
}

// ==========================
// 12. Initialize
// ==========================

const protectedPages = ["dashboard.html", "subject.html", "leaderboard.html", "profile.html", "todo.html"];
let currentPageName = window.location.pathname.split("/").pop();

// Handle empty path (which usually loads dashboard.html)
if (!currentPageName || currentPageName === "") {
    currentPageName = "dashboard.html";
}

if (protectedPages.includes(currentPageName)) {
    loadUserProfile();
} else {
    checkAuth();
}
