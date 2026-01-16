import { supabase } from "./supabaseClient.js";

// ==========================
// 1. Auth State Management
// ==========================

// Check if user is logged in on protected pages
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        // Not logged in, redirect to login
        if (window.location.pathname.includes("dashboard")) {
            window.location.href = "login.html";
        }
        return null;
    }

    // User is logged in
    // If on auth pages (login/register), redirect to dashboard
    const authPages = ["login.html", "register.html"];
    const currentPage = window.location.pathname.split("/").pop();
    if (authPages.includes(currentPage)) {
        window.location.href = "dashboard.html";
    }

    return session.user;
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
// 7. Forgot Password Form
// ==========================

const forgotPasswordForm = document.getElementById("forgotPasswordForm");
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email_input = document.getElementById("email");
        const email = email_input.value.trim();

        if (!email) {
            showInputError(email_input, "اكتب إيميلك");
            return;
        }

        const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "جاري الإرسال...";

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`,
            });

            if (error) throw error;

            showToast("تم إرسال رابط استعادة كلمة السر لإيميلك!", "success");
            email_input.value = "";
        } catch (error) {
            console.error("Password reset error:", error);
            showToast(error.message || "حدث خطأ", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "إرسال رابط الاستعادة";
        }
    });
}

// ==========================
// 8. Reset Password Form
// ==========================

const resetPasswordForm = document.getElementById("resetPasswordForm");
if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const password_input = document.getElementById("new_password");
        const password = password_input.value;

        if (!password) {
            showInputError(password_input, "اكتب كلمة السر الجديدة");
            return;
        } else if (password.length < 6) {
            showInputError(password_input, "كلمة السر لازم تكون 6 حروف على الأقل");
            return;
        }

        const submitBtn = resetPasswordForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "جاري التحديث...";

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            showToast("تم تغيير كلمة السر بنجاح!", "success");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);
        } catch (error) {
            console.error("Password update error:", error);
            showToast(error.message || "حدث خطأ", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "تحديث كلمة السر";
        }
    });
}

// ==========================
// 9. Dashboard - Load User Profile
// ==========================

async function loadUserProfile() {
    const user = await checkAuth();
    if (!user) return;

    try {
        const userMetadata = user.user_metadata;
        const fullName = userMetadata?.full_name || "الطالب";

        // Render subjects based on metadata
        renderSubjects(userMetadata);

        // Load user results
        await loadUserResults(user.id);

        // Try to fetch from profiles table
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Profile Fetch Error:", error);
        }

        if (!profile) {
            // Profile doesn't exist, create it
            const { error: insertError } = await supabase.from("profiles").insert({
                id: user.id,
                full_name: fullName,
                grade: userMetadata?.grade || null,
                term: userMetadata?.term || null,
                stream: userMetadata?.stream || null,
            });

            if (insertError) {
                console.error("Profile Insert Error:", insertError);
                // Even if insert fails, we try to display what we have from metadata
                updateNameUI(fullName);
            } else {
                updateNameUI(fullName);
            }
        } else {
            // Profile exists, display it normally
            updateNameUI(profile.full_name);

            // Check if user is admin and show admin button
            if (profile.role === 'admin') {
                const adminBtn = document.getElementById('adminNavBtn');
                if (adminBtn) adminBtn.style.display = 'block';
            }
        }

    } catch (err) {
        console.error("Profile Fetch Error:", err);
    } finally {
        const loadingEl = document.getElementById("loading");
        if (loadingEl) {
            loadingEl.style.opacity = "0";
            setTimeout(() => loadingEl.remove(), 500);
        }
    }
}

// Helper to keep UI update logic DRY
function updateNameUI(name) {
    const firstName = name.split(" ")[0];
    const studentNameEl = document.getElementById("studentName");
    const navUserNameEl = document.getElementById("navUserName");

    if (studentNameEl) studentNameEl.textContent = firstName;
    if (navUserNameEl) navUserNameEl.textContent = name;
}

// ==========================
// 10. Dynamic Subject Rendering (Database-Driven)
// ==========================

// Cache for subjects to avoid repeated queries
let subjectsCache = null;

async function loadSubjectsFromDB() {
    if (subjectsCache) return subjectsCache;

    const { data: subjects, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

    if (error) {
        console.error('Error loading subjects:', error);
        return [];
    }

    subjectsCache = subjects;
    return subjects;
}

async function renderSubjects(userMetadata) {
    const grid = document.getElementById("subjectsGrid");
    if (!grid) return;

    grid.innerHTML = ""; // Clear content

    const grade = userMetadata?.grade; // "1", "2", "3"
    const stream = userMetadata?.stream; // "science_bio", ...
    const term = userMetadata?.term; // "1", "2"

    // Load subjects from database
    const allSubjects = await loadSubjectsFromDB();

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

async function loadUserResults(userId) {
    try {
        // Fetch all results with exam details
        const { data: results, error } = await supabase
            .from('results')
            .select(`
                *,
                exams (
                    title,
                    subject_id
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!results || results.length === 0) {
            // No results yet, hide section
            return;
        }

        // Show results section
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) resultsSection.style.display = 'block';

        // Calculate stats
        const totalExams = new Set(results.map(r => r.exam_id)).size;
        const avgScore = Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length);
        const bestScore = Math.max(...results.map(r => r.percentage));

        // Render stats
        renderResultsStats(totalExams, avgScore, bestScore);

        // Group by exam_id and get first + last
        const examGroups = {};
        results.forEach(result => {
            if (!examGroups[result.exam_id]) {
                examGroups[result.exam_id] = [];
            }
            examGroups[result.exam_id].push(result);
        });

        // Render results
        renderResultsList(examGroups);

    } catch (err) {
        console.error("Error loading results:", err);
    }
}

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
        const examTitle = result.exams?.title || 'امتحان';
        const subjectId = result.exams?.subject_id || '';
        const subjectName = subjectsMap[subjectId]?.name_ar || 'مادة';

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = 'margin-bottom: 1rem; padding: 1.2rem; border-left: 4px solid var(--primary-color);';

        const percentageColor = result.percentage >= 85 ? '#10B981' : result.percentage >= 50 ? 'var(--secondary-color)' : '#EF4444';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">
                        <i class="fas fa-book"></i> ${subjectName}
                    </div>
                    <h4 style="font-size: 1.1rem; margin: 0; color: var(--text-dark);">
                        ${examTitle}
                    </h4>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 900; color: ${percentageColor};">
                        ${result.percentage}%
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-light);">
                        ${result.score} من ${result.total_questions}
                    </div>
                </div>
                <div style="text-align: left; min-width: 100px;">
                    <div style="font-size: 0.8rem; color: var(--text-light);">
                        <i class="fas fa-calendar"></i> ${new Date(result.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.2rem;">
                        ${new Date(result.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>
        `;

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

if (window.location.pathname.includes("dashboard")) {
    loadUserProfile();
} else {
    checkAuth();
}
