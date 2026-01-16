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

    // 3. Populate Form
    document.getElementById("fullname").value = fullName;
    document.getElementById("email").value = email;
    document.getElementById("grade").value = grade;

    // Trigger change to show/hide fields
    handleGradeChange(grade);

    // Set other values after fields are visible
    if (term) document.getElementById("term").value = term;
    if (stream) document.getElementById("stream").value = stream;
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
                id: currentUser.id, // Ensure ID is present for upsert
                full_name,
                grade,
                updated_at: new Date()
            };

            // Add conditional fields
            if (grade === "1" || grade === "2") {
                updates.term = term;
                updates.stream = null;
            } else if (grade === "3") {
                updates.term = null;
                updates.stream = stream;
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
