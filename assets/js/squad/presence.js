// Squad Realtime Presence Module - EXACT COPY from original squad.js
import { supabase } from '../supabaseClient.js';
import { currentSquad, currentProfile, presenceChannel, setPresenceChannel, setOnlineUsersSet } from './state.js';
import { loadMembers } from './members.js';

/**
 * Setup realtime presence tracking - EXACT COPY
 */
export function setupPresence() {
    if (presenceChannel) supabase.removeChannel(presenceChannel);

    const channel = supabase.channel(`squad_presence_${currentSquad.id}`);
    channel
        .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            updateMembersStatusUI(state);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({
                    user_id: currentProfile.id,
                    online_at: new Date().toISOString(),
                });
                // Update DB for "Last Active" persistence
                await supabase.from('profiles').update({ updated_at: new Date().toISOString() }).eq('id', currentProfile.id);
            }
        });

    setPresenceChannel(channel);
}

/**
 * Update members status UI based on presence - EXACT COPY
 */
function updateMembersStatusUI(presenceState) {
    const onlineUserIds = Object.values(presenceState).flat().map(p => p.user_id);
    setOnlineUsersSet(new Set(onlineUserIds));

    // Refresh list to update UI text based on new online status
    loadMembers();
}
