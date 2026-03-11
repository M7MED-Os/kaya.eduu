// Squad Members Module - EXACT COPY from original squad.js
import { supabase } from '../supabaseClient.js';
import { getSWR } from '../utils.js';
import { currentSquad, currentProfile, onlineUsersSet } from './state.js';
import { generateAvatar, calculateLevel, getLevelColor } from '../avatars.js';
import { createLevelBadge } from '../level-badge.js';
import { shouldShowAvatar } from '../privacy.js';

/**
 * Time Ago Helper - EXACT COPY
 */
function timeAgo(dateString) {
    if (!dateString) return 'غير معروف';
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return 'منذ لحظات';

    const minutes = Math.floor(diffSeconds / 60);
    if (minutes < 60) return `منذ ${minutes} دقيقة`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;

    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
}

/**
 * Load squad members - EXACT COPY
 */
export async function loadMembers() {
    const cacheKey = `squad_members_${currentSquad.id}`;

    getSWR(cacheKey, async () => {
        const { data } = await supabase
            .from('squad_members')
            .select('profile_id, role, profiles(full_name, points, updated_at, avatar_url, privacy_avatar)')
            .eq('squad_id', currentSquad.id);
        return data;
    }, 1, (members) => {
        renderMembersUI(members);
    });
}

/**
 * Render members UI - EXACT COPY
 */
function renderMembersUI(members) {
    if (!members) return;

    // Update currentSquad.members for accurate calculations
    currentSquad.members = members;

    // Sort: Online first, then by updated_at descending
    members.sort((a, b) => {
        const aOnline = onlineUsersSet.has(a.profile_id);
        const bOnline = onlineUsersSet.has(b.profile_id);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return new Date(b.profiles.updated_at || 0) - new Date(a.profiles.updated_at || 0);
    });

    const list = document.getElementById('memberList');
    document.getElementById('squadMemberCount').textContent = `${members.length}`;

    const isOwner = currentSquad.owner_id === currentProfile.id;

    list.innerHTML = members.map(m => {
        const isOnline = onlineUsersSet.has(m.profile_id);
        let actions = '';

        if (isOwner && m.profile_id !== currentProfile.id) {
            actions = `
                <div class="member-actions" style="margin-right:auto; display:flex; gap:5px;">
                    <i class="fas fa-user-shield" title="نقل الإدارة" onclick="transferOwnership('${m.profile_id}')" style="color:#0ea5e9; cursor:pointer;"></i>
                    <i class="fas fa-user-minus" title="طرد" onclick="kickMember('${m.profile_id}')" style="color:#ef4444; cursor:pointer;"></i>
                </div>
            `;
        } else if (m.profile_id === currentSquad.owner_id || m.role === 'admin') {
            const roleLabel = m.profile_id === currentSquad.owner_id ? 'مالك الشلة ⭐' : 'مسؤول الشلة 🛡️';
            const roleColor = m.profile_id === currentSquad.owner_id ? '#f59e0b' : '#03A9F4';
            actions = `<span style="font-size:0.6rem; color:${roleColor}; margin-right:auto; font-weight:700;">${roleLabel}</span>`;
        } else if (m.profile_id === currentProfile.id) {
            // User can leave if they are not the owner
            actions = `
                <div class="member-actions" style="margin-right:auto;">
                    <i class="fas fa-sign-out-alt" title="خروج من الشلة" onclick="leaveSquad()" style="color:#ef4444; cursor:pointer; font-size: 1.1rem;"></i>
                </div>
            `;
        }

        let activeText = isOnline ? 'نشط الآن' : (m.profiles.updated_at ? timeAgo(m.profiles.updated_at) : 'غير نَشِط');

        // Avatar and level with privacy check
        const level = calculateLevel(m.profiles.points || 0);
        const levelColor = getLevelColor(level);
        const levelBadgeHTML = createLevelBadge(m.profiles.points || 0, 'xsmall');

        // Privacy check for avatar using helper function
        const showAvatar = shouldShowAvatar(
            m.profiles.privacy_avatar,
            m.profile_id,
            currentProfile.id,
            currentSquad.id, // All members are in the same squad
            currentSquad.id
        );

        const avatarUrl = m.profiles.avatar_url || generateAvatar(m.profiles.full_name, 'initials');
        const avatarHTML = showAvatar
            ? `<img src="${avatarUrl}" alt="${m.profiles.full_name}" style="
                width: 45px;
                height: 45px;
                border-radius: 50%;
                object-fit: cover;
                border: 3px solid ${levelColor};
                box-shadow: 0 4px 12px ${levelColor}40;
            ">`
            : `<div style="
                width: 45px;
                height: 45px;
                border-radius: 50%;
                background: #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid ${levelColor};
            "><i class="fas fa-lock" style="color: #94a3b8; font-size: 1.1rem;"></i></div>`;

        return `
            <div class="member-item" data-userid="${m.profile_id}" style="display:flex; align-items:center; gap:12px;">
                <div class="status-dot ${isOnline ? 'online' : ''}"></div>
                <a href="student-profile.html?id=${m.profile_id}" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 12px; flex: 1;">
                    <div style="position: relative; display: inline-block;">
                        ${avatarHTML}
                        <div style="position: absolute; bottom: -2px; left: -2px; z-index: 10; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
                            ${levelBadgeHTML}
                        </div>
                    </div>
                    <div style="flex:1">
                        <div style="font-weight:700; font-size:0.9rem;">${m.profiles.full_name}</div>
                        <div style="font-size:0.75rem; color:#64748b; display: flex; gap: 10px;">
                            <span>${m.profiles.points} نقطة</span>
                            <span class="active-status" style="font-size: 0.7rem; color: ${isOnline ? '#10b981' : '#94a3b8'};">
                                • ${activeText}
                            </span>
                        </div>
                    </div>
                </a>
                ${actions}
            </div>
        `;
    }).join('');
}

// Auto-refresh members status every minute to update "Time Ago"
setInterval(loadMembers, 60000);

/**
 * Kick member - EXACT COPY
 */
window.kickMember = async (userId) => {
    const { isConfirmed } = await Swal.fire({
        title: 'طرد العضو؟',
        text: 'متأكد إنك عاوز تشيل الطالب ده من الشلة؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444'
    });
    if (isConfirmed) {
        await supabase.from('squad_members').delete().eq('squad_id', currentSquad.id).eq('profile_id', userId);
        loadMembers();
    }
};

/**
 * Transfer ownership - EXACT COPY
 */
window.transferOwnership = async (userId) => {
    const { isConfirmed } = await Swal.fire({
        title: 'نقل الإدارة؟',
        text: 'هتنقل إدارة الشلة للطالب ده، وهتفقد صلاحيات الأونر.',
        icon: 'warning',
        showCancelButton: true
    });
    if (isConfirmed) {
        try {
            Swal.fire({
                title: 'جاري نقل الإدارة...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            // 1. Call secure RPC to handle transfer (bypasses RLS limits)
            const { error: rpcError } = await supabase.rpc('transfer_squad_ownership', {
                p_squad_id: currentSquad.id,
                p_new_owner_id: userId
            });

            if (rpcError) throw rpcError;

            // Clear squad member cache for both users
            localStorage.removeItem(`squad_member_${currentProfile.id}`);
            localStorage.removeItem(`squad_member_${userId}`);

            Swal.fire({
                icon: 'success',
                title: 'تم النقل!',
                text: 'تم نقل إدارة الشلة بنجاح 🎉',
                timer: 2000,
                showConfirmButton: false
            });

            setTimeout(() => {
                location.reload();
            }, 1000);

        } catch (err) {
            console.error('Error transferring ownership:', err);
            Swal.fire('خطأ', 'فشل نقل الإدارة: ' + (err.message || 'حدث خطأ غير متوقع'), 'error');
        }
    }
};
