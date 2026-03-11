// ========================================
// UNIFIED SCHEMA CONSTANTS
// All values use new text-based schema
// ========================================

// Academic Years (unified - text only)
export const ACADEMIC_YEARS = {
    "first_year": "سنة أولى ثانوي",
    "second_year": "سنة تانية ثانوي",
    "third_year": "سنة تالتة ثانوي"
};

// Terms (unified - text only)
export const TERMS = {
    "first_term": "الترم الأول",
    "second_term": "الترم الثاني"
};

// Departments / Tracks (unified - text only)
export const DEPARTMENTS = {
    "general": "عام",
    "science_science": "علمي علوم",
    "science_math": "علمي رياضة",
    "literary": "أدبي"
};

// ========================================
// APP CONFIGURATION
// ========================================

export const APP_CONFIG = {
    CACHE_VERSION: 'v1.002', // Incremented for Phase 2 cleanup
    CACHE_TIME_PROFILE: 1, // 1 minute
    CACHE_TIME_STATS: 1,  // 1 minute for better sync
    CACHE_TIME_SUBJECTS: 1440, // 24 hours (static content)
    CACHE_TIME_SUBJECT_CONTENT: 60, // 1 hour
    CACHE_TIME_LECTURES: 1440, // 24 hours
    CACHE_TIME_ANNOUNCEMENTS: 3, // 3 minutes
    CACHE_TIME_QUESTIONS: 3, // 3 minutes
    CACHE_TIME_LEADERBOARD: 1, // 1 minute
    CACHE_TIME_EXAMS: 60, // 1 hour
    CACHE_TIME_APP_CONFIGS: 1440, // 24 hours
    ACTIVE_CHECK_INTERVAL: 60000,
};

// ========================================
// HELPER FUNCTIONS
// ========================================

// Get display name for academic year
export function getAcademicYearLabel(value) {
    return ACADEMIC_YEARS[value] || value;
}

// Get display name for term
export function getTermLabel(value) {
    return TERMS[value] || value;
}

// Get display name for department
export function getDepartmentLabel(value) {
    return DEPARTMENTS[value] || value;
}
