// Squad Chat Module - Complete Implementation
import { supabase } from '../supabaseClient.js';
import { getSWR } from '../utils.js';
import { generateAvatar, calculateLevel, getLevelColor } from '../avatars.js';
import { shouldShowAvatar } from '../privacy.js';
import { currentSquad, currentProfile, currentMemberRole, userResults, examTimers, readQueue, readTimeout } from './state.js';
import { setUserResults } from './state.js';

/**
 * Load chat messages with results and challenges
 */
export async function loadChat() {
    // 1. Clear existing exam timers before reload
    Object.values(examTimers).forEach(t => clearInterval(t));
    Object.keys(examTimers).forEach(key => delete examTimers[key]);

    const box = document.getElementById('chatBox');
    if (!box) return;

    const cacheKey = `squad_chat_data_${currentSquad.id}`;

    getSWR(cacheKey, async () => {
        // Use the new RPC function (1 call instead of 3!)
        const { data, error } = await supabase.rpc('get_squad_chat_data', {
            p_squad_id: currentSquad.id,
            p_user_id: currentProfile.id
        });

        if (error) {
            console.error('Chat data load error:', error);
            return { results: [], challenges: [], msgs: [] };
        }

        // Parse the RPC response
        const freshMsgs = (data.messages || []).reverse();
        return {
            results: data.user_results || [],
            challenges: data.challenges || [],
            msgs: freshMsgs
        };
    }, 0.25, (data) => {
        setUserResults(data.results);
        window.currentChallenges = data.challenges;
        renderChat(data.msgs);

        // Manage visibility of Clear Chat button (Owner/Admin only)
        const isAdmin = currentSquad.owner_id === currentProfile.id || currentMemberRole === 'admin' || currentProfile.role === 'admin';
        const clearBtn = document.getElementById('clearChatBtn');
        if (clearBtn) clearBtn.style.display = isAdmin ? 'flex' : 'none';
    });
}

/**
 * Render chat skeletons (loading state)
 */
function renderChatSkeletons(box) {
    box.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px; width:100%;">
            <div class="skeleton pulse" style="width:70%; height:40px; border-radius:12px; border-top-left-radius:2px; align-self:flex-start;"></div>
            <div class="skeleton pulse" style="width:50%; height:40px; border-radius:12px; border-top-right-radius:2px; align-self:flex-end;"></div>
            <div class="skeleton pulse" style="width:60%; height:60px; border-radius:12px; border-top-left-radius:2px; align-self:flex-start;"></div>
            <div class="skeleton pulse" style="width:40%; height:40px; border-radius:12px; border-top-right-radius:2px; align-self:flex-end;"></div>
        </div>
    `;
}

/**
 * Render chat messages
 */
async function renderChat(msgs) {
    const box = document.getElementById('chatBox');
    if (!box) return;
    const myId = currentProfile.id;

    // Fetch read markers
    const msgIds = msgs.map(m => m.id);
    const { data: allReads } = await supabase.from('squad_message_reads').select('message_id, profile_id, profiles!profile_id(full_name)').in('message_id', msgIds);

    // Filter out CMD signals and SQUAD_EXAM messages from chat display
    const chatMsgs = msgs.filter(m => {
        // Hide CMD technical signals
        if (m.text?.startsWith('[CMD:')) return false;
        // Hide SQUAD_EXAM messages
        if (m.text?.match(/\[SQUAD_EXAM:([a-z0-9-]+):?([a-z0-9-]+)?\]/i)) return false;
        return true;
    });

    box.innerHTML = chatMsgs.map(m => {
        const time = new Date(m.created_at).toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // Check if I have already read this message
        const isReadByMe = allReads?.some(r => r.message_id === m.id && r.profile_id === myId);

        // Mark as read ONLY if not mine and I haven't read it yet
        if (m.sender_id !== myId && !isReadByMe) {
            markAsRead(m.id);
        }

        const readers = allReads?.filter(r => r.message_id === m.id && r.profile_id !== m.sender_id) || [];
        const isReadByOthers = readers.length > 0;
        const readerNames = readers.map(r => r.profiles.full_name.split(' ')[0]).join('، ');

        const readerNamesList = readers.map(r => r.profiles.full_name).join('<br>');
        const fullReaderNames = readerNamesList || 'لا يوجد أحد شاهدها بعد';

        const ticks = m.sender_id === myId ? `
            <div class="msg-seen-status ${isReadByOthers ? 'read' : 'sent'}" title="${isReadByOthers ? 'شوهد بواسطة: ' + readerNames : 'تم الإرسال'}">
                <i class="fas fa-check-double"></i>
            </div>
        ` : '';

        // Sender level and color (use RPC response format)
        const senderPoints = m.sender_points || 0;
        const level = calculateLevel(senderPoints);
        // If system message (no sender_id), use site's primary blue color for border
        const levelColor = m.sender_id ? getLevelColor(level) : '#03A9F4';

        // Privacy check for avatar using helper function
        const showAvatar = m.sender_id ? shouldShowAvatar(
            m.sender_privacy_avatar,
            m.sender_id,
            myId,
            currentSquad.id,
            currentSquad.id
        ) : false; // System messages don't show avatar (use fallback/favicon)

        const senderName = m.sender_name || 'M7MED';
        const defaultAvatar = m.sender_id ? generateAvatar(senderName, 'initials') : 'assets/images/favicon-48x48.png';
        const avatarUrl = (showAvatar && m.sender_avatar) ? m.sender_avatar : defaultAvatar;

        return `
            <div class="msg-wrapper ${m.sender_id === myId ? 'sent' : 'received'}">
                <div class="chat-avatar-container">
                    <img src="${avatarUrl}" class="chat-avatar" style="border-color: ${levelColor}; border-width: 2px; border-style: solid;" title="${senderName}">
                </div>
                <div class="msg ${m.sender_id === myId ? 'sent' : 'received'}" 
                     ${m.sender_id === myId ? `onclick="showReadBy('${fullReaderNames}')"` : ''} 
                     style="${m.sender_id === myId ? 'cursor:pointer;' : ''}">
                    <span class="msg-sender">${senderName}</span>
                    <div class="msg-content">
                        ${m.text}
                    </div>
                    <div class="msg-footer">
                        <span class="msg-time">${time}</span>
                        ${ticks}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

/**
 * Show who read the message
 */
window.showReadBy = (names) => {
    Swal.fire({
        title: '<div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0px;">مين شاف الرساله</div>',
        html: `<div style="text-align: right; direction: rtl; font-size: 0.9rem; margin-top: 10px; color: #64748b;">${names}</div>`,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#64748b',
        width: '280px',
        padding: '1rem',
        customClass: {
            title: 'swal-small-title',
            confirmButton: 'swal-small-btn'
        }
    });
};

/**
 * Mark message as read (batched)
 */
async function markAsRead(msgId) {
    if (!readQueue.includes(msgId)) {
        readQueue.push(msgId);
    }

    if (readTimeout) clearTimeout(readTimeout);

    const timeout = setTimeout(async () => {
        const batch = [...readQueue];
        readQueue.length = 0; // Clear array

        if (batch.length === 0) return;

        try {
            const updates = batch.map(id => ({
                message_id: id,
                profile_id: currentProfile.id
            }));

            await supabase.from('squad_message_reads').upsert(updates, { onConflict: 'message_id,profile_id' });
        } catch (e) {
            console.error("Batch read update failed", e);
        }
    }, 2000); // Wait 2 seconds of silence to batch
}

/**
 * Handle chat form submission
 */
export async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    const { error } = await supabase.from('squad_chat_messages').insert({
        squad_id: currentSquad.id,
        sender_id: currentProfile.id,
        text
    });

    if (error) {
        console.error("Msg send error:", error);
    } else {
        await loadChat(); // Immediate update after sending
    }
}

/**
 * Clear squad chat (Owner/Admin only)
 */
export async function clearSquadChat() {
    const { isConfirmed } = await Swal.fire({
        title: 'مسح الشات بالكامل؟',
        text: "سيتم حذف جميع رسائل الشات الحالية نهائياً من قاعدة البيانات!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، امسح الكل',
        cancelButtonText: 'تراجع'
    });

    if (!isConfirmed) return;

    try {
        const { error } = await supabase
            .from('squad_chat_messages')
            .delete()
            .eq('squad_id', currentSquad.id);

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'تم المسح',
            text: 'تم حذف محادثات الشلة بنجاح.',
            timer: 1500,
            showConfirmButton: false
        });

        loadChat();

    } catch (err) {
        console.error('Clear chat error:', err);
        Swal.fire('خطأ', 'فشل في مسح الشات: ' + err.message, 'error');
    }
}

// Global exposure
window.clearSquadChat = clearSquadChat;
