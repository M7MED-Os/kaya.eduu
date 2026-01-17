import { supabase } from "./supabaseClient.js";

// ==========================
// 1. Auth Check
// ==========================

let currentUser = null;

async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.href = "login.html";
        return null;
    }
    currentUser = session.user;
    return currentUser;
}

// ==========================
// 2. UI Helpers (Toast)
// ==========================
function showToast(message, type = "success") {
    let container = document.querySelector(".toast-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const iconClass = type === "success" ? "fa-check-circle" : "fa-exclamation-circle";
    toast.innerHTML = `<i class="fas ${iconClass}"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.4s ease forwards";
        toast.addEventListener("animationend", () => {
            toast.remove();
            if (container.children.length === 0) container.remove();
        });
    }, 3000);
}

// ==========================
// 3. Load Profile Logic
// ==========================

async function loadProfile() {
    if (!currentUser) return;

    // 1. Load from 'profiles' table first
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
        console.error("Error loading profile:", error);
    }

    // 2. Fallback to Auth Metadata if profile is missing
    const meta = currentUser.user_metadata || {};

    // Data to use
    const fullName = profile?.full_name || meta.full_name || "";
    const email = currentUser.email || "";
    const grade = profile?.grade || meta.grade || "";
    const term = profile?.term || meta.term || "";
    const stream = profile?.stream || meta.stream || "";

    // Check if Admin
    const isAdmin = meta.role === "admin" || meta.is_admin === true;

    // 3. Populate Form
    document.getElementById("fullname").value = fullName;
    document.getElementById("email").value = email;

    const gradeField = document.getElementById("grade");
    const streamField = document.getElementById("stream");
    const emailField = document.getElementById("email");
    const adminFields = document.getElementById("adminAcademicFields");
    const studentInfo = document.getElementById("studentAcademicInfo");
    const academicLabels = document.getElementById("academicLabels");

    // Permissions UI Logic
    if (isAdmin) {
        adminFields.style.display = "block";
        studentInfo.style.display = "none";

        emailField.disabled = false;
        emailField.style.background = "white";
        emailField.style.cursor = "text";

        gradeField.value = grade;
        handleGradeChange(grade);
        if (term) document.getElementById("term").value = term;
        if (stream) streamField.value = stream;

        // Ensure all options are enabled for admin
        Array.from(gradeField.options).forEach(opt => opt.disabled = false);
    } else {
        adminFields.style.display = "none";
        studentInfo.style.display = "block";

        // Map values to Arabic labels
        const gradeMap = { "1": "أولى ثانوي", "2": "تانية ثانوي", "3": "تالتة ثانوي" };
        const termMap = { "1": "الترم الأول", "2": "الترم الثاني" };
        const streamMap = { "science_bio": "علمي علوم", "science_math": "علمي رياضة", "literature": "أدبي" };

        let infoHtml = `<div><strong>السنة الدراسية:</strong> ${gradeMap[grade] || grade || '-'}</div>`;
        if (grade === "1" || grade === "2") {
            infoHtml += `<div><strong>الترم:</strong> ${termMap[term] || term || '-'}</div>`;
        } else if (grade === "3") {
            infoHtml += `<div><strong>الشعبة:</strong> ${streamMap[stream] || stream || '-'}</div>`;
        }
        academicLabels.innerHTML = infoHtml;
    }
}

// ==========================
// 4. Form Logic
// ==========================

function handleGradeChange(gradeVal) {
    const termGroup = document.getElementById("termGroup");
    const streamGroup = document.getElementById("streamGroup");

    // Reset displays
    termGroup.style.display = "none";
    streamGroup.style.display = "none";

    if (gradeVal === "1" || gradeVal === "2") {
        termGroup.style.display = "block";
    } else if (gradeVal === "3") {
        streamGroup.style.display = "block";
    }
}

const gradeSelect = document.getElementById("grade");
if (gradeSelect) {
    gradeSelect.addEventListener("change", (e) => handleGradeChange(e.target.value));
}

const profileForm = document.getElementById("profileForm");
if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = profileForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "جاري الحفظ...";

        const full_name = document.getElementById("fullname").value.trim();
        const grade = document.getElementById("grade").value;
        const term = document.getElementById("term").value;
        const stream = document.getElementById("stream").value;

        try {
            // Validation
            if (!full_name) throw new Error("الاسم مطلوب");
            if (!grade) throw new Error("السنة الدراسية مطلوبة");

            // Prepare Data
            const updates = {
                id: currentUser.id,
                full_name,
                updated_at: new Date()
            };

            // Double Check Admin Status before allowing sensitive field updates
            const meta = currentUser.user_metadata || {};
            const isAdmin = meta.role === "admin" || meta.is_admin === true;

            if (isAdmin) {
                // Admin can update everything
                if (grade === "1" || grade === "2") {
                    updates.grade = grade;
                    updates.term = term;
                    updates.stream = null;
                } else if (grade === "3") {
                    updates.grade = grade;
                    updates.term = null;
                    updates.stream = stream;
                }
            } else {
                // Student cannot change grade or stream - these fields are ignored or kept from original profile
                console.warn("Security Check: Student attempt to bypass field lock. Ignoring sensitive changes.");
            }

            // 1. Update 'profiles' table
            const { error: dbError } = await supabase
                .from('profiles')
                .upsert(updates);

            if (dbError) throw dbError;

            // 2. Update Auth Metadata (Best effort, keeps session in sync)
            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    full_name,
                    grade,
                    term: updates.term,
                    stream: updates.stream
                }
            });

            if (authError) console.warn("Auth metadata update failed:", authError);

            showToast("تم تحديث البيانات بنجاح", "success");

            // Optional: Redirect to dashboard after short delay
            setTimeout(() => {
                // window.location.href = "dashboard.html"; 
            }, 1000);

        } catch (error) {
            console.error("Update error:", error);
            showToast(error.message || "حدث خطأ أثناء الحفظ", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "حفظ التعديلات";
        }
    });
}

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "login.html";
    });
}

// Initialize
async function init() {
    await checkAuth();
    await loadProfile();
}

init();
