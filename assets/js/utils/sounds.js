/**
 * Sound Effects Utility
 * Provides audio feedback for user actions using Web Audio API
 */

// Check if sounds are enabled (default: true)
function isSoundEnabled() {
    const setting = localStorage.getItem('soundEnabled');
    return setting === null ? true : setting === 'true';
}

// Toggle sound preference
export function toggleSound() {
    const current = isSoundEnabled();
    localStorage.setItem('soundEnabled', (!current).toString());
    return !current;
}

/**
 * Play a success sound when marking an item as complete
 * Two-tone "ding" sound (800Hz -> 1000Hz)
 */
export function playSuccessSound() {
    if (!isSoundEnabled()) return;

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // First tone: 800Hz
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        // Second tone: 1000Hz (higher pitch for satisfaction)
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.08);

        // Volume envelope (fade out)
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

        // Play the sound
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.25);

        // Clean up
        oscillator.onended = () => {
            audioContext.close();
        };
    } catch (error) {
        console.warn('Could not play success sound:', error);
    }
}

/**
 * Play an undo sound when unmarking an item
 * Subtle single-tone "pop" sound (600Hz)
 */
export function playUndoSound() {
    if (!isSoundEnabled()) return;

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Single tone: 600Hz (lower pitch for undo)
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);

        // Volume envelope (quick fade)
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

        // Play the sound
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);

        // Clean up
        oscillator.onended = () => {
            audioContext.close();
        };
    } catch (error) {
        console.warn('Could not play undo sound:', error);
    }
}

/**
 * Play a gentle notification sound
 * Useful for alerts or reminders
 */
export function playNotificationSound() {
    if (!isSoundEnabled()) return;

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Three-tone sequence
        oscillator.frequency.setValueAtTime(700, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(900, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

        // Volume envelope
        gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);

        // Play the sound
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.35);

        // Clean up
        oscillator.onended = () => {
            audioContext.close();
        };
    } catch (error) {
        console.warn('Could not play notification sound:', error);
    }
}
