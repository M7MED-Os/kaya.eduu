
// ==========================
// Shared Utility Functions
// ==========================

/**
 * Shows a toast notification at the bottom of the screen.
 * @param {string} message - The message to display.
 * @param {string} type - 'success' or 'error'
 */
export function showToast(message, type = "success") {
    // 1. Get or Create Container
    let container = document.querySelector(".toast-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    // 2. Create Toast
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    // Add content (Icon + Message)
    const iconClass = type === "success" ? "fa-check-circle" : "fa-exclamation-circle";
    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span class="toast-message">${message}</span>
    `;

    // 3. Append to Container
    container.appendChild(toast);

    // 4. Handle Removal (Animation is handled by CSS keyframes on mount)
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.4s ease forwards";
        toast.addEventListener("animationend", () => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove(); // Cleanup container if empty
            }
        });
    }, 3000); // 3 seconds delay
}

/**
 * Displays an error message below an input field and marks it as invalid.
 * @param {HTMLElement} inputElement - The input DOM element.
 * @param {string} message - The error message.
 */
export function showInputError(inputElement, message) {
    if (!inputElement) return;
    clearInputError(inputElement);
    inputElement.classList.add("input-error");
    const errorMsg = document.createElement("small");
    errorMsg.className = "error-message";
    errorMsg.textContent = message;
    inputElement.parentNode.insertBefore(errorMsg, inputElement.nextSibling);

    // Auto-clear on input
    inputElement.addEventListener("input", () => clearInputError(inputElement), {
        once: true,
    });
}

/**
 * Clears error state and message from an input field.
 * @param {HTMLElement} inputElement - The input DOM element.
 */
export function clearInputError(inputElement) {
    if (!inputElement) return;
    inputElement.classList.remove("input-error");
    const errorMsg = inputElement.parentNode.querySelector(".error-message");
    if (errorMsg) errorMsg.remove();
}
