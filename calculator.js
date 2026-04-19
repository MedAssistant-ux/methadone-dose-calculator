/**
 * Methadone Dose Calculator
 * Calculates restart doses based on missed dosing days
 */

// ===== Dose Reduction Tables =====
const DOSE_REDUCTIONS = {
    // [daysAbsent]: reduction amount
    '30-100': { 2: 5, 3: 10, 4: 15, 5: 20, 6: 25 },
    '101-150': { 2: 10, 3: 20, 4: 30, 5: 40, 6: 50 },
    '151-200': { 2: 15, 3: 30, 4: 45, 5: 60, 6: 75 },
    '201-250': { 2: 20, 3: 40, 4: 60, 5: 80, 6: 100 },
    '251-300': { 2: 25, 3: 50, 4: 75, 5: 100, 6: 125 }
};

// ===== Storage Key =====
const HISTORY_KEY = 'methadone_calc_history';

// Valid status values for class attribute sanitization
const VALID_STATUSES = ['success', 'warning', 'danger', 'info'];

// Status icons shared between result display and history
const STATUS_ICONS = {
    success: '\u2713',
    warning: '\u26A0',
    danger: '\u2695',
    info: '\u2192'
};

// ===== DOM Elements =====
const form = document.getElementById('calculatorForm');
const lastDoseInput = document.getElementById('lastDose');
const daysAbsentInput = document.getElementById('daysAbsent');
const resultContainer = document.getElementById('resultContainer');
const resultCard = document.getElementById('resultCard');
const resultIcon = document.getElementById('resultIcon');
const resultLabel = document.getElementById('resultLabel');
const resultValue = document.getElementById('resultValue');
const resultDetails = document.getElementById('resultDetails');
const resultWarning = document.getElementById('resultWarning');
const clearFormBtn = document.getElementById('clearFormBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// ===== Utility Functions =====

/**
 * Escapes a string for safe HTML interpolation
 * @param {*} value - Value to escape
 * @returns {string} - HTML-safe string
 */
function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
}

// ===== Inline Validation =====

/**
 * Shows an inline error message below an input
 * @param {HTMLInputElement} input - The input element
 * @param {string} message - Error message to display
 */
function showError(input, message) {
    const group = input.closest('.input-group');
    group.classList.add('has-error');
    const errorEl = group.querySelector('.input-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
    input.setAttribute('aria-invalid', 'true');
}

/**
 * Clears the error state from an input
 * @param {HTMLInputElement} input - The input element
 */
function clearError(input) {
    const group = input.closest('.input-group');
    group.classList.remove('has-error');
    const errorEl = group.querySelector('.input-error');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
    input.removeAttribute('aria-invalid');
}

/**
 * Clears all validation errors
 */
function clearAllErrors() {
    clearError(lastDoseInput);
    clearError(daysAbsentInput);
}

// ===== Core Calculation Logic =====

/**
 * Determines the dose range key for lookup.
 * Uses continuous ranges (no gaps between boundaries) so fractional
 * doses like 100.5mg map correctly.
 * @param {number} dose - The last verified dose in mg
 * @returns {string|null} - The dose range key or null if out of range
 */
function getDoseRangeKey(dose) {
    if (dose >= 30 && dose <= 100) return '30-100';
    if (dose > 100 && dose <= 150) return '101-150';
    if (dose > 150 && dose <= 200) return '151-200';
    if (dose > 200 && dose <= 250) return '201-250';
    if (dose > 250 && dose <= 300) return '251-300';
    return null;
}

/**
 * Calculates the restart dose based on the algorithm
 * @param {number} lastDose - Last verified dose in mg
 * @param {number} daysAbsent - Consecutive days absent
 * @returns {Object} - Result object with dose, status, and messages
 */
function calculateRestartDose(lastDose, daysAbsent) {
    const result = {
        originalDose: lastDose,
        daysAbsent: daysAbsent,
        restartDose: null,
        reduction: 0,
        status: 'success',
        message: '',
        details: '',
        showVerificationReminder: false
    };

    // Rule: If dose > 300mg
    if (lastDose > 300) {
        if (daysAbsent === 1) {
            result.restartDose = lastDose;
            result.status = 'info';
            result.message = `${lastDose} mg`;
            result.details = 'No dose change for 1 day absent (dose > 300mg)';
        } else {
            result.status = 'danger';
            result.message = 'SEE PROVIDER';
            result.details = `Dose > 300mg with ${daysAbsent} days absent requires provider evaluation`;
        }
        return result;
    }

    // Rule: If 1 day absent - no change
    if (daysAbsent === 1) {
        result.restartDose = lastDose;
        result.status = 'info';
        result.message = `${lastDose} mg`;
        result.details = 'No dose change for 1 day absent';
        return result;
    }

    // Rule: If 7+ days absent - see provider
    if (daysAbsent >= 7) {
        result.status = 'danger';
        result.message = 'SEE PROVIDER';
        result.details = `${daysAbsent} consecutive days absent requires provider evaluation`;
        return result;
    }

    // Rule: 2-6 days absent - apply reduction table
    if (daysAbsent >= 2 && daysAbsent <= 6) {
        // Handle doses under 30mg
        if (lastDose < 30) {
            result.status = 'danger';
            result.message = 'SEE PROVIDER';
            result.details = 'Dose under 30mg requires provider evaluation for any adjustment';
            return result;
        }

        const rangeKey = getDoseRangeKey(lastDose);

        if (rangeKey && DOSE_REDUCTIONS[rangeKey]) {
            const reduction = DOSE_REDUCTIONS[rangeKey][daysAbsent];
            result.reduction = reduction;
            const calculatedDose = lastDose - reduction;

            // Rule: If calculated result < 30mg - see provider
            if (calculatedDose < 30) {
                result.status = 'danger';
                result.message = 'SEE PROVIDER';
                result.details = `Calculated dose (${calculatedDose}mg) is below 30mg threshold`;
                return result;
            }

            result.restartDose = calculatedDose;
            result.details = `${lastDose}mg \u2212 ${reduction}mg reduction = ${calculatedDose}mg`;

            // Rule: If result < 50mg - show verification reminder
            if (calculatedDose < 50) {
                result.status = 'warning';
                result.message = `${calculatedDose} mg`;
                result.showVerificationReminder = true;
            } else {
                result.status = 'success';
                result.message = `${calculatedDose} mg`;
            }
        } else {
            result.status = 'danger';
            result.message = 'SEE PROVIDER';
            result.details = 'Dose outside standard ranges \u2014 consult provider';
        }
    }

    return result;
}

// ===== UI Functions =====

/**
 * Displays the calculation result
 * @param {Object} result - The calculation result object
 */
function displayResult(result) {
    // Set card status class
    resultCard.className = 'result-card ' + result.status;

    // Set icon based on status
    resultIcon.textContent = STATUS_ICONS[result.status] || '\u2022';

    // Set label based on status
    const labels = {
        success: 'Restart Dose',
        warning: 'Restart Dose - Verify',
        danger: 'Action Required',
        info: 'Restart Dose'
    };
    resultLabel.textContent = labels[result.status] || 'Result';

    // Set value and details
    resultValue.textContent = result.message;
    resultDetails.textContent = result.details;

    // Show/hide verification reminder
    if (result.showVerificationReminder) {
        resultWarning.textContent = '';
        const strong = document.createElement('strong');
        strong.textContent = '\u26A0 Verification Required: ';
        resultWarning.appendChild(strong);
        resultWarning.appendChild(document.createTextNode(
            'Restart dose is below 50mg. Please verify appropriateness against patient\u2019s previous stable dose and initiation/induction dose. Contact provider if there is any discrepancy.'
        ));
        resultWarning.classList.remove('hidden');
    } else {
        resultWarning.classList.add('hidden');
    }

    // Show result container and clear button
    resultContainer.classList.remove('hidden');
    clearFormBtn.classList.remove('hidden');

    // Move focus to result for keyboard/screen reader users
    resultCard.focus();
}

/**
 * Clears the form and result display
 */
function clearForm() {
    form.reset();
    clearAllErrors();
    resultContainer.classList.add('hidden');
    clearFormBtn.classList.add('hidden');
    lastDoseInput.focus();
}

// ===== History Functions =====

/**
 * Loads history from localStorage
 * @returns {Array} - Array of history items
 */
function loadHistory() {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error loading history:', e);
        return [];
    }
}

/**
 * Saves history to localStorage
 * @param {Array} history - Array of history items
 */
function saveHistory(history) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.error('Error saving history:', e);
    }
}

/**
 * Adds a calculation to history.
 * Skips duplicate entries if the most recent calculation has identical inputs/output.
 * @param {Object} result - The calculation result
 */
function addToHistory(result) {
    const history = loadHistory();

    // Skip duplicate if identical to most recent entry
    if (history.length > 0) {
        const last = history[0];
        if (last.originalDose === result.originalDose &&
            last.daysAbsent === result.daysAbsent &&
            last.message === result.message) {
            return;
        }
    }

    const historyItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        originalDose: result.originalDose,
        daysAbsent: result.daysAbsent,
        restartDose: result.restartDose,
        reduction: result.reduction,
        status: result.status,
        message: result.message
    };

    history.unshift(historyItem);

    if (history.length > 50) {
        history.pop();
    }

    saveHistory(history);
    renderHistory(history);
}

/**
 * Formats a timestamp for display
 * @param {string} isoString - ISO timestamp string
 * @returns {string} - Formatted date/time string
 */
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Renders the history list with escaped values.
 * Accepts optional pre-loaded history to avoid redundant localStorage reads.
 * @param {Array} [historyData] - Pre-loaded history array (optional)
 */
function renderHistory(historyData) {
    const history = historyData || loadHistory();

    if (history.length === 0) {
        historyList.innerHTML = '<p class="history-empty">No calculations yet</p>';
        return;
    }

    historyList.innerHTML = history.map(item => {
        // Sanitize status to a known value for use in class attribute
        const safeStatus = VALID_STATUSES.includes(item.status) ? item.status : '';
        const icon = escapeHTML(STATUS_ICONS[item.status] || '\u2022');
        const msg = escapeHTML(item.message);
        const time = escapeHTML(formatTimestamp(item.timestamp));
        const dose = escapeHTML(item.originalDose);
        const days = escapeHTML(item.daysAbsent);
        const dayLabel = item.daysAbsent !== 1 ? 's' : '';
        const reduction = item.reduction > 0
            ? ` (\u2212${escapeHTML(item.reduction)}mg)`
            : '';

        return `
            <div class="history-item ${safeStatus}">
                <div class="history-item-header">
                    <span class="history-item-result"><span class="history-status-icon" aria-hidden="true">${icon}</span> ${msg}</span>
                    <span class="history-item-time">${time}</span>
                </div>
                <div class="history-item-details">
                    ${dose}mg dose, ${days} day${dayLabel} absent${reduction}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Clears all history
 */
function clearHistory() {
    if (confirm('Clear all calculation history?')) {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory([]);
    }
}

// ===== Event Listeners =====

form.addEventListener('submit', function(e) {
    e.preventDefault();
    clearAllErrors();

    // Round to nearest integer to match clinical dose table ranges
    const lastDose = Math.round(parseFloat(lastDoseInput.value));
    const daysAbsent = parseInt(daysAbsentInput.value, 10);

    let hasError = false;

    if (isNaN(lastDose) || lastDose <= 0) {
        showError(lastDoseInput, 'Enter a valid dose (positive number)');
        hasError = true;
    }

    if (isNaN(daysAbsent) || daysAbsent < 1) {
        showError(daysAbsentInput, 'Enter valid days absent (1 or more)');
        hasError = true;
    }

    if (hasError) return;

    const result = calculateRestartDose(lastDose, daysAbsent);
    displayResult(result);
    addToHistory(result);
});

// Clear inline errors as the user types
lastDoseInput.addEventListener('input', function() { clearError(this); });
daysAbsentInput.addEventListener('input', function() { clearError(this); });

clearFormBtn.addEventListener('click', clearForm);
clearHistoryBtn.addEventListener('click', clearHistory);

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', function() {
    renderHistory();
    lastDoseInput.focus();
});
