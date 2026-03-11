/**
 * Squad System - Main Entry Point
 * 
 * This is the main file that imports and initializes all squad modules.
 * Import this file in squad.html instead of the monolithic squad.js
 */

// Import all modules
import { initSquad } from './init.js';
import { loadGlobalSettings } from './utils.js';
import { setGlobalSquadSettings } from './state.js';
import { startSyncManager } from './sync.js';
import { handleChatSubmit } from './chat.js';
import './exams.js'; // Import to expose startSharedExam globally
import './settings.js'; // Import to expose global functions
import './challenge.js'; // Import to expose global functions
import './members.js'; // Import to expose global functions
import './tasks.js'; // Import to expose global functions

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    // Critical: Load settings BEFORE rendering UI
    const settings = await loadGlobalSettings();
    setGlobalSquadSettings(settings);

    startSyncManager();
    await initSquad();

    // Setup event listeners
    setupEventListeners();
});

/**
 * Setup global event listeners
 */
function setupEventListeners() {
    // Change Squad Avatar Button
    const changeSquadAvatarBtn = document.getElementById('changeSquadAvatarBtn');
    if (changeSquadAvatarBtn) {
        changeSquadAvatarBtn.addEventListener('click', async () => {
            const { currentSquad, currentProfile } = await import('./state.js');
            if (!currentSquad || !currentProfile) {
                showToast('جاري تحميل البيانات...', 'info');
                return;
            }

            const { openAvatarModal } = await import('../avatar-modal.js');
            await openAvatarModal('squad', currentSquad.id, currentSquad.name, (newAvatarUrl) => {
                currentSquad.avatar_url = newAvatarUrl;
                const img = document.getElementById('squadAvatar');
                if (img) img.src = newAvatarUrl;
            });
        });
    }

    // Pomodoro Start Button
    const startPomodoroBtn = document.getElementById('startPomodoroBtn');
    if (startPomodoroBtn) {
        startPomodoroBtn.onclick = async () => {
            const { startPomodoroFlow } = await import('./pomodoro.js');
            startPomodoroFlow();
        };
    }

    // Chat Form - PREVENT DEFAULT REFRESH
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.onsubmit = (e) => {
            e.preventDefault(); // CRITICAL: Prevent page refresh
            handleChatSubmit(e);
        };
    }
}

// Export for global access (if needed)
export { initSquad };
