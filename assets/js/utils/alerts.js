/**
 * Centralized Alert & Modal System
 * Wraps SweetAlert2 for consistent UX across the application
 */

/**
 * Shows a success alert
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {number} timer - Auto-close timer in ms (optional)
 * @returns {Promise}
 */
export function showSuccessAlert(title, message, timer = null) {
    const config = {
        icon: 'success',
        title: title,
        text: message,
        confirmButtonText: 'حسناً'
    };

    if (timer) {
        config.timer = timer;
        config.showConfirmButton = false;
    }

    return Swal.fire(config);
}

/**
 * Shows an error alert
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @returns {Promise}
 */
export function showErrorAlert(title, message) {
    return Swal.fire({
        icon: 'error',
        title: title,
        text: message,
        confirmButtonText: 'حسناً'
    });
}

/**
 * Shows a warning alert
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @returns {Promise}
 */
export function showWarningAlert(title, message) {
    return Swal.fire({
        icon: 'warning',
        title: title,
        text: message,
        confirmButtonText: 'حسناً'
    });
}

/**
 * Shows an info alert
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @returns {Promise}
 */
export function showInfoAlert(title, message) {
    return Swal.fire({
        icon: 'info',
        title: title,
        text: message,
        confirmButtonText: 'حسناً'
    });
}

/**
 * Shows a confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} confirmText - Confirm button text (default: 'نعم')
 * @param {string} cancelText - Cancel button text (default: 'إلغاء')
 * @returns {Promise<boolean>} - true if confirmed, false if cancelled
 */
export function showConfirmDialog(title, message, confirmText = 'نعم', cancelText = 'إلغاء') {
    return Swal.fire({
        title: title,
        text: message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: confirmText,
        cancelButtonText: cancelText
    }).then(result => result.isConfirmed);
}

/**
 * Shows a delete confirmation dialog
 * @param {string} itemName - Name of item to delete
 * @param {string} warningMessage - Additional warning (optional)
 * @returns {Promise<boolean>}
 */
export function showDeleteConfirmDialog(itemName, warningMessage = null) {
    return Swal.fire({
        title: 'هل أنت متأكد؟',
        text: warningMessage || `سيتم حذف ${itemName} نهائياً ولا يمكن التراجع عن هذا الإجراء!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    }).then(result => result.isConfirmed);
}

/**
 * Shows a loading alert (non-dismissible)
 * @param {string} message - Loading message
 */
export function showLoadingAlert(message = 'جاري التحميل...') {
    Swal.fire({
        title: message,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

/**
 * Closes the current alert
 */
export function closeAlert() {
    Swal.close();
}

/**
 * Shows an input dialog
 * @param {string} title - Dialog title
 * @param {string} inputPlaceholder - Input placeholder text
 * @param {string} inputValue - Default input value
 * @param {Function} inputValidator - Validation function (returns error message or null)
 * @returns {Promise<string|null>} - Input value or null if cancelled
 */
export function showInputDialog(title, inputPlaceholder = '', inputValue = '', inputValidator = null) {
    return Swal.fire({
        title: title,
        input: 'text',
        inputValue: inputValue,
        inputPlaceholder: inputPlaceholder,
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        cancelButtonText: 'إلغاء',
        inputValidator: inputValidator
    }).then(result => {
        if (result.isConfirmed) {
            return result.value;
        }
        return null;
    });
}
