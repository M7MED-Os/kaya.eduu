import { supabase } from "./supabaseClient.js";
import { showToast } from "./utils.js";

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

    // 3. Populate Form Inputs (Hidden or editable)
    document.getElementById("fullname").value = fullName;

    // Background inputs (keep synced for logic if needed)
    const emailField = document.getElementById("email");
    const gradeField = document.getElementById("grade");
    const streamField = document.getElementById("stream");
    const termField = document.getElementById("term");

    if (emailField) emailField.value = email;
    if (gradeField) {
        gradeField.value = grade;
        handleGradeChange(grade);
    }
    if (termField) termField.value = term;
    if (streamField) streamField.value = stream;

    // 4. Populate Info Display (The plain text view)
    const infoRows = document.getElementById("infoRows");
    if (infoRows) {
        const gradeMap = { "1": "أولى ثانوي", "2": "تانية ثانوي", "3": "تالتة ثانوي" };
        const termMap = { "1": "الترم الأول", "2": "الترم الثاني" };
        const streamMap = { "science_bio": "علمي علوم", "science_math": "علمي رياضة", "literature": "أدبي" };

        let infoHtml = `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">
                <span style="color: #64748b;">البريد الإلكتروني:</span>
                <span style="font-weight: 500;">${email}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">
                <span style="color: #64748b;">السنة الدراسية:</span>
                <span style="font-weight: 500;">${gradeMap[grade] || grade || '-'}</span>
            </div>
        `;

        if (grade === "1" || grade === "2") {
            infoHtml += `
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">الترم:</span>
                <span style="font-weight: 500;">${termMap[term] || term || '-'}</span>
            </div>`;
        } else if (grade === "3") {
            infoHtml += `
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">الشعبة:</span>
                <span style="font-weight: 500;">${streamMap[stream] || stream || '-'}</span>
            </div>`;
        }
        infoRows.innerHTML = infoHtml;
    }

    // 5. Subscription Card Logic
    if (profile && profile.role !== 'admin') {
        const subStart = document.getElementById('subStart');
        const subEnd = document.getElementById('subEnd');
        const planName = document.getElementById('planName');
        const timeLeft = document.getElementById('timeLeft');

        if (subStart) subStart.textContent = profile.subscription_started_at ? new Date(profile.subscription_started_at).toLocaleString('ar-EG') : 'غير محدد';
        if (subEnd) subEnd.textContent = profile.subscription_ends_at ? new Date(profile.subscription_ends_at).toLocaleString('ar-EG') : 'غير محدد';
        if (planName) planName.textContent = profile.last_duration_text || 'خطة مخصصة';

        if (profile.subscription_ends_at && timeLeft) {
            const end = new Date(profile.subscription_ends_at);
            const now = new Date();
            const diff = end - now;

            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const mins = Math.floor((diff / (1000 * 60)) % 60);
                timeLeft.textContent = `${days} يوم و ${hours} ساعة و ${mins} دقيقة`;
            } else {
                timeLeft.textContent = 'منتهي';
                timeLeft.style.background = '#ef4444';
                timeLeft.style.color = 'white';
            }
        }
    } else {
        const card = document.getElementById('subscriptionCard');
        if (card) card.style.display = 'none';
    }

    // Special Admin UI override (Optional: could show a button to reveal fields)
    const adminBtn = document.getElementById("adminNavBtn");
    if (isAdmin) {
        console.log("Admin logged in. All background fields are synced.");
        const adminNotice = document.getElementById("adminNotice");
        if (adminNotice) adminNotice.innerHTML = "<i class='fas fa-info-circle'></i> أنت تمتلك صلاحيات أدمن. الحقول مخفية للتبسيط.";

        if (adminBtn) adminBtn.style.display = 'block';
    } else {
        if (adminBtn) adminBtn.remove();
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
                email: currentUser.email,
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
