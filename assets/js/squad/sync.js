// Squad Sync Manager - EXACT COPY from original squad.js
import { syncTimer } from './state.js';
import { setSyncTimer } from './state.js';
import { loadChat } from './chat.js';
import { loadPomodoro } from './pomodoro.js';
import { loadTasks } from './tasks.js';
import { loadMembers } from './members.js';
import { loadActiveChallenge } from './challenge.js';
import { loadGlobalSettings } from './utils.js';

/**
 * Start Sync Manager - Orchestrates background synchronization for squad components.
 */
export function startSyncManager() {
    if (syncTimer) clearTimeout(syncTimer);

    const FAST_INTERVAL = 60000; // 60s for all core data (was 20s) - reduced for performance
    const SLOW_INTERVAL = 120000; // 120s for tasks/members (was 30s) - reduced for performance
    const SETTINGS_INTERVAL = 300000; // 5 mins

    let lastSlowSync = 0;
    let lastSettingsSync = 0;

    const performSync = async () => {
        if (document.visibilityState !== 'visible') {
            setSyncTimer(setTimeout(performSync, FAST_INTERVAL));
            return;
        }

        const now = Date.now();
        const shouldDoSlowSync = (now - lastSlowSync) >= SLOW_INTERVAL;
        const shouldDoSettingsSync = (now - lastSettingsSync) >= SETTINGS_INTERVAL;

        try {
            const tasks = [loadChat(), loadPomodoro(), loadActiveChallenge()];

            if (shouldDoSlowSync) {
                tasks.push(loadTasks(), loadMembers());
                lastSlowSync = now;
            }

            if (shouldDoSettingsSync || lastSettingsSync === 0) {
                tasks.push(loadGlobalSettings());
                lastSettingsSync = now;
            }

            await Promise.allSettled(tasks);
        } catch (err) {
            console.error('[SyncManager] Sync failed:', err);
        }

        setSyncTimer(setTimeout(performSync, FAST_INTERVAL));
    };

    // Kick off initial sync
    setSyncTimer(setTimeout(performSync, FAST_INTERVAL));

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') performSync();
    });
}
