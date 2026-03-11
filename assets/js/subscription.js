/**
 * Subscription Service - Centralized Freemium Management
 * Handles all subscription checks, feature access, and content filtering
 */

import { supabase } from './supabaseClient.js';

class SubscriptionService {
    constructor() {
        this.userProfile = null;
        this.freemiumConfig = null;
        this.initialized = false;
        this.cache = {
            isPremium: null,
            config: null,
            timestamp: null
        };
    }

    /**
     * Initialize the service with user profile
     */
    async init(profile) {
        if (!profile) {
            console.warn('SubscriptionService: No profile provided');
            return false;
        }

        this.userProfile = profile;

        // Load freemium config
        await this.loadFreemiumConfig();

        this.initialized = true;
        return true;
    }

    async loadFreemiumConfig() {
        try {
            // Priority 1: Direct table select (most reliable if RLS allows)
            const { data, error } = await supabase
                .from('freemium_config')
                .select('*')
                .limit(1);

            if (!error && data && data.length > 0) {
                const config = data[0];
                this.freemiumConfig = {
                    squads_enabled: config.squads_config ?? config.squads_enabled ?? false,
                    tasks_enabled: config.tasks_config ?? config.tasks_enabled ?? false,
                    leaderboard_enabled: config.leaderboard_config ?? config.leaderboard_enabled ?? false,
                    curriculum_enabled: config.curriculum_config ?? config.curriculum_enabled ?? false,
                    mistakes_bank_enabled: config.mistakes_bank_config ?? config.mistakes_bank_enabled ?? false
                };
            } else {
                // Priority 2: Fallback to RPC
                const { data: rpcData, error: rpcError } = await supabase.rpc('get_freemium_config');

                if (!rpcError && rpcData && rpcData.length > 0) {
                    const config = rpcData[0];
                    this.freemiumConfig = {
                        squads_enabled: config.squads_config ?? config.squads_enabled ?? false,
                        tasks_enabled: config.tasks_config ?? config.tasks_enabled ?? false,
                        leaderboard_enabled: config.leaderboard_config ?? config.leaderboard_enabled ?? false,
                        curriculum_enabled: config.curriculum_config ?? config.curriculum_enabled ?? false,
                        mistakes_bank_enabled: config.mistakes_bank_config ?? config.mistakes_bank_enabled ?? false
                    };
                } else {
                    // Fail-safe Default: Locked (User rules apply: Premium or Free items only)
                    this.freemiumConfig = {
                        squads_enabled: false,
                        tasks_enabled: false,
                        leaderboard_enabled: false,
                        curriculum_enabled: false,
                        mistakes_bank_enabled: false
                    };
                }
            }

            // Cache config
            this.cache.config = this.freemiumConfig;
            this.cache.timestamp = Date.now();

        } catch (err) {
            console.error('Exception loading freemium config:', err);
            this.freemiumConfig = {
                squads_enabled: false,
                tasks_enabled: false,
                leaderboard_enabled: false,
                curriculum_enabled: false,
                mistakes_bank_enabled: false
            };
        }
    }

    /**
     * Check if user has active premium subscription
     * SIMPLIFIED: Just check is_active flag (expiry handled by database trigger)
     */
    isPremium() {
        if (!this.userProfile) return false;

        // 1. Check if user is admin (always premium)
        if (this.userProfile.role === 'admin') return true;

        // 2. Check is_active flag
        const isActive = this.userProfile.is_active === true;

        // 3. Local expiry check (as a backup to the DB flag)
        const now = new Date();
        const expiry = this.userProfile.subscription_ends_at ? new Date(this.userProfile.subscription_ends_at) : null;
        const isExpired = expiry && now > expiry;

        return isActive && !isExpired;
    }

    /**
     * Check if user can access a specific feature
     * @param {string} featureName - 'squads', 'tasks', 'leaderboard', or 'mistakes_bank'
     */
    canAccessFeature(featureName) {
        if (!this.freemiumConfig) return true; // Default allow if config not loaded

        const isPremium = this.isPremium();

        switch (featureName) {
            case 'squads':
                return this.freemiumConfig.squads_enabled || isPremium;
            case 'tasks':
                return this.freemiumConfig.tasks_enabled || isPremium;
            case 'leaderboard':
                return this.freemiumConfig.leaderboard_enabled || isPremium;
            case 'curriculum':
                return this.freemiumConfig.curriculum_enabled || isPremium;
            case 'mistakes_bank':
                return this.freemiumConfig.mistakes_bank_enabled || isPremium;
            default:
                return true;
        }
    }

    /**
     * Check if user can access a lesson's content
     * @param {object} lesson - Lesson object with is_free property
     */
    canAccessLessonContent(lesson) {
        if (!lesson) return false;
        // Content access depends ONLY on premium status or if the item is free
        return this.isPremium() || lesson.is_free === true;
    }

    /**
     * Check if user can access an exam
     * @param {object} exam - Exam object with is_free property
     */
    canAccessExam(exam) {
        if (!exam) return false;
        // Content access depends ONLY on premium status or if the item is free
        return this.isPremium() || exam.is_free === true;
    }

    /**
     * Fetch accessible lessons for a chapter (using RPC)
     */
    async fetchAccessibleLessons(chapterId) {
        try {
            const { data, error } = await supabase.rpc('get_accessible_lessons', {
                p_chapter_id: chapterId
            });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching accessible lessons:', err);
            return [];
        }
    }

    /**
     * Validate lesson access (server-side check)
     * @returns {object} { canAccess: boolean, lesson: object }
     */
    async validateLessonAccess(lessonId) {
        try {
            // SECURITY: Use the Secure RPC (Server-side source of truth)
            const { data, error } = await supabase.rpc('get_lesson_secure', {
                p_lesson_id: lessonId
            });

            if (error) throw error;

            if (!data || data.length === 0) {
                return { canAccess: false, lesson: null, error: 'Lesson not found' };
            }

            const lesson = data[0];
            return {
                canAccess: lesson.can_access, // Trust the database secure function
                lesson: lesson,
                error: null
            };
        } catch (err) {
            console.error('Error validating lesson access:', err);
            return { canAccess: false, lesson: null, error: err.message };
        }
    }

    /**
     * Validate exam access (server-side check)
     * @returns {object} { canAccess: boolean, exam: object }
     */
    async validateExamAccess(examId) {
        try {
            // SECURITY: Use the Secure RPC
            const { data, error } = await supabase.rpc('get_exam_secure', {
                p_exam_id: examId
            });

            if (error) {
                console.error('RPC error (get_exam_secure):', error);
                return { canAccess: false, exam: null, error: error.message };
            }

            if (!data || data.length === 0) {
                console.error('Exam not found:', examId);
                return { canAccess: false, exam: null, error: 'Exam not found' };
            }

            const exam = data[0];
            return {
                canAccess: exam.can_access,
                exam: exam,
                error: null
            };
        } catch (err) {
            console.error('Exception validating exam access:', err);
            return { canAccess: false, exam: null, error: err.message };
        }
    }

    /**
     * Fetch exam questions (with access check)
     */
    async fetchExamQuestions(examId) {
        try {
            const { data, error } = await supabase.rpc('get_exam_questions_secure', {
                p_exam_id: examId
            });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching exam questions:', err);
            return [];
        }
    }

    /**
     * Show simple subscription popup (no redirect)
     */
    showSubscriptionPopup() {
        return Swal.fire({
            title: 'المحتوى ده للمشتركين بس 🔒',
            text: 'اشترك عشان تقدر توصل لكل المحتوى',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'اشترك دلوقتي',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#03A9F4',
            cancelButtonColor: '#64748b',
            customClass: {
                popup: 'rtl-popup'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'pending.html';
            }
        });
    }

    /**
     * Show upgrade prompt modal
     */
    async showUpgradePrompt(contentType = 'content') {
        const messages = {
            lesson: {
                title: 'المحاضرة دي للمشتركين بس! 🔒',
                text: 'اشترك دلوقتي للوصول لجميع المحاضرات والامتحانات'
            },
            exam: {
                title: 'الامتحان ده للمشتركين بس! 🔒',
                text: 'اشترك دلوقتي لحل جميع الامتحانات وكسب النقاط'
            },
            feature: {
                title: 'للمشتركين بس! 🔒',
                text: 'اشترك دلوقتي للاستمتاع بجميع مميزات المنصة'
            },
            content: {
                title: 'محتوى مدفوع! 🔒',
                text: 'اشترك دلوقتي للوصول الكامل'
            }
        };

        const config = messages[contentType] || messages.content;

        return Swal.fire({
            title: config.title,
            text: config.text,
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#03A9F4',
            cancelButtonColor: '#64748b',
            confirmButtonText: '<i class="fas fa-crown"></i> اشترك دلوقتي',
            cancelButtonText: 'إلغاء',
            customClass: {
                popup: 'rtl-popup'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'pending.html';
            }
        });
    }

    /**
     * Get user's subscription status for display
     */
    getSubscriptionStatus() {
        if (!this.userProfile) {
            return {
                isPremium: false,
                status: 'غير مشترك',
                expiryDate: null,
                daysRemaining: null
            };
        }

        const isPremium = this.isPremium();
        const { subscription_ends_at } = this.userProfile;

        if (!isPremium) {
            return {
                isPremium: false,
                status: 'غير مشترك',
                expiryDate: null,
                daysRemaining: null
            };
        }

        if (!subscription_ends_at) {
            return {
                isPremium: true,
                status: 'مشترك (دائم)',
                expiryDate: null,
                daysRemaining: null
            };
        }

        const expiryDate = new Date(subscription_ends_at);
        const now = new Date();
        const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

        return {
            isPremium: true,
            status: 'مشترك',
            expiryDate: expiryDate,
            daysRemaining: daysRemaining
        };
    }
}

// Create singleton instance
const subscriptionService = new SubscriptionService();

// Export service and helper functions for backward compatibility
export { subscriptionService };

export async function initSubscriptionService(profile) {
    return await subscriptionService.init(profile);
}

export function isPremiumUser() {
    return subscriptionService.isPremium();
}

export function canAccessFeature(featureName) {
    return subscriptionService.canAccessFeature(featureName);
}

export function canAccessLectureContent(lesson) {
    return subscriptionService.canAccessLessonContent(lesson);
}

export function canAccessExam(lesson) {
    return subscriptionService.canAccessExam(lesson);
}

export async function showUpgradePrompt(contentType) {
    return await subscriptionService.showUpgradePrompt(contentType);
}

export function showSubscriptionPopup() {
    return subscriptionService.showSubscriptionPopup();
}
