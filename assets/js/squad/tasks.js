// Squad Tasks Module - Complete Implementation
import { supabase } from '../supabaseClient.js';
import { getSWR } from '../utils.js';
import { currentSquad, currentProfile } from './state.js';

/**
 * Load squad tasks with completions
 */
export async function loadTasks() {
    const cacheKey = `squad_tasks_${currentSquad.id}`;

    getSWR(cacheKey, async () => {
        const { data } = await supabase
            .from('squad_tasks')
            .select('*, squad_task_completions(profile_id, profiles(full_name))')
            .eq('squad_id', currentSquad.id)
            .order('created_at', { ascending: true });
        return data;
    }, 5, (tasks) => {
        // Pre-process tasks for local individual state
        tasks.forEach(t => {
            t.is_done_by_me = t.squad_task_completions.some(c => c.profile_id === currentProfile.id);
            t.others_who_done = t.squad_task_completions.filter(c => c.profile_id !== currentProfile.id);
        });

        const mainTasks = tasks.filter(t => !t.parent_id);
        const subTasks = tasks.filter(t => t.parent_id);

        updateProgressBar(tasks);
        renderTasks(mainTasks, subTasks);
    });
}

/**
 * Update progress bar based on task completion
 */
function updateProgressBar(tasks) {
    const mainTasks = tasks.filter(t => !t.parent_id);
    if (!mainTasks || mainTasks.length === 0) {
        document.getElementById('squadProgressBar').style.width = '0%';
        document.getElementById('squadProgressPercent').textContent = '0%';
        return;
    }

    let totalProgress = 0;
    const weightPerMain = 100 / mainTasks.length;

    mainTasks.forEach(mt => {
        const subtasks = tasks.filter(st => st.parent_id === mt.id);
        if (subtasks.length === 0) {
            // No subtasks, count the main task directly
            if (mt.is_done_by_me) totalProgress += weightPerMain;
        } else {
            // Has subtasks, calculate based on subtasks only
            const doneSubs = subtasks.filter(st => st.is_done_by_me).length;
            totalProgress += (doneSubs / subtasks.length) * weightPerMain;
        }
    });

    const finalPercent = Math.min(100, Math.round(totalProgress));
    document.getElementById('squadProgressBar').style.width = `${finalPercent}%`;
    document.getElementById('squadProgressPercent').textContent = `${finalPercent}%`;

    // Massive Celebration trigger when reaching 100%
    if (finalPercent === 100) {
        const lastCelebration = sessionStorage.getItem('squad_100_celebration');
        if (lastCelebration !== 'true') {
            triggerCelebration('massive');
            sessionStorage.setItem('squad_100_celebration', 'true');
        }
    } else {
        sessionStorage.removeItem('squad_100_celebration');
    }
}

/**
 * Trigger celebration animations
 */
const triggerCelebration = (type) => {
    if (type === 'massive') {
        // Massive Celebration (Side Bursts)
        var duration = 5 * 1000;
        var end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 7, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#03A9F4', '#10b981'] });
            confetti({ particleCount: 7, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#03A9F4', '#10b981'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    } else if (type === 'main') {
        // Main Task Celebration
        confetti({
            particleCount: 300,
            spread: 120,
            origin: { y: 0.6 },
            gravity: 1,
            scalar: 1.4,
            ticks: 100,
            colors: ['#03A9F4', '#FFC107', '#4CAF50', '#E91E63', '#9C27B0']
        });
    } else {
        // Subtask Celebration
        confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
            scalar: 1.1,
            colors: ['#03A9F4', '#64B5F6']
        });
    }
};

/**
 * Render tasks UI
 */
function renderTasks(mainTasks, subTasks) {
    const list = document.getElementById('squadTaskList');
    if (!mainTasks || mainTasks.length === 0) {
        list.innerHTML = `<div class="text-center" style="color: #94a3b8; padding: 1rem;">مفيش أهداف لسة.. حط هدف لشلتك!</div>`;
        return;
    }

    const isOwner = currentSquad.owner_id === currentProfile.id;

    list.innerHTML = mainTasks.map(t => {
        const children = subTasks.filter(st => st.parent_id === t.id);

        const renderOthers = (others) => {
            if (!others || others.length === 0) return '';
            const names = others.map(o => {
                const parts = o.profiles.full_name.split(' ');
                return parts.slice(0, 2).join(' '); // Show first two names
            });
            return `<div style="font-size:0.6rem; color:#94a3b8; margin-right:8px;"><i class="fas fa-check-double"></i> أنجزها: ${names.join('، ')}</div>`;
        };

        const childrenHTML = children.map(st => `
            <div class="task-group sub-task" style="margin-right: 35px;">
                <div class="todo-item" style="background: #fff; border: 1px solid #f1f5f9; padding: 6px 10px; font-size:0.85rem; display:flex; align-items:center;">
                    <input type="checkbox" class="todo-checkbox" ${st.is_done_by_me ? 'checked' : ''} onchange="toggleSquadTask('${st.id}', this.checked, false)">
                    <span class="todo-text ${st.is_done_by_me ? 'done' : ''}">${st.title}</span>
                    <div style="display:flex; gap:5px; align-items:center; margin-right:auto;">
                        <i class="fas fa-edit" title="تعديل" onclick="editSquadTask('${st.id}', '${st.title}')" style="color:#94a3b8; cursor:pointer; font-size:0.75rem;"></i>
                        <i class="fas fa-trash-alt delete-btn" onclick="deleteSquadTask('${st.id}')" style="font-size:0.7rem;"></i>
                    </div>
                </div>
                ${renderOthers(st.others_who_done)}
            </div>
        `).join('');

        return `
            <div class="task-group" style="margin-bottom: 20px;">
                <div class="todo-item" style="background:#f8fafc; border: 1px solid #e2e8f0; display:flex; align-items:center;">
                    <input type="checkbox" class="todo-checkbox" ${t.is_done_by_me ? 'checked' : ''} onchange="toggleSquadTask('${t.id}', this.checked, true)">
                    <span class="todo-text ${t.is_done_by_me ? 'done' : ''}">${t.title}</span>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <i class="fas fa-plus-circle" title="مهمة فرعية" onclick="addSquadTask('${t.id}')" style="color:#10b981; cursor:pointer;"></i>
                        <i class="fas fa-edit" title="تعديل" onclick="editSquadTask('${t.id}', '${t.title}')" style="color:#64748b; cursor:pointer;"></i>
                        <i class="fas fa-trash delete-btn" onclick="deleteSquadTask('${t.id}')"></i>
                    </div>
                </div>
                ${renderOthers(t.others_who_done)}
                ${childrenHTML}
            </div>
        `;
    }).join('');
}

/**
 * Add new task
 */
window.addSquadTask = async (parentId = null) => {
    const { value: title } = await Swal.fire({
        title: parentId ? 'اكتب ال task الفرعية' : 'اكتب ال task',
        input: 'text',
        showCancelButton: true
    });

    if (title) {
        await supabase.from('squad_tasks').insert({
            squad_id: currentSquad.id,
            title,
            created_by: currentProfile.id,
            parent_id: parentId
        });
        loadTasks();
    }
};

/**
 * Edit task
 */
window.editSquadTask = async (id, oldTitle) => {
    const { value: title } = await Swal.fire({
        title: 'تعديل المهمة',
        input: 'text',
        inputValue: oldTitle,
        showCancelButton: true
    });

    if (title && title !== oldTitle) {
        await supabase.from('squad_tasks').update({ title }).eq('id', id);
        loadTasks();
    }
};

/**
 * Toggle task completion with smart logic
 */
window.toggleSquadTask = async (id, isDone, isMain = false) => {
    // 1. Update individual completion
    if (isDone) {
        await supabase.from('squad_task_completions').upsert({ task_id: id, profile_id: currentProfile.id });
    } else {
        await supabase.from('squad_task_completions').delete().eq('task_id', id).eq('profile_id', currentProfile.id);
    }

    // 2. Confetti & Smart Logic
    let triggerBigConfetti = isMain && isDone;

    if (isMain && isDone) {
        // If finish main, finish all subs for me
        const { data: subs } = await supabase.from('squad_tasks').select('id').eq('parent_id', id);
        if (subs.length > 0) {
            const ins = subs.map(s => ({ task_id: s.id, profile_id: currentProfile.id }));
            await supabase.from('squad_task_completions').upsert(ins);
        }
    } else if (!isMain) {
        const { data: currentTask } = await supabase.from('squad_tasks').select('parent_id').eq('id', id).single();
        if (currentTask.parent_id) {
            // Check siblings
            const { data: totalSubs } = await supabase.from('squad_tasks').select('id').eq('parent_id', currentTask.parent_id);
            const { data: doneSubs } = await supabase.from('squad_task_completions')
                .select('task_id')
                .eq('profile_id', currentProfile.id)
                .in('task_id', totalSubs.map(s => s.id));

            if (doneSubs.length === totalSubs.length) {
                await supabase.from('squad_task_completions').upsert({ task_id: currentTask.parent_id, profile_id: currentProfile.id });
                triggerBigConfetti = true;
            }
        }
    }

    // 3. Execution of Celebration
    if (isDone) {
        if (triggerBigConfetti) {
            triggerCelebration('main');
        } else {
            triggerCelebration('sub');
        }
    }

    loadTasks();
};

/**
 * Delete task
 */
window.deleteSquadTask = async (id) => {
    const { isConfirmed } = await Swal.fire({
        title: 'حذف الهدف؟',
        text: 'متأكد إنك عاوز تشيل الهدف ده من الشلة؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'آيوة، احذفه'
    });

    if (isConfirmed) {
        await supabase.from('squad_tasks').delete().eq('id', id);
        loadTasks();
    }
};
