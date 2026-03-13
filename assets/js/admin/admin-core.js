/**
 * Admin Core Module
 * Foundation module providing shared state, utilities, and navigation
 */

import { supabase } from "../supabaseClient.js";
import { showSuccessAlert, showErrorAlert, showWarningAlert, showDeleteConfirmDialog, showLoadingAlert } from "../utils/alerts.js";

// ==========================================
// SHARED STATE
// ==========================================

export let currentUser = null;
export let enrollmentChartInstance = null;
export let statusPieChartInstance = null;

export const currentContext = {
    grade: null,
    termOrStream: null,
    term: null,
    stream: null,
    isTerm: false,
    subject: null
};

// Question editor state (used by admin-questions.js)
export let editingQuestionId = null;
export let existingQuestionImages = {};

export function setEditingQuestionId(id) {
    editingQuestionId = id;
}

export function setExistingQuestionImages(images) {
    existingQuestionImages = images;
}

export function setCurrentUser(user) {
    currentUser = user;
}

export function setEnrollmentChartInstance(chart) {
    enrollmentChartInstance = chart;
}

export function setStatusPieChartInstance(chart) {
    statusPieChartInstance = chart;
}

// ==========================================
// UTILITIES
// ==========================================

export const triggerCelebration = (type = 'main') => {
    if (type === 'main') {
        confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.6 },
            gravity: 1,
            scalar: 1,
            colors: ['#03A9F4', '#FFC107', '#4CAF50', '#E91E63']
        });
    }
};

export function getContextLabel(grade, val) {
    const grades = {
        '1': 'سنة أولى',
        '1_1': 'سنة أولى (ترم 1)',
        '1_2': 'سنة أولى (ترم 2)',
        '2': 'سنة تانية',
        '2_1': 'سنة تانية (ترم 1)',
        '2_2': 'سنة تانية (ترم 2)',
        '3': 'سنة تالتة'
    };
    const vals = {
        'general': 'مواد أساسية/مشتركة',
        'science_gen': 'مواد علمي',
        'science_math': 'مواد علمي رياضة',
        'science_science': 'مواد علمي علوم',
        'science_all': 'مواد علمي مشترك',
        'non_graded': 'مواد خارج المجموع',
        'literary': 'مواد أدبي'
    };
    return `${grades[grade] || grade} | ${vals[val] || val}`;
}

// ==========================================
// NAVIGATION & VIEWS
// ==========================================

export function showView(viewId) {
    // Hide all views (both .view-section and .admin-view)
    document.querySelectorAll('.view-section, .admin-view').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });

    // Show the requested view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
        targetView.style.display = 'block';
    }
}

// ==========================================
// MODAL SYSTEM
// ==========================================

let activeModalCallback = null;

export function openModal({ title, body, onSave }) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;

    const footer = document.getElementById('modalFooter');
    footer.innerHTML = `
        <button class="btn btn-outline" onclick="window.closeModal()">إلغاء</button>
        <button class="btn btn-primary" id="modalSaveBtn">حفظ</button>
    `;

    activeModalCallback = onSave;
    document.getElementById('universalModal').classList.add('open');
}

export function closeModal() {
    document.getElementById('universalModal')?.classList.remove('open');
    activeModalCallback = null;
}

export function setupModalListeners() {
    document.getElementById('universalModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'modalSaveBtn' && activeModalCallback) {
            activeModalCallback();
        }
    });
}

// Make closeModal available globally for inline onclick handlers
window.closeModal = closeModal;

// ==========================================
// AUTHENTICATION
// ==========================================

export async function checkAdminAuth() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = 'login.html'; return false; }

        const { data: profile } = await supabase.from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'admin') {
            window.location.href = 'dashboard.html';
            return false;
        }

        setCurrentUser(user);
        document.getElementById('loading').style.display = 'none';
        return true;

    } catch (err) {
        console.error("Auth Fail", err);
        return false;
    }
}

// ==========================================
// INITIALIZATION
// ==========================================

export function initAdminCore() {
    setupModalListeners();

    // Responsive Sidebar Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.querySelector('.sidebar');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar?.classList.toggle('mobile-open');
        });
    }

    // Close button for sidebar
    const closeSidebar = document.getElementById('closeSidebar');
    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            sidebar?.classList.remove('mobile-open');
        });
    }

    // Close sidebar when clicking navigation items on mobile
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1553) {
                sidebar?.classList.remove('mobile-open');
            }
        });
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1553 &&
            sidebar?.classList.contains('mobile-open') &&
            !sidebar.contains(e.target) &&
            e.target !== mobileToggle) {
            sidebar.classList.remove('mobile-open');
        }
    });

    // Handle Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        };
    }
}

// Re-export utilities for convenience
export { supabase, showSuccessAlert, showErrorAlert, showWarningAlert, showDeleteConfirmDialog, showLoadingAlert };
