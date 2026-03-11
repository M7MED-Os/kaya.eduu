/**
 * Form Validation Utilities
 * Centralized validation logic for consistent error messages
 */

/**
 * Validates an email address
 * @param {string} email - Email to validate
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validateEmail(email) {
    if (!email || !email.trim()) {
        return { isValid: false, error: 'اكتب إيميلك' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, error: 'اكتب إيميل صح (مثال: name@gmail.com)' };
    }

    return { isValid: true, error: null };
}

/**
 * Validates a password
 * @param {string} password - Password to validate
 * @param {number} minLength - Minimum password length (default: 6)
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validatePassword(password, minLength = 6) {
    if (!password) {
        return { isValid: false, error: 'اكتب كلمة السر' };
    }

    if (password.length < minLength) {
        return { isValid: false, error: `كلمة السر لازم تكون ${minLength} حروف على الأقل` };
    }

    return { isValid: true, error: null };
}

/**
 * Validates password confirmation
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validatePasswordConfirmation(password, confirmPassword) {
    if (!confirmPassword) {
        return { isValid: false, error: 'أكد كلمة السر' };
    }

    if (password !== confirmPassword) {
        return { isValid: false, error: 'كلمة السر غير متطابقة' };
    }

    return { isValid: true, error: null };
}

/**
 * Validates a required text field
 * @param {string} value - Value to validate
 * @param {string} fieldName - Name of the field (for error message)
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validateRequired(value, fieldName) {
    if (!value || !value.trim()) {
        return { isValid: false, error: `${fieldName} مطلوب` };
    }

    return { isValid: true, error: null };
}

/**
 * Validates a select/dropdown field
 * @param {string} value - Selected value
 * @param {string} fieldName - Name of the field (for error message)
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validateSelect(value, fieldName) {
    if (!value) {
        return { isValid: false, error: `اختار ${fieldName}` };
    }

    return { isValid: true, error: null };
}

/**
 * Validates a full name (at least 2 words)
 * @param {string} name - Name to validate
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validateFullName(name) {
    if (!name || !name.trim()) {
        return { isValid: false, error: 'اكتب اسمك بالكامل' };
    }

    // Check if name has at least 2 words
    const words = name.trim().split(/\s+/);
    if (words.length < 2) {
        return { isValid: false, error: 'اكتب الاسم بالكامل (الاسم الأول والأخير على الأقل)' };
    }

    return { isValid: true, error: null };
}

/**
 * Generic form validator
 * Validates multiple fields at once
 * @param {Array<{input: HTMLElement, validator: Function}>} fields - Array of field objects
 * @param {Function} showError - Function to show error (e.g., showInputError)
 * @returns {boolean} - true if all valid, false otherwise
 */
export function validateForm(fields, showError) {
    let isValid = true;

    fields.forEach(({ input, validator }) => {
        const result = validator(input.value);

        if (!result.isValid) {
            showError(input, result.error);
            isValid = false;
        }
    });

    return isValid;
}
