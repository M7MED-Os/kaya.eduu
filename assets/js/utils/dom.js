/**
 * DOM Manipulation Utilities
 * Common DOM operations for cleaner code
 */

/**
 * Sets loading state on a button
 * @param {HTMLElement} button - Button element
 * @param {boolean} isLoading - Loading state
 * @param {string} loadingText - Text to show while loading (default: 'جاري التحميل...')
 * @param {string} originalText - Original button text (optional, will be stored in data attribute)
 */
export function setButtonLoading(button, isLoading, loadingText = 'جاري التحميل...', originalText = null) {
    if (!button) return;

    if (isLoading) {
        // Store original text if provided or get from button
        if (originalText) {
            button.dataset.originalText = originalText;
        } else if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.disabled = true;
        button.textContent = loadingText;
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || originalText || 'Submit';
    }
}

/**
 * Sets loading state with spinner icon
 * @param {HTMLElement} button - Button element
 * @param {boolean} isLoading - Loading state
 * @param {string} loadingText - Text to show while loading
 * @param {string} originalHTML - Original button HTML (optional)
 */
export function setButtonLoadingWithIcon(button, isLoading, loadingText = 'جاري التحميل...', originalHTML = null) {
    if (!button) return;

    if (isLoading) {
        if (originalHTML) {
            button.dataset.originalHTML = originalHTML;
        } else if (!button.dataset.originalHTML) {
            button.dataset.originalHTML = button.innerHTML;
        }

        button.disabled = true;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalHTML || originalHTML || 'Submit';
    }
}

/**
 * Shows an element by ID
 * @param {string} elementId - Element ID
 * @param {string} display - Display property value (default: 'block')
 */
export function showElement(elementId, display = 'block') {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = display;
    }
}

/**
 * Hides an element by ID
 * @param {string} elementId - Element ID
 */
export function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

/**
 * Toggles element visibility
 * @param {string} elementId - Element ID
 * @param {string} displayWhenVisible - Display property when visible (default: 'block')
 */
export function toggleElement(elementId, displayWhenVisible = 'block') {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = element.style.display === 'none' ? displayWhenVisible : 'none';
    }
}

/**
 * Clears all inputs in a form
 * @param {string|HTMLFormElement} form - Form ID or form element
 */
export function clearForm(form) {
    const formElement = typeof form === 'string' ? document.getElementById(form) : form;
    if (formElement) {
        formElement.reset();
    }
}

/**
 * Gets element by ID safely (returns null if not found)
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function getElement(id) {
    return document.getElementById(id);
}

/**
 * Gets element value by ID safely
 * @param {string} id - Element ID
 * @returns {string} - Value or empty string
 */
export function getElementValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
}

/**
 * Sets element value by ID
 * @param {string} id - Element ID
 * @param {string} value - Value to set
 */
export function setElementValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value;
    }
}

/**
 * Sets element text content by ID
 * @param {string} id - Element ID
 * @param {string} text - Text to set
 */
export function setElementText(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}

/**
 * Sets element HTML by ID
 * @param {string} id - Element ID
 * @param {string} html - HTML to set
 */
export function setElementHTML(id, html) {
    const element = document.getElementById(id);
    if (element) {
        element.innerHTML = html;
    }
}

/**
 * Removes element by ID
 * @param {string} id - Element ID
 */
export function removeElement(id) {
    const element = document.getElementById(id);
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

/**
 * Adds event listener to element by ID
 * @param {string} id - Element ID
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 */
export function addElementListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    }
}

/**
 * Scrolls to top of page smoothly
 */
export function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/**
 * Scrolls to element by ID
 * @param {string} id - Element ID
 */
export function scrollToElement(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth'
        });
    }
}
