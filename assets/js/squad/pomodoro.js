// Squad Pomodoro Module - Complete Implementation
import { supabase } from '../supabaseClient.js';
import { currentSquad, currentProfile, pomodoroInterval, pomodoroEnd, lastPomState } from './state.js';
import { setPomodoroInterval, setPomodoroEnd, setLastPomState } from './state.js';

/**
 * Load pomodoro state
 */
export async function loadPomodoro() {
    const { data: pom } = await supabase
        .from('squad_pomodoro')
        .select('*')
        .eq('squad_id', currentSquad.id)
        .maybeSingle();

    if (pom && pom.status === 'running') {
        // Semantic check: Only reset timer if the specific session record changed
        const currentStateKey = `${pom.start_time}_${pom.duration}_${pom.status}`;
        if (lastPomState === currentStateKey) return;

        setLastPomState(currentStateKey);
        const startTime = new Date(pom.start_time).getTime();
        const durationMs = (pom.duration || 25) * 60 * 1000;
        setPomodoroEnd(startTime + durationMs);

        if (pomodoroEnd > Date.now()) {
            startLocalTimer(pom);
        } else {
            setLastPomState(null);
            resetPomodoroUI();
        }
    } else {
        if (lastPomState !== null) {
            setLastPomState(null);
            resetPomodoroUI();
        }
    }
}

/**
 * Start local timer display
 */
function startLocalTimer(pomData) {
    if (pomodoroInterval) clearInterval(pomodoroInterval);

    const myId = currentProfile.id;
    const isAdmin = currentSquad.owner_id === myId || currentSquad.admins?.includes(myId);
    const isStarterOrOwner = pomData.started_by === myId || isAdmin;

    const stopBtn = document.getElementById('startPomodoroBtn');
    if (isStarterOrOwner) {
        stopBtn.disabled = false;
        stopBtn.textContent = 'إيقاف المذاكرة 🛑';
        stopBtn.onclick = endPomodoro;
    } else {
        stopBtn.disabled = true;
        stopBtn.textContent = 'جاري المذاكرة... 🔥';
    }

    const interval = setInterval(() => {
        const now = Date.now();
        const diff = pomodoroEnd - now;

        if (diff <= 0) {
            clearInterval(interval);
            resetPomodoroUI();
            return;
        }

        const mins = Math.floor(diff / (1000 * 60));
        const secs = Math.floor((diff / 1000) % 60);
        const timerEl = document.getElementById('pomodoroTimer');
        if (timerEl) {
            timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);

    setPomodoroInterval(interval);
}

/**
 * End pomodoro session
 */
async function endPomodoro() {
    await supabase.from('squad_pomodoro').update({ status: 'finished' }).eq('squad_id', currentSquad.id);
    resetPomodoroUI();
}

/**
 * Reset pomodoro UI
 */
function resetPomodoroUI() {
    if (pomodoroInterval) clearInterval(pomodoroInterval);
    document.getElementById('pomodoroTimer').textContent = '25:00';
    const btn = document.getElementById('startPomodoroBtn');
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = 'ابدأ المذاكرة 🔥';
    btn.onclick = startPomodoroFlow;
}

/**
 * Start pomodoro flow
 */
export async function startPomodoroFlow() {
    const { value: duration } = await Swal.fire({
        title: 'مدة المذاكرة؟ ⏱️',
        input: 'select',
        inputOptions: {
            '25': '25 دقيقة',
            '60': 'ساعة كاملة',
            '90': 'ساعة ونصف',
            '120': 'ساعتين',
            '180': '3 ساعات',
            '240': '4 ساعات'
        },
        inputPlaceholder: 'اختار الوقت...',
        showCancelButton: true
    });

    if (!duration) return;

    const { data: existing } = await supabase.from('squad_pomodoro').select('*').eq('squad_id', currentSquad.id).maybeSingle();
    const startTime = new Date().toISOString();

    const pomData = {
        status: 'running',
        start_time: startTime,
        duration: parseInt(duration),
        started_by: currentProfile.id
    };

    if (existing) {
        await supabase.from('squad_pomodoro').update(pomData).eq('squad_id', currentSquad.id);
    } else {
        await supabase.from('squad_pomodoro').insert({ ...pomData, squad_id: currentSquad.id });
    }

    await supabase.from('squad_chat_messages').insert({
        squad_id: currentSquad.id,
        sender_id: currentProfile.id,
        text: `مين جاي ${duration} دقيقة مذاكرة؟ 📚`
    });

    // Refresh UI immediately so the user doesn't have to wait for sync or manual refresh
    await loadPomodoro();
}

// Expose for global access
window.startPomodoroFlow = startPomodoroFlow;
