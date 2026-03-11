/**
 * Todo List Manager - V4.2 (Subtask Popup Updated)
 */
import { supabase } from "./supabaseClient.js";
import { playSuccessSound, playUndoSound } from "./utils/sounds.js";

document.addEventListener('DOMContentLoaded', async () => {
    // Massive Celebration Configuration
    const MASSIVE_CELEBRATION_DURATION = 2; // Duration in seconds (e.g., 5 seconds)

    const mainInput = document.getElementById('mainTaskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const todoList = document.getElementById('todoList');
    const emptyState = document.getElementById('emptyState');
    const progressBar = document.getElementById('progressBarFill');
    const progressPercent = document.getElementById('progressPercentage');
    const summaryText = document.getElementById('taskCountSummary');
    const greetingTitle = document.getElementById('greetingTitle');

    // Modals
    const deleteModal = document.getElementById('deleteModal');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');

    const editModal = document.getElementById('editModal');
    const editTaskInput = document.getElementById('editTaskInput');
    const confirmEditBtn = document.getElementById('confirmEdit');
    const cancelEditBtn = document.getElementById('cancelEdit');

    // Add Subtask Modal
    const addSubModal = document.getElementById('addSubModal');
    const addSubInput = document.getElementById('addSubInput');
    const confirmAddSubBtn = document.getElementById('confirmAddSub');
    const cancelAddSubBtn = document.getElementById('cancelAddSub');

    let tasks = [];
    let editingTarget = { tIdx: null, sIdx: null }; // Track what is being edited
    let deletionTarget = { tIdx: null, sIdx: null }; // Track what is being deleted
    let addingSubTarget = null; // Track which task we are adding a subtask to (index)
    let collapsedTasks = {}; // Store collapse state by task ID

    const init = async () => {
        // PERSONALIZED GREETING NEEDS PROFILE FIRST
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_active, full_name')
            .eq('id', user.id)
            .single();

        // Check premium/freemium access for tasks
        const { subscriptionService, initSubscriptionService } = await import("./subscription.js");
        await initSubscriptionService(profile);

        if (!subscriptionService.canAccessFeature('tasks')) {
            // Hide todo content and show subscription prompt
            document.querySelector('.todo-page').innerHTML = `
                <div style="text-align: center; padding: 3rem; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 600px; margin: 2rem auto;">
                    <i class="fas fa-tasks" style="font-size: 4rem; color: #03A9F4; margin-bottom: 1rem;"></i>
                    <h2 style="color: #1e293b; margin-bottom: 1rem;">المهام للمشتركين بس</h2>
                    <p style="color: #64748b; margin-bottom: 2rem;">اشترك دلوقتي عشان تقدر تنظم مهامك وتستخدم البومودورو!</p>
                    <a href="pending.html" style="display: inline-block; background: #03A9F4; color: white; padding: 0.75rem 2rem; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        <i class="fas fa-star"></i> اشترك دلوقتي
                    </a>
                </div>
            `;
            return;
        }

        // Personalized Dynamic Greeting
        if (greetingTitle) {
            const hour = new Date().getHours();
            const fullName = profile?.full_name || 'يا بطل';
            const firstName = fullName.split(' ')[0];
            let timeGreeting = '';

            if (hour >= 5 && hour < 12) {
                timeGreeting = 'صباح الخير';
            } else {
                timeGreeting = 'مساء الخير';
            }
            greetingTitle.textContent = `${timeGreeting} يا ${firstName}`;
        }

        await loadTasksFromDB();
    };

    const loadTasksFromDB = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error loading tasks:", error);
            return;
        }

        tasks = data || [];
        renderTasks(true);
    };

    const renderTasks = (isInitial = false) => {
        todoList.innerHTML = '';
        if (tasks.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            emptyState.style.display = 'none';
            tasks.forEach((task, index) => {
                const el = createTaskElement(task, index);
                if (isInitial) {
                    el.classList.add('entrance-anim');
                    el.style.animationDelay = `${index * 50}ms`;
                }
                todoList.appendChild(el);
            });
        }
        updateGlobalProgress();
    };

    const createTaskElement = (task, index) => {
        const card = document.createElement('div');
        const colorClass = `task-color-${(index % 6) + 1}`;
        card.className = `task-row ${task.completed ? 'completed' : ''} ${colorClass}`;
        card.dataset.id = task.id;

        const subtasks = task.subtasks || [];
        const completedSubs = subtasks.filter(s => s.completed).length;
        const hasSubs = subtasks.length > 0;

        // Subtask Progress Indicator
        const progressHTML = hasSubs ? `
            <span class="row-progress">${completedSubs}/${subtasks.length}</span>
        ` : '';

        // Subtasks Markup
        let subtasksHTML = '';
        if (hasSubs) {
            subtasksHTML = `
                <div class="row-subtasks">
                    ${subtasks.map((sub, sIdx) => `
                        <div class="sub-row ${sub.completed ? 'completed' : ''}">
                            <div class="check-area">
                                <div class="sub-check" onclick="window.toggleSubtask(${index}, ${sIdx})">
                                    <div class="custom-check"><i class="fas fa-check"></i></div>
                                </div>
                            </div>
                            <div class="sub-content" onclick="window.toggleSubtask(${index}, ${sIdx})">
                                <span class="sub-text" dir="auto">${sub.text}</span>
                            </div>
                            <div class="sub-actions">
                                <button class="btn-icon" onclick="window.startEdit(${index}, ${sIdx})" title="تعديل"><i class="fas fa-pen"></i></button>
                                <button class="btn-icon delete" onclick="window.deleteSubtask(${index}, ${sIdx})" title="حذف"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="row-main">
                <div class="check-area">
                    <div class="row-check" onclick="window.toggleTask(${index})">
                        <div class="custom-check"><i class="fas fa-check"></i></div>
                    </div>
                </div>
                <div class="row-content" onclick="window.toggleTask(${index})">
                    <div class="row-title-bar">
                        <span class="row-text" dir="auto">${task.text}</span>
                        ${progressHTML}
                    </div>
                </div>
                <div class="row-actions">
                    <button class="btn-icon add" onclick="window.startAddSub(${index})" title="مهمة فرعية"><i class="fas fa-plus"></i></button>
                    <button class="btn-icon" onclick="window.startEdit(${index}, null)" title="تعديل"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon delete" onclick="window.deleteTask(${index})" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            ${subtasksHTML}
        `;

        return card;
    };

    // Global function to toggle collapse state
    window.toggleCollapse = (taskId) => {
        collapsedTasks[taskId] = !collapsedTasks[taskId];
        renderTasks();
    };

    // --- Core Operations ---
    const addTask = async () => {
        const text = mainInput.value.trim();
        if (!text) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('todos')
            .insert({ text, user_id: user.id, completed: false, subtasks: [] })
            .select()
            .single();

        if (error) {
            console.error("Error adding task:", error);
            return;
        }

        tasks.unshift(data);
        mainInput.value = '';
        renderTasks(true); // Animate on new add
    };

    window.toggleTask = async (index) => {
        const task = tasks[index];
        const newStatus = !task.completed;

        let subtasks = task.subtasks || [];
        // If marking main task as completed, mark all subtasks as completed too
        if (newStatus && subtasks.length > 0) {
            subtasks = subtasks.map(s => ({ ...s, completed: true }));
        }

        const updates = { completed: newStatus, subtasks: subtasks };
        const { error } = await supabase.from('todos').update(updates).eq('id', task.id);

        if (error) return console.error(error);
        task.completed = newStatus;
        task.subtasks = subtasks;

        // Play sound effect after successful update
        if (newStatus) {
            playSuccessSound();
        } else {
            playUndoSound();
        }

        if (task.completed) triggerCelebration('main');
        renderTasks();
    };

    // ... (Rest of file)

    const triggerCelebration = (type) => {
        if (type === 'massive') {
            // Massive Celebration (Side Bursts)
            var duration = MASSIVE_CELEBRATION_DURATION * 1000;
            var end = Date.now() + duration;
            (function frame() {
                confetti({ particleCount: 7, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#03A9F4', '#10b981'] });
                confetti({ particleCount: 7, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#03A9F4', '#10b981'] });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());
        } else if (type === 'main') {
            // Increased main task celebration
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
            // Increased Subtask celebration
            confetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.7 },
                scalar: 1.1,
                colors: ['#03A9F4', '#64B5F6']
            });
        }
    };

    // --- Edit Popup Logic ---
    window.startEdit = (tIdx, sIdx) => {
        editingTarget = { tIdx, sIdx };
        const task = tasks[tIdx];
        const val = sIdx === null ? task.text : task.subtasks[sIdx].text;
        editTaskInput.value = val;
        editModal.style.display = 'flex';
        setTimeout(() => editTaskInput.focus(), 50);
    };

    confirmEditBtn.addEventListener('click', async () => {
        const { tIdx, sIdx } = editingTarget;
        const newVal = editTaskInput.value.trim();
        if (!newVal) return;

        const task = tasks[tIdx];
        if (sIdx === null) {
            const { error } = await supabase.from('todos').update({ text: newVal }).eq('id', task.id);
            if (error) return console.error(error);
            task.text = newVal;
        } else {
            const newSubtasks = [...task.subtasks];
            newSubtasks[sIdx].text = newVal;
            const { error } = await supabase.from('todos').update({ subtasks: newSubtasks }).eq('id', task.id);
            if (error) return console.error(error);
            task.subtasks = newSubtasks;
        }

        editModal.style.display = 'none';
        renderTasks();
    });

    cancelEditBtn.addEventListener('click', () => editModal.style.display = 'none');
    editTaskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirmEditBtn.click(); });

    // --- Add Subtask Popup Logic ---
    window.startAddSub = (index) => {
        addingSubTarget = index;
        addSubInput.value = '';
        addSubModal.style.display = 'flex';
        setTimeout(() => addSubInput.focus(), 50);
    };

    confirmAddSubBtn.addEventListener('click', async () => {
        if (addingSubTarget === null) return;
        const subText = addSubInput.value.trim();
        if (!subText) return;

        const task = tasks[addingSubTarget];
        const newSubtasks = [...(task.subtasks || []), { text: subText, completed: false }];

        // If main task completed, marking it incomplete? Optional. Let's keep it simple.
        // Actually often adding a subtask means the main task is not "done" yet or expanded.
        // Let's uncheck main task just in case.
        const updates = { subtasks: newSubtasks };
        if (task.completed) updates.completed = false;

        const { error } = await supabase.from('todos').update(updates).eq('id', task.id);
        if (error) return console.error(error);

        task.subtasks = newSubtasks;
        if (task.completed) task.completed = false;

        addSubModal.style.display = 'none';
        renderTasks();
    });

    cancelAddSubBtn.addEventListener('click', () => addSubModal.style.display = 'none');
    addSubInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirmAddSubBtn.click(); });


    // --- Deletion Logic ---
    window.deleteTask = (index) => {
        deletionTarget = { tIdx: index, sIdx: null };
        deleteModal.style.display = 'flex';
    };

    window.deleteSubtask = (tIdx, sIdx) => {
        deletionTarget = { tIdx, sIdx };
        deleteModal.style.display = 'flex';
    };

    confirmDeleteBtn.addEventListener('click', async () => {
        const { tIdx, sIdx } = deletionTarget;
        const task = tasks[tIdx];

        if (sIdx === null) {
            const { error } = await supabase.from('todos').delete().eq('id', task.id);
            if (error) return console.error(error);
            tasks.splice(tIdx, 1);
        } else {
            const newSubtasks = [...task.subtasks];
            newSubtasks.splice(sIdx, 1);
            const { error } = await supabase.from('todos').update({ subtasks: newSubtasks }).eq('id', task.id);
            if (error) return console.error(error);
            task.subtasks = newSubtasks;
        }

        deleteModal.style.display = 'none';
        renderTasks();
    });

    cancelDeleteBtn.addEventListener('click', () => deleteModal.style.display = 'none');

    // --- Subtask Toggle Logic ---
    // --- Subtask Toggle Logic ---
    window.toggleSubtask = async (tIdx, sIdx) => {
        const task = tasks[tIdx];
        const newSubtasks = [...task.subtasks];
        const isNowDone = !newSubtasks[sIdx].completed;
        newSubtasks[sIdx].completed = isNowDone;

        let newStatus = task.completed;
        if (newSubtasks[sIdx].completed) {
            triggerCelebration('sub');
            if (newSubtasks.every(s => s.completed)) {
                newStatus = true;
                triggerCelebration('main');
            }
        } else {
            newStatus = false;
        }

        const { error } = await supabase.from('todos').update({ subtasks: newSubtasks, completed: newStatus }).eq('id', task.id);
        if (error) return console.error(error);

        // Play sound effect after successful update
        if (isNowDone) {
            playSuccessSound();
        } else {
            playUndoSound();
        }

        task.subtasks = newSubtasks;
        task.completed = newStatus;
        renderTasks();
    };

    // --- Progress & Analytics ---
    const updateGlobalProgress = () => {
        if (tasks.length === 0) {
            progressBar.style.width = '0%'; progressPercent.textContent = '0%';
            summaryText.textContent = 'ضيف مهامك اليوم!'; return;
        }
        let totalProgress = 0;
        const mainTaskWeight = 1 / tasks.length;
        tasks.forEach(task => {
            if (!task.subtasks || task.subtasks.length === 0) {
                if (task.completed) totalProgress += mainTaskWeight;
            } else {
                let subProgressValue = 0;
                task.subtasks.forEach(s => { if (s.completed) subProgressValue += (1 / task.subtasks.length); });
                totalProgress += subProgressValue * mainTaskWeight;
            }
        });
        const percentage = Math.round(totalProgress * 100);
        progressBar.style.width = `${percentage}%`;
        progressPercent.textContent = `${percentage}%`;
        if (percentage === 100) {
            summaryText.textContent = "عاش يا بطل! خلصت كل اللي عليك انهارده😘";
            // Trigger custom massive celebration once per session
            if (sessionStorage.getItem('todo_100_celebration') !== 'true') {
                triggerCelebration('massive');
                sessionStorage.setItem('todo_100_celebration', 'true');
            }
        } else {
            summaryText.textContent = "ذاكر و خلص كل اللي وراك";
            sessionStorage.removeItem('todo_100_celebration');
        }
    };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }


    // --- Pomodoro Logic (Local) ---
    let pomodoroInterval = null;
    let pomodoroEndTime = null;

    const initPomodoro = () => {
        const btn = document.getElementById('startPomodoroBtn');
        if (btn) btn.onclick = startPomodoroFlow;

        const cancelDurBtn = document.getElementById('cancelDuration');
        if (cancelDurBtn) {
            cancelDurBtn.onclick = () => {
                document.getElementById('durationModal').style.display = 'none';
            };
        }
        // Check for running timer in localStorage
        const savedEnd = localStorage.getItem('personal_pomodoro_end');
        if (savedEnd) {
            const now = Date.now();
            if (parseInt(savedEnd) > now) {
                pomodoroEndTime = parseInt(savedEnd);
                startLocalTimerDisplay();
                btn.textContent = 'إيقاف المذاكرة';
                btn.onclick = stopPomodoro;
            } else {
                localStorage.removeItem('personal_pomodoro_end');
            }
        }
    };

    const startPomodoroFlow = () => {
        const modal = document.getElementById('durationModal');
        if (modal) modal.style.display = 'flex';
    };

    window.selectDuration = (duration) => {
        const durationMs = parseInt(duration) * 60 * 1000;
        pomodoroEndTime = Date.now() + durationMs;
        localStorage.setItem('personal_pomodoro_end', pomodoroEndTime);

        startLocalTimerDisplay();

        const btn = document.getElementById('startPomodoroBtn');
        btn.textContent = 'وقف المذاكرة';
        btn.onclick = stopPomodoro;

        document.getElementById('durationModal').style.display = 'none';
    };
    const stopPomodoro = () => {
        if (pomodoroInterval) clearInterval(pomodoroInterval);
        pomodoroEndTime = null;
        localStorage.removeItem('personal_pomodoro_end');
        document.getElementById('pomodoroTimer').textContent = '25:00';

        const btn = document.getElementById('startPomodoroBtn');
        btn.textContent = 'ابدأ المذاكرة';
        btn.onclick = startPomodoroFlow;
    };

    const startLocalTimerDisplay = () => {
        if (pomodoroInterval) clearInterval(pomodoroInterval);

        const tick = () => {
            const now = Date.now();
            const diff = pomodoroEndTime - now;

            if (diff <= 0) {
                stopPomodoro();
                Swal.fire('عاش يا بطل!', 'خلصت مذاكرة.', 'success');
                return;
            }

            const mins = Math.floor(diff / (1000 * 60));
            const secs = Math.floor((diff / 1000) % 60);
            document.getElementById('pomodoroTimer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        tick(); // Immediate update
        pomodoroInterval = setInterval(tick, 1000);
    };

    initPomodoro();

    addTaskBtn.addEventListener('click', addTask);
    mainInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

    init();
});
