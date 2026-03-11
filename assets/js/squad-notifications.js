import { supabase } from "./supabaseClient.js";

document.addEventListener('DOMContentLoaded', async () => {
    initSquadNotifications();
});

async function initSquadNotifications() {
    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2. Check Squad
    const { data: records } = await supabase
        .from('squad_members')
        .select('squad_id')
        .eq('profile_id', user.id)
        .limit(1);

    const membership = records && records.length > 0 ? records[0] : null;

    if (!membership) return;

    const squadId = membership.squad_id;

    // 3. Listen for Squad Events
    supabase.channel('squad_global_events')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'squad_chat_messages',
            filter: `squad_id=eq.${squadId}`
        }, payload => {
            if (payload.new.sender_id !== user.id && !window.location.href.includes('squad.html')) {
                showSquadAlert('رسالة جديدة من الشلة!', payload.new.text, 'squad.html');
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'squad_pomodoro',
            filter: `squad_id=eq.${squadId}`
        }, payload => {
            if (payload.new && payload.new.status === 'running' && payload.new.started_by !== user.id) {
                showSquadAlert('مذاكرة جماعية! 🔥', 'واحد من شلتك بدأ يذاكر دلوقتي.. انضم ليه؟', 'squad.html');
            }
        })
        .subscribe();
}



function showSquadAlert(title, text, link) {
    Swal.fire({
        title: title,
        text: text,
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: true,
        confirmButtonText: 'ذهاب',
        timer: 10000,
        timerProgressBar: true
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = link;
        }
    });
}
