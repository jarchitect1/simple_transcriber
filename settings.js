/**
 * Settings Page JavaScript
 * Handles configuration management for the Audio Transcription & AI Processor PWA
 */

console.log('DEBUG: Settings script started loading');

// Application configuration
const SettingsConfig = {
    DEBUG: true,
    STORAGE_KEY: 'transcriberSettings',
    STATUS_TIMEOUT: 5000,
    DEFAULT_VALUES: {
        'FW-model': 'whisper-v3-turbo',
        'FW-apiUrl': 'https://audio-turbo.us-virginia-1.direct.fireworks.ai/v1',
        'Opn-model': 'google/gemini-2.5-flash',
        'Opn-apiUrl': 'https://openrouter.ai/api/v1',
        'language': 'auto',
        'diarize': false,
        'proofread': 'Proofread and correct this text. Fix grammar, punctuation, and spelling. Keep the meaning the same. Make it clear, concise, and coherent.',
        'minutes': 'Convert the transcript into meeting minutes. Structure the minutes with a clear agenda, discussion points, decisions, and action items. Use bullet points.',
        'summary': 'Summarize the transcript. Capture the main points, key arguments, and conclusions. Keep it brief and to the point.',
        'outline': 'Create a structured outline from the transcript. Break down the content into sections, subsections, and bullet points. Include headings and subheadings.'
    }
};

// DOM Elements cache
const elements = {};

// Application initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('DEBUG: Settings DOM Content Loaded');
    
    // Initialize DOM elements cache
    initializeElements();
    
    // Load saved settings
    loadSettings();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup form validation
    setupFormValidation();
    
    console.log('DEBUG: Settings initialization completed');
});

/**
 * Initialize DOM elements cache
 */
function initializeElements() {
    const elementIds = [
        'FW-apiKey', 'FW-model', 'FW-apiUrl',
        'Opn-apiKey', 'Opn-model', 'Opn-apiUrl',
        'language', 'diarize',
        'proofread', 'minutes', 'summary', 'outline',
        'saveSettings', 'settingsStatus', 'settingsForm',
        'importSettings', 'exportSettings', 'importFile'
    ];
    
    elementIds.forEach(id => {
        elements[id] = document.getElementById(id);
        if (!elements[id]) {
            console.warn(`Element with ID '${id}' not found`);
        }
    });
}

/**
 * Load settings from localStorage and populate form fields
 */
function loadSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem(SettingsConfig.STORAGE_KEY) || '{}');
        
        // Load all settings with fallback to defaults
        Object.keys(SettingsConfig.DEFAULT_VALUES).forEach(key => {
            const element = elements[key];
            if (!element) return;
            
            const value = settings[key] !== undefined ? settings[key] : SettingsConfig.DEFAULT_VALUES[key];
            
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else {
                element.value = value;
            }
        });
        
        // Load API keys (no defaults for security)
        if (elements['FW-apiKey']) {
            elements['FW-apiKey'].value = settings['FW-apiKey'] || '';
        }
        if (elements['Opn-apiKey']) {
            elements['Opn-apiKey'].value = settings['Opn-apiKey'] || '';
        }
        
        console.log('DEBUG: Settings loaded successfully');
    } catch (error) {
        console.error('Error loading settings:', error);
        showStatus('Error loading settings. Using defaults.', 'error');
    }
}

/**
 * Save settings to localStorage
 */
function saveSettings(event) {
    if (event) {
        event.preventDefault();
    }
    
    try {
        // Validate required fields
        if (!validateRequiredFields()) {
            return;
        }
        
        const settings = {};
        
        // Collect all form values
        Object.keys(SettingsConfig.DEFAULT_VALUES).forEach(key => {
            const element = elements[key];
            if (!element) return;
            
            if (element.type === 'checkbox') {
                settings[key] = element.checked;
            } else {
                settings[key] = element.value.trim();
            }
        });
        
        // Add API keys
        if (elements['FW-apiKey']) {
            settings['FW-apiKey'] = elements['FW-apiKey'].value.trim();
        }
        if (elements['Opn-apiKey']) {
            settings['Opn-apiKey'] = elements['Opn-apiKey'].value.trim();
        }
        
        // Save to localStorage
        localStorage.setItem(SettingsConfig.STORAGE_KEY, JSON.stringify(settings));
        
        showStatus('Settings saved successfully!', 'success');
        console.log('DEBUG: Settings saved successfully');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Error saving settings. Please try again.', 'error');
    }
}

/**
 * Validate required fields
 */
function validateRequiredFields() {
    const requiredFields = ['FW-apiKey', 'Opn-apiKey'];
    let isValid = true;
    
    requiredFields.forEach(fieldId => {
        const element = elements[fieldId];
        if (!element) return;
        
        const value = element.value.trim();
        const wrapper = element.closest('.form-group');
        
        if (!value) {
            isValid = false;
            element.setAttribute('aria-invalid', 'true');
            wrapper?.classList.add('error');
            
            // Add error message if not already present
            if (!wrapper?.querySelector('.error-message')) {
                const errorMsg = document.createElement('div');
                errorMsg.className = 'error-message';
                errorMsg.textContent = 'This field is required';
                errorMsg.setAttribute('role', 'alert');
                wrapper?.appendChild(errorMsg);
            }
        } else {
            element.setAttribute('aria-invalid', 'false');
            wrapper?.classList.remove('error');
            
            // Remove error message
            const errorMsg = wrapper?.querySelector('.error-message');
            if (errorMsg) {
                errorMsg.remove();
            }
        }
    });
    
    if (!isValid) {
        showStatus('Please fill in all required fields.', 'error');
    }
    
    return isValid;
}

/**
 * Show status message with auto-hide
 */
function showStatus(message, type) {
    if (!elements.settingsStatus) return;
    
    elements.settingsStatus.textContent = message;
    elements.settingsStatus.className = `status ${type}`;
    elements.settingsStatus.setAttribute('aria-live', 'polite');
    
    // Auto-hide after timeout
    setTimeout(() => {
        elements.settingsStatus.textContent = '';
        elements.settingsStatus.className = 'status';
    }, SettingsConfig.STATUS_TIMEOUT);
}

/**
 * Export settings to JSON file
 */
function exportSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem(SettingsConfig.STORAGE_KEY) || '{}');
        
        // Create sanitized version for export (remove sensitive data if needed)
        const exportData = { ...settings };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "transcriber-settings.json");
        downloadAnchor.style.display = 'none';
        
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
        
        showStatus('Settings exported successfully!', 'success');
        console.log('DEBUG: Settings exported');
        
    } catch (error) {
        console.error('Error exporting settings:', error);
        showStatus('Error exporting settings.', 'error');
    }
}

/**
 * Import settings from JSON file
 */
function importSettings() {
    if (elements.importFile) {
        elements.importFile.click();
    }
}

/**
 * Handle imported file
 */
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
        showStatus('Please select a valid JSON file.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const settings = JSON.parse(e.target.result);
            
            // Validate imported settings structure
            if (typeof settings !== 'object' || settings === null) {
                throw new Error('Invalid settings format');
            }
            
            // Save imported settings
            localStorage.setItem(SettingsConfig.STORAGE_KEY, JSON.stringify(settings));
            
            // Reload form with imported settings
            loadSettings();
            
            showStatus('Settings imported successfully!', 'success');
            console.log('DEBUG: Settings imported');
            
        } catch (error) {
            console.error('Error importing settings:', error);
            showStatus('Error: Invalid settings file format.', 'error');
        }
    };
    
    reader.onerror = function() {
        showStatus('Error reading file.', 'error');
    };
    
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
}

/**
 * Toggle password visibility
 */
function togglePasswordVisibility(button) {
    const input = button.previousElementSibling;
    if (!input) return;
    
    const isPassword = input.getAttribute('type') === 'password';
    const newType = isPassword ? 'text' : 'password';
    
    input.setAttribute('type', newType);
    button.textContent = isPassword ? '🙈' : '👁️';
    button.setAttribute('aria-label', 
        isPassword ? 'Hide password' : 'Show password'
    );
}

/**
 * Setup form validation
 */
function setupFormValidation() {
    // Real-time validation for required fields
    const requiredFields = ['FW-apiKey', 'Opn-apiKey'];
    
    requiredFields.forEach(fieldId => {
        const element = elements[fieldId];
        if (!element) return;
        
        element.addEventListener('blur', () => {
            validateField(element);
        });
        
        element.addEventListener('input', () => {
            // Clear error state on input
            const wrapper = element.closest('.form-group');
            if (wrapper?.classList.contains('error')) {
                element.setAttribute('aria-invalid', 'false');
                wrapper.classList.remove('error');
                
                const errorMsg = wrapper.querySelector('.error-message');
                if (errorMsg) {
                    errorMsg.remove();
                }
            }
        });
    });
}

/**
 * Validate individual field
 */
function validateField(element) {
    const value = element.value.trim();
    const wrapper = element.closest('.form-group');
    const isRequired = element.hasAttribute('required');
    
    if (isRequired && !value) {
        element.setAttribute('aria-invalid', 'true');
        wrapper?.classList.add('error');
        
        if (!wrapper?.querySelector('.error-message')) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'This field is required';
            errorMsg.setAttribute('role', 'alert');
            wrapper?.appendChild(errorMsg);
        }
        return false;
    }
    
    element.setAttribute('aria-invalid', 'false');
    wrapper?.classList.remove('error');
    
    const errorMsg = wrapper?.querySelector('.error-message');
    if (errorMsg) {
        errorMsg.remove();
    }
    
    return true;
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Form submission
    if (elements.settingsForm) {
        elements.settingsForm.addEventListener('submit', saveSettings);
    }
    
    // Save button (fallback)
    if (elements.saveSettings) {
        elements.saveSettings.addEventListener('click', saveSettings);
    }
    
    // Import/Export buttons
    if (elements.exportSettings) {
        elements.exportSettings.addEventListener('click', exportSettings);
    }
    
    if (elements.importSettings) {
        elements.importSettings.addEventListener('click', importSettings);
    }
    
    if (elements.importFile) {
        elements.importFile.addEventListener('change', handleFileImport);
    }
    
    // Password toggle buttons
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => togglePasswordVisibility(btn));
        
        // Keyboard support
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePasswordVisibility(btn);
            }
        });
    });
    
    // Auto-save on certain field changes (optional)
    const autoSaveFields = ['language', 'diarize'];
    autoSaveFields.forEach(fieldId => {
        const element = elements[fieldId];
        if (element) {
            element.addEventListener('change', () => {
                // Debounce auto-save
                clearTimeout(element._autoSaveTimeout);
                element._autoSaveTimeout = setTimeout(() => {
                    if (validateRequiredFields()) {
                        saveSettings();
                    }
                }, 1000);
            });
        }
    });
}

/**
 * Reset settings to defaults
 */
function resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
        try {
            // Clear localStorage
            localStorage.removeItem(SettingsConfig.STORAGE_KEY);
            
            // Reload form with defaults
            loadSettings();
            
            showStatus('Settings reset to defaults.', 'success');
            console.log('DEBUG: Settings reset to defaults');
            
        } catch (error) {
            console.error('Error resetting settings:', error);
            showStatus('Error resetting settings.', 'error');
        }
    }
}

// Export functions for potential external use
window.SettingsManager = {
    loadSettings,
    saveSettings,
    exportSettings,
    importSettings,
    resetToDefaults
};