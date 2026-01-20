/**
 * Todo List Manager - V4.1 (Supabase Backend + Popup Edit)
 */
import { supabase } from "./supabaseClient.js";

document.addEventListener('DOMContentLoaded', async () => {
    const mainInput = document.getElementById('mainTaskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const todoList = document.getElementById('todoList');
    const emptyState = document.getElementById('emptyState');
    const progressBar = document.getElementById('progressBarFill');
    const progressPercent = document.getElementById('progressPercentage');
    const summaryText = document.getElementById('taskCountSummary');
    const greetingText = document.getElementById('greetingText');

    // Modals
    const deleteModal = document.getElementById('deleteModal');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');

    const editModal = document.getElementById('editModal');
    const editTaskInput = document.getElementById('editTaskInput');
    const confirmEditBtn = document.getElementById('confirmEdit');
    const cancelEditBtn = document.getElementById('cancelEdit');

    let tasks = [];
    let editingTarget = { tIdx: null, sIdx: null }; // Track what is being edited
    let deletionTarget = { tIdx: null, sIdx: null }; // Track what is being deleted
    let addingSubIdx = null; // Track which task is currently being added a subtask to

    const init = async () => {
        const greetings = ["صباح الخير يا بطل! 🌞", "جاهز لإنجاز أهدافك؟ ✨", "يوم جديد.. بداية قوية! 💪", "ركز على هدفك اليوم 🎯"];
        greetingText.textContent = greetings[Math.floor(Math.random() * greetings.length)];
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
        renderTasks();
    };

    const renderTasks = () => {
        todoList.innerHTML = '';
        if (tasks.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            emptyState.style.display = 'none';
            tasks.forEach((task, index) => {
                todoList.appendChild(createTaskElement(task, index));
            });
        }
        updateGlobalProgress();
    };

    const createTaskElement = (task, index) => {
        const card = document.createElement('div');
        card.className = `task-card ${task.completed ? 'completed' : ''}`;
        card.dataset.color = index % 5;

        // Subtasks Logic
        let subtasksHTML = '';
        if ((task.subtasks && task.subtasks.length > 0) || addingSubIdx === index) {
            subtasksHTML = `<div class="subtasks-wrapper">`;
            (task.subtasks || []).forEach((sub, subIndex) => {
                subtasksHTML += `
                        <div class="subtask-item ${sub.completed ? 'completed' : ''}">
                            <div class="sub-checkbox" onclick="window.toggleSubtask(${index}, ${subIndex})">
                                <i class="fas fa-check"></i>
                            </div>
                            <span class="sub-text" onclick="window.toggleSubtask(${index}, ${subIndex})">${sub.text}</span>
                            <div class="task-actions">
                                <button class="action-btn" onclick="window.startEdit(${index}, ${subIndex})" title="تعديل"><i class="fas fa-edit"></i></button>
                                <button class="action-btn delete" onclick="window.deleteSubtask(${index}, ${subIndex})" title="حذف"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        </div>
                `;
            });

            // Inline Add Subtask Input (Keep this inline as it's better for quick adding)
            if (addingSubIdx === index) {
                subtasksHTML += `
                    <div class="sub-add-wrapper">
                        <input type="text" class="sub-add-input" placeholder="اكتب المهمة الفرعية..." id="sub-input-${index}" onkeypress="window.handleSubAddKey(event, ${index})" onblur="window.cancelSubAdd()">
                        <button class="action-btn save" onclick="window.addSubtask(${index})"><i class="fas fa-check"></i></button>
                    </div>
                `;
            }
            subtasksHTML += `</div>`;
        }

        card.innerHTML = `
            <div class="task-main">
                <div class="task-checkbox-wrapper" onclick="window.toggleTask(${index})">
                    <div class="task-checkbox">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
                <div class="task-text" onclick="window.toggleTask(${index})">${task.text}</div>
                <div class="task-actions">
                    <button class="action-btn add-sub" onclick="window.startAddSub(${index})" title="إضافة مهمة فرعية"><i class="fas fa-plus"></i></button>
                    <button class="action-btn" onclick="window.startEdit(${index}, null)" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="window.deleteTask(${index})" title="حذف"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            ${subtasksHTML}
        `;

        if (addingSubIdx === index) {
            setTimeout(() => {
                const el = document.getElementById(`sub-input-${index}`);
                if (el) el.focus();
            }, 0);
        }

        return card;
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
        renderTasks();
    };

    window.toggleTask = async (index) => {
        const task = tasks[index];
        const newStatus = !task.completed;
        const { error } = await supabase.from('todos').update({ completed: newStatus }).eq('id', task.id);
        if (error) return console.error(error);
        task.completed = newStatus;
        if (task.completed) triggerCelebration('main');
        renderTasks();
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

    // --- Subtask Logic ---
    window.startAddSub = (index) => { addingSubIdx = index; renderTasks(); };
    window.cancelSubAdd = () => { setTimeout(() => { addingSubIdx = null; renderTasks(); }, 200); };
    window.addSubtask = async (index) => {
        const input = document.getElementById(`sub-input-${index}`);
        if (!input || !input.value.trim()) return;
        const task = tasks[index];
        const newSubtasks = [...(task.subtasks || []), { text: input.value.trim(), completed: false }];
        const updates = { subtasks: newSubtasks };
        if (task.completed) updates.completed = false;

        const { error } = await supabase.from('todos').update(updates).eq('id', task.id);
        if (error) return console.error(error);

        task.subtasks = newSubtasks;
        if (task.completed) task.completed = false;
        addingSubIdx = null;
        renderTasks();
    };
    window.handleSubAddKey = (e, idx) => { if (e.key === 'Enter') window.addSubtask(idx); };

    window.toggleSubtask = async (tIdx, sIdx) => {
        const task = tasks[tIdx];
        const newSubtasks = [...task.subtasks];
        newSubtasks[sIdx].completed = !newSubtasks[sIdx].completed;

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

        task.subtasks = newSubtasks;
        task.completed = newStatus;
        renderTasks();
    };

    // --- Progress & Analytics ---
    const updateGlobalProgress = () => {
        if (tasks.length === 0) {
            progressBar.style.width = '0%'; progressPercent.textContent = '0%';
            summaryText.textContent = 'ابدأ بإضافة مهامك اليوم!'; return;
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
        if (percentage === 100) summaryText.textContent = "عاش يا بطل! أنهيت مهامك بالكامل 🏆";
        else summaryText.textContent = "خطوة بخطوة.. أنت بتقرب من النهاية! 🌟";
    };

    const triggerCelebration = (type) => {
        const count = type === 'main' ? 150 : 40;
        confetti({ particleCount: count, spread: 70, origin: { y: 0.6 }, colors: ['#00897B', '#FF6F00', '#FFD54F'] });
    };

    addTaskBtn.addEventListener('click', addTask);
    mainInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

    init();
});
