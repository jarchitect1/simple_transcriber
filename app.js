/**
 * Audio Transcription & AI Processor
 * Main application JavaScript file
 */

console.log('DEBUG: Script started loading');

// Application state and configuration
const AppConfig = {
    DEBUG: true,
    STORAGE_KEY: 'transcriberSettings',
    STATUS_TIMEOUT: 5000
};

// DOM Elements cache
const elements = {};

// Application initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('DEBUG: DOM Content Loaded');
    
    // Initialize DOM elements cache
    initializeElements();
    
    // Load user settings
    loadSettings();
    
    // Check API keys and redirect if needed
    if (!validateApiKeys()) {
        return;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Update initial button states
    updateButtonStates();
    
    console.log('DEBUG: Script initialization completed');
});

/**
 * Initialize DOM elements cache
 */
function initializeElements() {
    const elementIds = [
        'audioFile', 'language', 'diarize', 'transcribeBtn', 'transcribeStatus',
        'transcription', 'copyTranscription', 'proofreadBtn', 'minutesBtn',
        'summaryBtn', 'outlineBtn', 'processStatus', 'processedText',
        'copyProcessed', 'processedTextViewer', 'fileName', 'dropZone'
    ];
    
    elementIds.forEach(id => {
        elements[id] = document.getElementById(id);
        if (!elements[id]) {
            console.warn(`Element with ID '${id}' not found`);
        }
    });
}

/**
 * Load settings from localStorage
 */
function loadSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem(AppConfig.STORAGE_KEY) || '{}');
        
        if (elements.language) {
            elements.language.value = settings.language || 'auto';
        }
        
        if (elements.diarize) {
            elements.diarize.checked = settings.diarize || false;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Validate API keys and redirect if missing
 */
function validateApiKeys() {
    try {
        const settings = JSON.parse(localStorage.getItem(AppConfig.STORAGE_KEY) || '{}');
        
        if (!settings['FW-apiKey'] || !settings['Opn-apiKey']) {
            alert('API keys are not set. You will be redirected to the settings page.');
            window.location.href = 'settings.html';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error validating API keys:', error);
        return false;
    }
}

/**
 * Update button states based on current conditions
 */
function updateButtonStates() {
    try {
        const hasAudio = elements.audioFile?.files?.length > 0;
        const hasTranscription = elements.transcription?.value?.trim().length > 0;
        const settings = JSON.parse(localStorage.getItem(AppConfig.STORAGE_KEY) || '{}');
        
        const hasFwApiKey = settings && settings['FW-apiKey'];
        const hasOpnApiKey = settings && settings['Opn-apiKey'];
        
        // Update transcribe button
        if (elements.transcribeBtn) {
            elements.transcribeBtn.disabled = !(hasFwApiKey && hasAudio);
        }
        
        // Update processing buttons
        const processingButtons = ['proofreadBtn', 'minutesBtn', 'summaryBtn', 'outlineBtn'];
        processingButtons.forEach(btnId => {
            if (elements[btnId]) {
                elements[btnId].disabled = !(hasOpnApiKey && hasTranscription);
            }
        });
        
        // Update copy processed button
        if (elements.copyProcessed) {
            elements.copyProcessed.disabled = !elements.processedText?.value?.trim();
        }
    } catch (error) {
        console.error('Error updating button states:', error);
    }
}

/**
 * Show status message with auto-hide
 */
function showStatus(element, message, type) {
    if (!element) return;
    
    element.textContent = message;
    element.className = `status ${type}`;
    element.setAttribute('aria-live', 'polite');
    
    setTimeout(() => {
        element.textContent = '';
        element.className = 'status';
    }, AppConfig.STATUS_TIMEOUT);
}

/**
 * Copy text to clipboard utility function
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert('Text copied to clipboard!');
    } catch (error) {
        console.error('Copy failed:', error);
        alert('Failed to copy text to clipboard.');
    }
}

/**
 * Transcribe audio using Whisper API
 */
async function transcribeAudio(file) {
    if (!file) return;
    
    showStatus(elements.transcribeStatus, 'Transcribing audio...', 'processing');
    
    try {
        const settings = JSON.parse(localStorage.getItem(AppConfig.STORAGE_KEY) || '{}');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', settings['FW-model'] || 'whisper-1');
        
        if (elements.language.value !== 'auto') {
            formData.append('language', elements.language.value);
        }
        
        if (elements.diarize.checked) {
            formData.append('diarize', 'true');
            formData.append('response_format', 'verbose_json');
            formData.append('timestamp_granularities[]', 'word,segment');
        }
        
        const response = await fetch(settings['FW-apiUrl'] + "/audio/transcriptions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings['FW-apiKey']}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (elements.diarize.checked && result.segments) {
            elements.transcription.value = formatDiarizedText(result.segments);
        } else {
            elements.transcription.value = result.text || '';
        }
        
        showStatus(elements.transcribeStatus, 'Transcription completed!', 'success');
        updateButtonStates();
        
    } catch (error) {
        console.error('Transcription error:', error);
        showStatus(elements.transcribeStatus, `Error: ${error.message}`, 'error');
    }
}

/**
 * Format diarized text with speaker labels
 */
function formatDiarizedText(segments) {
    if (!segments || segments.length === 0) return '';

    let formattedText = '';
    let currentSpeaker = null;
    let currentText = '';

    segments.forEach(segment => {
        const speaker = segment.speaker_id || 'Unknown';
        if (speaker !== currentSpeaker) {
            if (currentSpeaker) {
                formattedText += `\n\n${currentSpeaker}: ${currentText.trim()}`;
            }
            currentSpeaker = speaker;
            currentText = '';
        }
        currentText += `${segment.text} `;
    });

    if (currentSpeaker) {
        formattedText += `\n\n${currentSpeaker}: ${currentText.trim()}`;
    }

    return formattedText.trim();
}

/**
 * Convert Markdown to HTML
 */
function markdownToHtml(markdown) {
    if (!markdown) {
        return '<div class="placeholder">Processed text will appear here...</div>';
    }
    
    let html = markdown;
    
    // Headers
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    
    // Bold and italic
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    
    // Lists
    const lines = html.split('\n');
    let inList = false;
    let inOrderedList = false;
    const output = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Unordered list item
        if (/^\s*[-*]\s+(.*)$/.test(line)) {
            if (!inList) {
                output.push('<ul>');
                inList = true;
            }
            output.push('<li>' + line.replace(/^\s*[-*]\s+(.*)$/, '$1') + '</li>');
        }
        // Ordered list item
        else if (/^\s*\d+\.\s+(.*)$/.test(line)) {
            if (!inOrderedList) {
                output.push('<ol>');
                inOrderedList = true;
            }
            output.push('<li>' + line.replace(/^\s*\d+\.\s+(.*)$/, '$1') + '</li>');
        }
        // Non-list line
        else {
            if (inList) {
                output.push('</ul>');
                inList = false;
            }
            if (inOrderedList) {
                output.push('</ol>');
                inOrderedList = false;
            }
            output.push(line);
        }
    }
    
    // Close any remaining lists
    if (inList) output.push('</ul>');
    if (inOrderedList) output.push('</ol>');
    
    return output.join('\n');
}

/**
 * Process text with AI
 */
async function processText(action) {
    if (!elements.transcription?.value?.trim()) return;
    
    showStatus(elements.processStatus, 'Processing text...', 'processing');
    
    try {
        const settings = JSON.parse(localStorage.getItem(AppConfig.STORAGE_KEY) || '{}');
        const text = elements.transcription.value;
        
        // Default prompts
        const defaultPrompts = {
            proofread: "Proofread and correct this text. Fix grammar, punctuation, and spelling. Keep the meaning the same. Make it clear, concise, and coherent.",
            minutes: "Convert the transcript into meeting minutes. Structure the minutes with a clear agenda, discussion points, decisions, and action items. Use bullet points.",
            summary: "Summarize the transcript. Capture the main points, key arguments, and conclusions. Keep it brief and to the point.",
            outline: "Create a structured outline from the transcript. Break down the content into sections, subsections, and bullet points. Include headings and subheadings."
        };
        
        const promptText = settings[action] || defaultPrompts[action];
        
        const response = await fetch(settings['Opn-apiUrl'] + "/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings['Opn-apiKey']}`
            },
            body: JSON.stringify({
                model: settings['Opn-model'] || 'gpt-3.5-turbo',
                messages: [
                    { role: "system", content: promptText },
                    { role: "user", content: text }
                ],
                temperature: 0.2
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        const processedText = result.choices[0].message.content;
        
        elements.processedText.value = processedText;
        elements.processedTextViewer.innerHTML = markdownToHtml(processedText);
        
        showStatus(elements.processStatus, `Text ${action} completed!`, 'success');
        updateButtonStates();
        
    } catch (error) {
        console.error('Processing error:', error);
        showStatus(elements.processStatus, `Error: ${error.message}`, 'error');
    }
}

/**
 * Extract plain text from Markdown
 */
function extractMarkdownText(markdown) {
    if (!markdown) return '';

    const markdownHtml = markdownToHtml(markdown);
    const container = document.createElement('div');
    container.innerHTML = markdownHtml;
    
    const textElements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, pre, code, li, ul, ol');
    let plainText = '';
    
    textElements.forEach(element => {
        plainText += element.textContent.trim() + '\n';
        
        if (['LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P'].includes(element.tagName)) {
            plainText += '\n';
        }
    });

    return plainText.replace(/(\r?\n){2,}/g, '\n').trim();
}

/**
 * Copy rich text to clipboard
 */
async function copyRichTextToClipboard(markdownContent) {
    const htmlContent = markdownToHtml(markdownContent);
    const plainTextFallback = extractMarkdownText(markdownContent);
    
    try {
        if (navigator.clipboard && navigator.clipboard.write) {
            const clipboardItem = new ClipboardItem({
                'text/html': new Blob([htmlContent], { type: 'text/html' }),
                'text/plain': new Blob([plainTextFallback], { type: 'text/plain' })
            });
            
            await navigator.clipboard.write([clipboardItem]);
            alert('Rich text copied! You can paste it into Word or other word processors.');
        } else {
            await fallbackCopyRichText(htmlContent, plainTextFallback);
        }
    } catch (error) {
        console.error('Rich text copy failed:', error);
        await fallbackCopyRichText(htmlContent, plainTextFallback);
    }
}

/**
 * Fallback method for copying rich text
 */
async function fallbackCopyRichText(htmlContent, plainTextFallback) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);
    
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    selection.removeAllRanges();
    selection.addRange(range);
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            alert('Rich text copied! You can paste it into Word or other word processors.');
        } else {
            throw new Error('execCommand failed');
        }
    } catch (error) {
        console.error('Fallback copy failed:', error);
        try {
            await navigator.clipboard.writeText(plainTextFallback);
            alert('Copied as plain text (rich text copying not supported on this browser).');
        } catch (e) {
            console.error('All copy methods failed:', e);
            alert('Failed to copy text.');
        }
    } finally {
        document.body.removeChild(tempDiv);
        selection.removeAllRanges();
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // File input handler
    if (elements.audioFile) {
        elements.audioFile.addEventListener('change', handleFileChange);
    }
    
    // Drag and drop handlers
    if (elements.dropZone) {
        setupDragAndDrop();
    }
    
    // Transcription input handler
    if (elements.transcription) {
        elements.transcription.addEventListener('input', updateButtonStates);
    }
    
    // Button event handlers
    setupButtonHandlers();
}

/**
 * Handle file input change
 */
function handleFileChange(event) {
    const fileName = event.target.files.length > 0 
        ? event.target.files[0].name 
        : 'No file chosen';
    
    if (elements.fileName) {
        elements.fileName.textContent = fileName;
    }
    
    updateButtonStates();
}

/**
 * Setup drag and drop functionality
 */
function setupDragAndDrop() {
    const dropZone = elements.dropZone;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragging'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragging'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    
    // Add keyboard support for drop zone
    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            elements.audioFile?.click();
        }
    });
}

/**
 * Handle file drop
 */
function handleDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length && elements.audioFile) {
        elements.audioFile.files = files;
        elements.fileName.textContent = files[0].name;
        updateButtonStates();
    }
}

/**
 * Setup button event handlers
 */
function setupButtonHandlers() {
    // Transcribe button
    if (elements.transcribeBtn) {
        elements.transcribeBtn.addEventListener('click', async () => {
            if (elements.audioFile?.files?.length > 0) {
                await transcribeAudio(elements.audioFile.files[0]);
            }
        });
    }
    
    // Copy transcription button
    if (elements.copyTranscription) {
        elements.copyTranscription.addEventListener('click', () => {
            copyToClipboard(elements.transcription.value);
        });
    }
    
    // Copy processed text button
    if (elements.copyProcessed) {
        elements.copyProcessed.addEventListener('click', () => {
            copyRichTextToClipboard(elements.processedText.value);
        });
    }
    
    // Processing action buttons
    const processActions = {
        proofreadBtn: 'proofread',
        minutesBtn: 'minutes',
        summaryBtn: 'summary',
        outlineBtn: 'outline'
    };
    
    for (const [btnId, action] of Object.entries(processActions)) {
        if (elements[btnId]) {
            elements[btnId].addEventListener('click', () => processText(action));
        }
    }
}

