/**
 * Timing Constants
 * Centralized timing values for consistency
 */

// Authentication & Presence
export const PRESENCE_UPDATE_INTERVAL = 120000; // 2 minutes in ms
export const CACHE_REVALIDATION_TIME = 300000; // 5 minutes in ms

// UI Feedback
export const TOAST_DURATION = 3000; // 3 seconds
export const SUCCESS_REDIRECT_DELAY = 1000; // 1 second
export const REGISTRATION_REDIRECT_DELAY = 2000; // 2 seconds
export const SAVE_INDICATOR_DURATION = 1500; // 1.5 seconds

// Exam & Squad
export const QUESTION_TIME_PER_QUESTION = 60; // 60 seconds per question
export const SQUAD_CHALLENGE_JOIN_WINDOW = 60 * 60 * 1000; // 1 hour in ms
export const SQUAD_CHALLENGE_GRACE_PERIOD = 45 * 60 * 1000; // 45 minutes in ms
export const EXAM_TIMER_WARNING_THRESHOLD = 120; // 2 minutes in seconds

// Animation & Effects
export const SCORE_ANIMATION_INTERVAL = 15; // ms between score increments
export const FADE_OUT_DURATION = 400; // ms
export const LOADING_TRANSITION_DELAY = 500; // ms

// Scroll & UI Interaction
export const SCROLL_TOP_THRESHOLD = 500; // pixels
export const DEBOUNCE_DELAY = 300; // ms for input debouncing
