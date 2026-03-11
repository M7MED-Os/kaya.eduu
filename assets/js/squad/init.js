// Squad Initialization Module
import { supabase } from '../supabaseClient.js';
import { getCache, setCache } from '../utils.js';
import { generateAvatar } from '../avatars.js';
import { createSquadLevelBadge, createSquadLevelProgress, getSquadLevelBorderStyle } from '../level-badge.js';
import { ACADEMIC_YEARS, DEPARTMENTS, getAcademicYearLabel, getDepartmentLabel, getTermLabel } from '../constants.js';
import {
    currentSquad, currentProfile, currentMemberRole, views,
    setCurrentSquad, setCurrentProfile, setCurrentMemberRole
} from './state.js';
import { showView } from './utils.js';
import { loadMembers } from './members.js';
import { loadTasks } from './tasks.js';
import { loadChat } from './chat.js';
import { loadPomodoro } from './pomodoro.js';
import { setupPresence } from './presence.js';
import { loadActiveChallenge } from './challenge.js';
import { subscriptionService, initSubscriptionService, showSubscriptionPopup } from '../subscription.js';

/**
 * Initialize Squad - Main entry point
 */
export async function initSquad() {
    showView('loading', views);

    // 1. Get User
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Get Profile - Use Cache
    let profile = getCache(`profile_${user.id}`);
    if (!profile) {
        const { data: fetchedProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
        profile = fetchedProfile;
        if (profile) setCache(`profile_${user.id}`, profile, 10);
    }
    setCurrentProfile(profile);


    // 3. Initialize subscription service
    await initSubscriptionService(profile);

    // 4. Check for Squad Membership - Use Cache (1 min short cache)
    let memberRecord = getCache(`squad_member_${user.id}`);
    if (!memberRecord) {
        const { data: records, error: memberError } = await supabase
            .from('squad_members')
            .select('squad_id, role, squads(*)')
            .eq('profile_id', user.id)
            .limit(1);

        if (memberError) console.error("Membership check error:", memberError);
        memberRecord = records && records.length > 0 ? records[0] : null;
        if (memberRecord) {
            setCache(`squad_member_${user.id}`, memberRecord, 1);
            setCurrentMemberRole(memberRecord.role);
        }
    } else {
        // From cache
        setCurrentMemberRole(memberRecord.role);
    }

    if (memberRecord && memberRecord.squads) {
        // AUTO-KICK CHECK: Remove user from squad if subscription expired and squads are premium-only
        if (!subscriptionService.canAccessFeature('squads')) {
            // User is in a squad but not premium, and squads are premium-only
            // Remove them from the squad (same as manual leave)
            await supabase
                .from('squad_members')
                .delete()
                .eq('profile_id', user.id);

            // Clear cache
            localStorage.removeItem(`squad_member_${user.id}`);

            // Show message and redirect to no-squad view
            Swal.fire({
                icon: 'info',
                title: 'خرجت من الشلة',
                text: 'اشتراكك خلص والشلل متاحة للمشتركين بس. اشترك عشان تخش مع صحابك تاني!',
                confirmButtonText: 'اشترك دلوقتي',
                confirmButtonColor: '#03A9F4',
                showCancelButton: true,
                cancelButtonText: 'ماشي'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'pending.html';
                }
            });

            showView('noSquad', views);
            return;
        }

        setCurrentSquad(memberRecord.squads);

        // Load members count immediately for accurate calculations
        const { data: squadMembers } = await supabase
            .from('squad_members')
            .select('profile_id')
            .eq('squad_id', currentSquad.id);

        currentSquad.members = squadMembers || [];

        await setupSquadUI();
        showView('mainSquad', views);
    } else {
        showView('noSquad', views);
    }
}

/**
 * Setup Squad UI - Initialize all UI components
 */
async function setupSquadUI() {
    // Get display labels using helper functions
    const displayGrade = getAcademicYearLabel(currentSquad.academic_year) || currentSquad.academic_year || 'سنة غير محددة';
    const displayDept = getDepartmentLabel(currentSquad.department) || currentSquad.department || '';
    const displayTerm = getTermLabel(currentSquad.current_term) || '';

    // Determine squad info display based on year
    let squadInfoText = displayGrade; // Default

    // For years 1-2, show term if available
    if (currentSquad.academic_year === 'first_year' || currentSquad.academic_year === 'second_year') {
        if (displayTerm) {
            squadInfoText = `${displayGrade} - ${displayTerm}`;
        }
    }
    // For years 3-4, show department if available
    else if (currentSquad.academic_year === 'third_year' || currentSquad.academic_year === 'fourth_year') {
        if (displayDept) {
            squadInfoText = `${displayGrade} - ${displayDept}`;
        }
    }

    // Update basic info
    document.getElementById('squadNameText').textContent = currentSquad.name;
    document.getElementById('squadInfo').textContent = squadInfoText;
    document.getElementById('squadPoints').textContent = `رصيد الشلة: ${currentSquad.points || 0}`;
    document.getElementById('squadMemberCount').textContent = `0 عضو`; // Will be updated by loadMembers
    document.getElementById('squadCode').textContent = currentSquad.id.split('-')[0].toUpperCase();


    // Update preview button link
    const previewBtn = document.getElementById('previewSquadBtn');
    if (previewBtn) {
        previewBtn.href = `squad-profile.html?id=${currentSquad.id}`;
    }

    // Update bio display
    const bioDisplay = document.querySelector('#squadBioDisplay .bio-text');
    if (bioDisplay) {
        if (currentSquad.bio) {
            bioDisplay.textContent = currentSquad.bio;
            bioDisplay.classList.remove('empty');
            bioDisplay.style.fontStyle = 'italic';
            bioDisplay.style.opacity = '1';
        } else {
            bioDisplay.textContent = 'مفيش بايو';
            bioDisplay.classList.add('empty');
            bioDisplay.style.fontStyle = 'normal';
            bioDisplay.style.opacity = '0.7';
        }
    }

    // Update Avatar and Level Badge
    const squadAvatarImg = document.getElementById('squadAvatar');
    const squadLevelBadgeContainer = document.getElementById('squadLevelBadge');

    if (squadAvatarImg) {
        const avatarUrl = currentSquad.avatar_url || generateAvatar(currentSquad.name, 'bottts');
        squadAvatarImg.src = avatarUrl;

        // Update border color based on level
        const style = getSquadLevelBorderStyle(currentSquad.points || 0, '4px');
        squadAvatarImg.style.borderColor = style.color;
    }

    if (squadLevelBadgeContainer && currentSquad.points !== undefined) {
        squadLevelBadgeContainer.innerHTML = createSquadLevelBadge(currentSquad.points, 'medium');
    }

    // Update level progress
    const levelProgressEl = document.getElementById('squadLevelProgressHeader');
    if (levelProgressEl) {
        const progressHTML = createSquadLevelProgress(currentSquad.points || 0);
        levelProgressEl.innerHTML = progressHTML;
    }

    // Load Sub-components
    loadMembers();
    loadTasks();
    loadChat();
    loadPomodoro();
    setupPresence();
    loadActiveChallenge();

    // Real-time subscription for challenge updates
    supabase
        .channel(`squad_challenge_${currentSquad.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'squad_chat_messages',
            filter: `squad_id=eq.${currentSquad.id}`
        }, () => {
            loadActiveChallenge();
        })
        .subscribe();

    // Check admin permissions
    const isAdmin = currentSquad.owner_id === currentProfile.id || currentMemberRole === 'admin' || currentProfile.role === 'admin';

    if (isAdmin) {
        // Show admin controls
        const endBtn = document.getElementById('endChallengeBtn');
        if (endBtn) endBtn.dataset.canEnd = 'true';

        const changeAvatarBtn = document.getElementById('changeSquadAvatarBtn');
        if (changeAvatarBtn) changeAvatarBtn.style.display = 'flex';

        const privacyBtn = document.getElementById('squadPrivacyBtn');
        if (privacyBtn) privacyBtn.style.display = 'flex';

        const editNameBtn = document.getElementById('editSquadNameBtn');
        if (editNameBtn) editNameBtn.style.display = 'inline-block';
    }

    // Display Squad Points
    const squadPointsEl = document.getElementById('squadPoints');
    if (squadPointsEl) {
        squadPointsEl.textContent = `${currentSquad.points || 0}`;
    }

    // Display Member Count
    const squadMemberCountEl = document.getElementById('squadMemberCount');
    if (squadMemberCountEl) {
        const memberCount = currentSquad.members?.length || 0;
        squadMemberCountEl.textContent = `${memberCount}`;
    }
}
