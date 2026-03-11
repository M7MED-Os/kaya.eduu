// ============================================
// Privacy Helper Functions
// ============================================
// دوال مساعدة لفحص إعدادات الخصوصية
// ============================================

import { supabase } from './supabaseClient.js';

/**
 * فحص إذا كان المستخدم الحالي عضو في نفس شلة المستخدم المستهدف
 * @param {string} targetUserId - ID المستخدم المستهدف
 * @param {string} currentUserId - ID المستخدم الحالي
 * @returns {Promise<boolean>}
 */
export async function isInSameSquad(targetUserId, currentUserId) {
    if (!targetUserId || !currentUserId) return false;
    if (targetUserId === currentUserId) return true; // نفس الشخص

    try {
        // جلب شلة المستخدم المستهدف
        const { data: targetMember } = await supabase
            .from('squad_members')
            .select('squad_id')
            .eq('profile_id', targetUserId)
            .single();

        if (!targetMember) return false;

        // فحص إذا كان المستخدم الحالي في نفس الشلة
        const { data: currentMember } = await supabase
            .from('squad_members')
            .select('squad_id')
            .eq('profile_id', currentUserId)
            .eq('squad_id', targetMember.squad_id)
            .single();

        return !!currentMember;
    } catch (err) {
        console.error('Error checking squad membership:', err);
        return false;
    }
}

/**
 * فحص إذا كان المستخدم الحالي عضو في الشلة
 * @param {string} squadId - ID الشلة
 * @param {string} currentUserId - ID المستخدم الحالي
 * @returns {Promise<boolean>}
 */
export async function isSquadMember(squadId, currentUserId) {
    if (!squadId || !currentUserId) return false;

    try {
        const { data } = await supabase
            .from('squad_members')
            .select('profile_id')
            .eq('squad_id', squadId)
            .eq('profile_id', currentUserId)
            .single();

        return !!data;
    } catch (err) {
        return false;
    }
}

/**
 * فحص إذا كان عنصر معين مرئي بناءً على إعدادات الخصوصية
 * @param {string} privacySetting - إعداد الخصوصية ('public', 'squad', 'private')
 * @param {boolean} isOwner - هل المستخدم الحالي هو صاحب البروفايل
 * @param {boolean} isSameSquad - هل المستخدم الحالي في نفس الشلة
 * @returns {boolean}
 */
export function isVisible(privacySetting, isOwner, isSameSquad) {
    if (isOwner) return true; // المالك يشوف كل حاجة

    switch (privacySetting) {
        case 'public':
            return true;
        case 'squad':
        case 'members': // للشلل
            return isSameSquad;
        case 'private':
            return false;
        default:
            return true; // default: public
    }
}

/**
 * إنشاء HTML لعنصر مخفي (locked)
 * @param {string} type - نوع العنصر (avatar, bio, stats, progress, members)
 * @returns {string} HTML
 */
export function createLockedElement(type) {
    const messages = {
        avatar: 'الصورة مخفية',
        bio: 'النبذة مخفية',
        stats: 'الإحصائيات مخفية',
        progress: 'التقدم مخفي',
        members: 'قائمة الأعضاء مخفية',
        squad: 'الشلة مخفية'
    };

    return `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            background: rgba(0,0,0,0.1);
            border-radius: 12px;
            color: rgba(255,255,255,0.6);
            text-align: center;
            min-height: 100px;
        ">
            <i class="fas fa-lock" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
            <span style="font-size: 0.9rem;">${messages[type] || 'محتوى مخفي'}</span>
        </div>
    `;
}

/**
 * إنشاء صورة أفاتار مخفية
 * @returns {string} HTML
 */
export function createLockedAvatar() {
    return `
        <div style="
            width: 130px;
            height: 130px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(0,0,0,0.2), rgba(0,0,0,0.3));
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 5px solid rgba(255,255,255,0.3);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        ">
            <i class="fas fa-lock" style="font-size: 2.5rem; color: rgba(255,255,255,0.5);"></i>
        </div>
    `;
}

/**
 * فحص إذا كان يجب إظهار الصورة الشخصية بناءً على إعدادات الخصوصية
 * @param {string} privacyAvatar - إعداد خصوصية الصورة ('public', 'squad', 'private')
 * @param {string} targetUserId - ID صاحب الصورة
 * @param {string} currentUserId - ID المستخدم الحالي
 * @param {string} targetSquadId - ID شلة صاحب الصورة (اختياري)
 * @param {string} currentSquadId - ID شلة المستخدم الحالي (اختياري)
 * @returns {boolean}
 */
export function shouldShowAvatar(privacyAvatar, targetUserId, currentUserId, targetSquadId = null, currentSquadId = null) {
    // Always show own avatar
    if (targetUserId === currentUserId) {
        return true;
    }

    // Check privacy setting
    if (!privacyAvatar || privacyAvatar === 'public') {
        return true;
    }

    if (privacyAvatar === 'squad') {
        // Squad-only: check if in same squad
        return targetSquadId && currentSquadId && targetSquadId === currentSquadId;
    }

    // Private: don't show
    return false;
}

/**
 * الخيارات المتاحة للخصوصية (للعرض في الواجهة)
 */
export const PRIVACY_OPTIONS = {
    profile: [
        { value: 'public', label: 'الكل', icon: 'fa-globe', description: 'يمكن لأي شخص رؤية هذا' },
        { value: 'squad', label: 'الشلة فقط', icon: 'fa-users', description: 'فقط أعضاء شلتك' },
        { value: 'private', label: 'أنا فقط', icon: 'fa-lock', description: 'أنت فقط' }
    ],
    squad: [
        { value: 'public', label: 'الكل', icon: 'fa-globe', description: 'يمكن لأي شخص رؤية هذا' },
        { value: 'members', label: 'الأعضاء فقط', icon: 'fa-users', description: 'فقط أعضاء الشلة' }
    ]
};
