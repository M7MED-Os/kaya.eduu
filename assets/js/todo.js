/**
 * Todo List Manager - V3 (Inline Everything & Auto-Completion)
 */

document.addEventListener('DOMContentLoaded', () => {
    const mainInput = document.getElementById('mainTaskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const todoList = document.getElementById('todoList');
    const emptyState = document.getElementById('emptyState');
    const progressBar = document.getElementById('progressBarFill');
    const progressPercent = document.getElementById('progressPercentage');
    const summaryText = document.getElementById('taskCountSummary');
    const greetingText = document.getElementById('greetingText');

    let tasks = JSON.parse(localStorage.getItem('kaya_todo_tasks')) || [];
    let editingState = { taskIdx: null, subIdx: null };
    let addingSubIdx = null; // Track which task is currently being added a subtask to

    const init = () => {
        const greetings = ["صباح الخير يا بطل! 🌞", "جاهز لإنجاز أهدافك؟ ✨", "يوم جديد.. بداية قوية! 💪", "ركز على هدفك اليوم 🎯"];
        greetingText.textContent = greetings[Math.floor(Math.random() * greetings.length)];
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
        saveTasks();
    };

    const createTaskElement = (task, index) => {
        const card = document.createElement('div');
        card.className = `task-card ${task.completed ? 'completed' : ''}`;
        card.dataset.color = index % 5;

        const isEditingMain = editingState.taskIdx === index && editingState.subIdx === null;

        // Subtasks Logic
        let subtasksHTML = '';
        if ((task.subtasks && task.subtasks.length > 0) || addingSubIdx === index) {
            subtasksHTML = `<div class="subtasks-wrapper">`;
            (task.subtasks || []).forEach((sub, subIndex) => {
                const isEditingSub = editingState.taskIdx === index && editingState.subIdx === subIndex;
                subtasksHTML += `
                        <div class="subtask-item ${sub.completed ? 'completed' : ''}">
                            <div class="sub-checkbox" onclick="toggleSubtask(${index}, ${subIndex})">
                                <i class="fas fa-check"></i>
                            </div>
                            ${isEditingSub ?
                        `<input type="text" class="sub-edit-input" value="${sub.text}" id="edit-sub-${index}-${subIndex}" onkeypress="handleEditKey(event, ${index}, ${subIndex})">` :
                        `<span class="sub-text" onclick="toggleSubtask(${index}, ${subIndex})">${sub.text}</span>`
                    }
                   <div class="task-actions">
                            ${isEditingSub ?
                        `<button class="action-btn save" onclick="saveEdit(${index}, ${subIndex})" title="حفظ"><i class="fas fa-save"></i></button>` :
                        `<button class="action-btn" onclick="startEdit(${index}, ${subIndex})" title="تعديل"><i class="fas fa-edit"></i></button>`
                    }
                            <button class="action-btn delete" onclick="deleteSubtask(${index}, ${subIndex})" title="حذف"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                `;
            });

            // Inline Add Subtask Input
            if (addingSubIdx === index) {
                subtasksHTML += `
                    <div class="sub-add-wrapper">
                        <input type="text" class="sub-add-input" placeholder="اكتب المهمة الفرعية..." id="sub-input-${index}" onkeypress="handleSubAddKey(event, ${index})" onblur="cancelSubAdd()">
                        <button class="action-btn save" onclick="addSubtask(${index})"><i class="fas fa-check"></i></button>
                    </div>
                `;
            }

            subtasksHTML += `</div>`;
        }

        card.innerHTML = `
            <div class="task-main">
                <div class="task-checkbox-wrapper" onclick="toggleTask(${index})">
                    <div class="task-checkbox">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
                ${isEditingMain ?
                `<input type="text" class="inline-edit-input" value="${task.text}" id="edit-main-${index}" onkeypress="handleEditKey(event, ${index}, null)">` :
                `<div class="task-text" onclick="toggleTask(${index})">${task.text}</div>`
            }
                <div class="task-actions">
                    <button class="action-btn add-sub" onclick="startAddSub(${index})" title="إضافة مهمة فرعية"><i class="fas fa-plus"></i></button>
                    ${isEditingMain ?
                `<button class="action-btn save" onclick="saveEdit(${index}, null)" title="حفظ"><i class="fas fa-save"></i></button>` :
                `<button class="action-btn" onclick="startEdit(${index}, null)" title="تعديل"><i class="fas fa-edit"></i></button>`
            }
                    <button class="action-btn delete" onclick="deleteTask(${index})" title="حذف"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            ${subtasksHTML}
        `;

        // Focus Handlers
        if (isEditingMain) {
            setTimeout(() => { document.getElementById(`edit-main-${index}`).focus(); }, 0);
        } else if (editingState.taskIdx === index && editingState.subIdx !== null) {
            setTimeout(() => {
                const el = document.getElementById(`edit-sub-${index}-${editingState.subIdx}`);
                if (el) el.focus();
            }, 0);
        } else if (addingSubIdx === index) {
            setTimeout(() => {
                const el = document.getElementById(`sub-input-${index}`);
                if (el) el.focus();
            }, 0);
        }

        return card;
    };

    // --- Core Operations ---
    const addTask = () => {
        const text = mainInput.value.trim();
        if (text) {
            tasks.unshift({ text, completed: false, subtasks: [] });
            mainInput.value = '';
            renderTasks();
        }
    };

    window.toggleTask = (index) => {
        tasks[index].completed = !tasks[index].completed;
        if (tasks[index].completed) triggerCelebration('main');
        renderTasks();
    };

    // --- Deletion Logic with Custom Modal ---
    let deletionTarget = null; // { tIdx, sIdx }

    const deleteModal = document.getElementById('deleteModal');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');

    const showDeleteModal = (tIdx, sIdx = null) => {
        deletionTarget = { tIdx, sIdx };
        deleteModal.style.display = 'flex';
    };

    const hideDeleteModal = () => {
        deletionTarget = null;
        deleteModal.style.display = 'none';
    };

    confirmDeleteBtn.addEventListener('click', () => {
        if (!deletionTarget) return;
        const { tIdx, sIdx } = deletionTarget;

        if (sIdx === null) {
            tasks.splice(tIdx, 1);
        } else {
            tasks[tIdx].subtasks.splice(sIdx, 1);
        }

        hideDeleteModal();
        renderTasks();
    });

    cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) hideDeleteModal();
    });

    window.deleteTask = (index) => showDeleteModal(index);
    window.deleteSubtask = (tIdx, sIdx) => showDeleteModal(tIdx, sIdx);
    window.startEdit = (taskIdx, subIdx) => { editingState = { taskIdx, subIdx }; renderTasks(); };

    window.saveEdit = (taskIdx, subIdx) => {
        const inputId = subIdx === null ? `edit-main-${taskIdx}` : `edit-sub-${taskIdx}-${subIdx}`;
        const input = document.getElementById(inputId);
        if (!input) return;
        const val = input.value.trim();
        if (val) {
            if (subIdx === null) tasks[taskIdx].text = val;
            else tasks[taskIdx].subtasks[subIdx].text = val;
            editingState = { taskIdx: null, subIdx: null };
            renderTasks();
        }
    };

    window.handleEditKey = (e, tIdx, sIdx) => { if (e.key === 'Enter') saveEdit(tIdx, sIdx); };

    // --- Subtask Logic (V3) ---
    window.startAddSub = (index) => { addingSubIdx = index; renderTasks(); };

    window.cancelSubAdd = () => { setTimeout(() => { addingSubIdx = null; renderTasks(); }, 200); };

    window.addSubtask = (index) => {
        const input = document.getElementById(`sub-input-${index}`);
        if (!input) return;
        const val = input.value.trim();
        if (val) {
            tasks[index].subtasks.push({ text: val, completed: false });
            // AUTO-CHECK: If subtasks exist, a parent shouldn't necessarily be checked IF there's uncompleted ones
            // But if we add a subtask to a checked parent, should we uncheck the parent?
            // User requested that if all subtasks are finished, parent completes.
            if (tasks[index].completed) tasks[index].completed = false;
            addingSubIdx = null;
            renderTasks();
        }
    };

    window.handleSubAddKey = (e, idx) => { if (e.key === 'Enter') addSubtask(idx); };

    window.toggleSubtask = (tIdx, sIdx) => {
        const sub = tasks[tIdx].subtasks[sIdx];
        sub.completed = !sub.completed;

        if (sub.completed) {
            triggerCelebration('sub');
            // SMART LOGIC: If all subtasks completed, complete the parent
            const allSubsDone = tasks[tIdx].subtasks.every(s => s.completed);
            if (allSubsDone) {
                tasks[tIdx].completed = true;
                triggerCelebration('main');
            }
        } else {
            // If at least one subtask is unchecked, parent must be unchecked
            tasks[tIdx].completed = false;
        }
        renderTasks();
    };

    window.deleteSubtask = (tIdx, sIdx) => { tasks[tIdx].subtasks.splice(sIdx, 1); renderTasks(); };

    // --- Progress & Analytics ---
    const updateGlobalProgress = () => {
        if (tasks.length === 0) {
            progressBar.style.width = '0%'; progressPercent.textContent = '0%';
            summaryText.textContent = 'ابدأ بإضافة مهامك اليوم!'; return;
        }

        let totalProgress = 0;
        const mainTaskWeight = 1 / tasks.length;

        tasks.forEach(task => {
            if (task.subtasks.length === 0) {
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

    const saveTasks = () => localStorage.setItem('kaya_todo_tasks', JSON.stringify(tasks));

    addTaskBtn.addEventListener('click', addTask);
    mainInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

    init();
});
