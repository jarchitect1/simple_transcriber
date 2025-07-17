// Quill editor functionality
let isQuillEditorInitialized = false;
let quillEditor = null;

// Initialize Quill editor
function initializeQuillEditor() {
    if (isQuillEditorInitialized) return;
    
    // Initialize Quill with toolbar
    quillEditor = new Quill('#translationResultEditor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'header': [1, 2, 3, false] }],
                [{ 'font': [] }],
                [{ 'size': ['small', false, 'large', 'huge'] }],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'align': [] }],
                ['clean']
            ]
        }
    });
    
    isQuillEditorInitialized = true;
}

// Quill editor helper functions
function clearEditor() {
    if (quillEditor) {
        quillEditor.setText('');
    }
}

function getEditorContent() {
    if (quillEditor) {
        return quillEditor.root.innerHTML;
    }
    return '';
}

function setEditorContent(content) {
    if (quillEditor) {
        quillEditor.root.innerHTML = content;
    }
}

function insertTextAtCursor(text) {
    if (quillEditor) {
        const range = quillEditor.getSelection();
        if (range) {
            quillEditor.insertText(range.index, text);
        } else {
            quillEditor.insertText(quillEditor.getLength(), text);
        }
    }
}

// Buffer for accumulating streamed content for markdown parsing
let contentBuffer = '';

// Parse and insert markdown content as rich text
function insertMarkdownContent(content) {
  if (!quillEditor) return;
  
  // Add content to buffer
  contentBuffer += content;
  
  // Process complete markdown patterns in the buffer
  processMarkdownBuffer();
}

// Process accumulated content buffer for markdown patterns
function processMarkdownBuffer() {
  if (!contentBuffer) return;
  
  let processedUpTo = 0;
  
  // Process content looking for complete markdown patterns
  while (processedUpTo < contentBuffer.length) {
    let foundPattern = false;
    
    // Check for bold (**text**)
    const boldStart = contentBuffer.indexOf('**', processedUpTo);
    if (boldStart !== -1) {
      const boldEnd = contentBuffer.indexOf('**', boldStart + 2);
      if (boldEnd !== -1) {
        // Output text before bold
        const beforeBold = contentBuffer.substring(processedUpTo, boldStart);
        if (beforeBold) appendToEditor(beforeBold);
        
        // Output bold text
        const boldText = contentBuffer.substring(boldStart + 2, boldEnd);
        appendToEditor(boldText, { bold: true });
        
        processedUpTo = boldEnd + 2;
        foundPattern = true;
        continue;
      }
    }
    
    // Check for italic (*text*) - only if not part of bold
    const italicStart = contentBuffer.indexOf('*', processedUpTo);
    if (italicStart !== -1 &&
        (italicStart === 0 || contentBuffer[italicStart - 1] !== '*') &&
        (italicStart + 1 >= contentBuffer.length || contentBuffer[italicStart + 1] !== '*')) {
      const italicEnd = contentBuffer.indexOf('*', italicStart + 1);
      if (italicEnd !== -1) {
        // Output text before italic
        const beforeItalic = contentBuffer.substring(processedUpTo, italicStart);
        if (beforeItalic) appendToEditor(beforeItalic);
        
        // Output italic text
        const italicText = contentBuffer.substring(italicStart + 1, italicEnd);
        appendToEditor(italicText, { italic: true });
        
        processedUpTo = italicEnd + 1;
        foundPattern = true;
        continue;
      }
    }
    
    // Check for headers (# text) at start of line
    const headerStart = contentBuffer.indexOf('#', processedUpTo);
    if (headerStart !== -1 && (headerStart === 0 || contentBuffer[headerStart - 1] === '\n')) {
      let headerLevel = 1;
      let j = headerStart + 1;
      while (j < contentBuffer.length && contentBuffer[j] === '#') {
        headerLevel++;
        j++;
      }
      
      if (j < contentBuffer.length && contentBuffer[j] === ' ') {
        const lineEnd = contentBuffer.indexOf('\n', j);
        if (lineEnd !== -1) {
          // Output text before header
          const beforeHeader = contentBuffer.substring(processedUpTo, headerStart);
          if (beforeHeader) appendToEditor(beforeHeader);
          
          // Output header
          const headerText = contentBuffer.substring(j + 1, lineEnd);
          if (headerText.trim()) {
            appendToEditor(headerText, { header: Math.min(headerLevel, 3) });
            appendToEditor('\n');
          }
          
          processedUpTo = lineEnd + 1;
          foundPattern = true;
          continue;
        }
      }
    }
    
    // Check for code blocks (```code```)
    const codeBlockStart = contentBuffer.indexOf('```', processedUpTo);
    if (codeBlockStart !== -1) {
      const codeBlockEnd = contentBuffer.indexOf('```', codeBlockStart + 3);
      if (codeBlockEnd !== -1) {
        // Output text before code block
        const beforeCode = contentBuffer.substring(processedUpTo, codeBlockStart);
        if (beforeCode) appendToEditor(beforeCode);
        
        // Output code block
        const codeText = contentBuffer.substring(codeBlockStart + 3, codeBlockEnd);
        appendToEditor(codeText, { 'code-block': true });
        
        processedUpTo = codeBlockEnd + 3;
        foundPattern = true;
        continue;
      }
    }
    
    // Check for inline code (`code`)
    const inlineCodeStart = contentBuffer.indexOf('`', processedUpTo);
    if (inlineCodeStart !== -1) {
      const inlineCodeEnd = contentBuffer.indexOf('`', inlineCodeStart + 1);
      if (inlineCodeEnd !== -1) {
        // Output text before code
        const beforeCode = contentBuffer.substring(processedUpTo, inlineCodeStart);
        if (beforeCode) appendToEditor(beforeCode);
        
        // Output inline code
        const codeText = contentBuffer.substring(inlineCodeStart + 1, inlineCodeEnd);
        appendToEditor(codeText, { code: true });
        
        processedUpTo = inlineCodeEnd + 1;
        foundPattern = true;
        continue;
      }
    }
    
    // No more patterns found, break
    if (!foundPattern) break;
  }
  
  // Output any remaining plain text and keep unprocessed content in buffer
  if (processedUpTo < contentBuffer.length) {
    // Check if there might be incomplete patterns at the end
    const remaining = contentBuffer.substring(processedUpTo);
    
    // If remaining content might be the start of a pattern, keep it in buffer
    if (remaining.includes('*') || remaining.includes('#') || remaining.includes('`')) {
      // Look for the last safe position to output
      let safeUpTo = processedUpTo;
      for (let i = contentBuffer.length - 1; i >= processedUpTo; i--) {
        const char = contentBuffer[i];
        if (char !== '*' && char !== '#' && char !== '`') {
          safeUpTo = i + 1;
          break;
        }
      }
      
      if (safeUpTo > processedUpTo) {
        const safeText = contentBuffer.substring(processedUpTo, safeUpTo);
        appendToEditor(safeText);
        contentBuffer = contentBuffer.substring(safeUpTo);
      }
    } else {
      // No potential patterns, output everything
      appendToEditor(remaining);
      contentBuffer = '';
    }
  } else {
    // Everything processed
    contentBuffer = '';
  }
}

// Helper function to append content to editor
function appendToEditor(text, format = null) {
  if (!quillEditor) return;
  
  const currentLength = quillEditor.getLength();
  if (format) {
    quillEditor.insertText(currentLength - 1, text, format);
  } else {
    quillEditor.insertText(currentLength - 1, text);
  }
}

// Reset content buffer when starting new translation
function resetContentBuffer() {
  contentBuffer = '';
}

// Application state and configuration
const AppConfig = {
    DEBUG: true,
    STORAGE_KEY: 'transcriberSettings',
    STATUS_TIMEOUT: 5000,
    MAX_RETRIES: 3
};

// Debug logging

// This function is now replaced by initializeQuillEditor above

// DOM Elements
const sourceText = document.getElementById('sourceText');
const languageSelect = document.getElementById('language');
const translateBtn = document.getElementById('translateBtn');
const copyBtn = document.getElementById('copyTranslation');
const downloadBtn = document.getElementById('downloadTranslation');
const statusDisplay = document.getElementById('translateStatus');
const progressContainer = document.getElementById('translationProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// Translation state
let translationInProgress = false;
let currentTranslation = '';

// Wait for DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Event Listeners
    translateBtn.addEventListener('click', startTranslation);
    copyBtn.addEventListener('click', copyTranslation);
    downloadBtn.addEventListener('click', downloadAsDocx);
    
    // Add event listener for DOCX upload button
    const uploadDocxBtn = document.getElementById('uploadDocxBtn');
    const docxUpload = document.getElementById('docxUpload');
    uploadDocxBtn.addEventListener('click', handleDocxUpload);
});



// Initialize progress bar
function initProgress() {
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
  progressContainer.hidden = false;
}

// Update progress bar
function updateProgress(percentage) {
  const percent = Math.min(100, Math.max(0, percentage));
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${Math.round(percent)}%`;
}

// Check if API settings are configured
function checkApiSettings() {
  const settings = JSON.parse(localStorage.getItem(AppConfig.STORAGE_KEY) || '{}');
  
  // Get API settings from localStorage (set in settings page)
  const apiUrl = settings['Opn-apiUrl'] + "/chat/completions";
  const apiKey = settings['Opn-apiKey'];
  const model = settings['Opn-model'];
  
  if (!apiUrl || !apiKey || !model) {
    return {
      valid: false,
      message: 'API settings not configured. Please go to Settings page to configure your API endpoint, key, and model.'
    };
  }
  
  return { valid: true };
}

// Start translation process
async function startTranslation() {
  if (translationInProgress) return;
  
  const text = sourceText.value.trim();
  const language = languageSelect.value;

  
  if (!text) {
    statusDisplay.textContent = 'Please enter text to translate';
    return;
  }
  
  if (!language) {
    statusDisplay.textContent = 'Please select a target language';
    return;
  }
  
  // Check API settings first
  const settingsCheck = checkApiSettings();
  if (!settingsCheck.valid) {
    statusDisplay.textContent = settingsCheck.message;
    return;
  }
  
  translationInProgress = true;
  statusDisplay.textContent = 'Starting translation...';
  translateBtn.disabled = true;
  initProgress();
  
  try {
    // Initialize Quill editor if not already initialized
    if (!quillEditor) {
      initializeQuillEditor();
    }
    
    await translateText(text, language);
    statusDisplay.textContent = 'Translation completed successfully';
  } catch (error) {
    handleTranslationError(error);
  } finally {
    translationInProgress = false;
    translateBtn.disabled = false;
  }
}

// Handle translation errors with retry
function handleTranslationError(error) {
  console.error('Translation error:', error);
  statusDisplay.textContent = `Translation failed: ${error.message}`;
  progressContainer.hidden = true;
  
  // Show helpful message for common issues
  if (error.message.includes('API key')) {
    statusDisplay.textContent += ' Please check your API settings.';
  } else if (error.message.includes('network')) {
    statusDisplay.textContent += ' Please check your internet connection or try again later.';
  }
}

// Stream translation from API
async function translateText(text, targetLang) {
  //console.log('Starting translation with:', { text, targetLang });

  const settings = JSON.parse(localStorage.getItem(AppConfig.STORAGE_KEY) || '{}');
  
  // Get API settings from localStorage (set in settings page)
  const apiUrl = settings['Opn-apiUrl'] + "/chat/completions";
  const apiKey = settings['Opn-apiKey'];
  const model = settings['Opn-model'];
  
  
  if (!apiKey) {
    throw new Error('API key not configured. Please set it in Settings.');
  }
  
  if (!apiUrl) {
    throw new Error('API endpoint not configured. Please set it in Settings.');
  }
  
  // Reset current translation
  currentTranslation = '';
  resetContentBuffer();
  if (quillEditor) {
    quillEditor.setText('');
  }
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following content to ${targetLang} while preserving all formatting, style, and meaning.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        stream: true,
        temperature: 0.3
      })
    });
    
    console.log('API Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    updateProgress(10); // Show initial progress
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        updateProgress(100);
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            updateProgress(100);
            continue;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              currentTranslation += content;
              if (quillEditor) {
                insertMarkdownContent(content);
              }
              updateProgress(Math.min(90, 10 + (currentTranslation.length / text.length) * 80));
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e, data);
          }
        }
      }
    }
    
    setTimeout(() => progressContainer.hidden = true, 1000);
    
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

// Copy rich text to clipboard
function copyTranslation() {
  if (!quillEditor) {
    statusDisplay.textContent = 'Editor not initialized';
    return;
  }
  
  const range = document.createRange();
  const selection = window.getSelection();
  const editorElement = quillEditor.root;
  
  range.selectNodeContents(editorElement);
  selection.removeAllRanges();
  selection.addRange(range);
  
  try {
    document.execCommand('copy');
    statusDisplay.textContent = 'Translation copied to clipboard!';
    selection.removeAllRanges();
  } catch (e) {
    statusDisplay.textContent = 'Failed to copy translation';
    console.error('Copy failed:', e);
  }
}

// Handle DOCX file upload and extraction
async function handleDocxUpload() {
  const file = docxUpload.files[0];
  if (!file) {
    statusDisplay.textContent = 'Please select a DOCX file first';
    return;
  }

  try {
    statusDisplay.textContent = 'Processing DOCX file...';
    
    // Add debugging logs
    console.log('Mammoth library available:', typeof mammoth !== 'undefined');
    console.log('File type:', file.type);
    console.log('File size:', file.size);
    
    // Read file as ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);
    console.log('ArrayBuffer length:', arrayBuffer.byteLength);
    
    // Parse DOCX using mammoth.js - designed for reading DOCX files
    const result = await mammoth.extractRawText({arrayBuffer: arrayBuffer});
    const text = result.value;
    
    // Log any warnings from mammoth
    if (result.messages.length > 0) {
      console.log('Mammoth warnings:', result.messages);
    }
    
    // Append text to sourceText textarea
    sourceText.value += (sourceText.value ? '\n\n' : '') + text;
    statusDisplay.textContent = 'DOCX content appended successfully';
    
  } catch (error) {
    console.error('DOCX processing error:', error);
    statusDisplay.textContent = `Failed to process DOCX file: ${error.message}`;
  }
}

// Read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Note: extractTextFromDocument function removed - now using mammoth.js directly

// Download as DOCX
function downloadAsDocx() {
  if (!quillEditor) {
    statusDisplay.textContent = 'Editor not initialized';
    return;
  }
  
  const translationText = quillEditor.getText();
  if (!translationText.trim()) {
    statusDisplay.textContent = 'No translation to download';
    return;
  }
  
  // Check if library is loaded
  if (typeof docx === 'undefined') {
    statusDisplay.textContent = 'DOCX library not loaded properly. Please refresh the page and try again.';
    console.error('DOCX library not found. Check if CDN is accessible.');
    return;
  }
  
  try {
    // Get the formatted content from Quill editor
    const htmlContent = quillEditor.root.innerHTML;
    
    // Convert HTML to DOCX elements
    const children = convertHtmlToDocxElements(htmlContent);
    
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: children.length > 0 ? children : [
          new docx.Paragraph({
            children: [
              new docx.TextRun(translationText)
            ]
          })
        ]
      }]
    });
    
    docx.Packer.toBlob(doc).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translation-${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      statusDisplay.textContent = 'Translation downloaded as DOCX';
    });
  } catch (e) {
    statusDisplay.textContent = 'Failed to generate DOCX file';
    console.error('DOCX generation failed:', e);
  }
}

// Convert HTML content from Quill editor to DOCX elements
function convertHtmlToDocxElements(htmlContent) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  const children = [];
  const paragraphs = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
  
  if (paragraphs.length === 0) {
    // If no paragraphs, treat as single paragraph
    const textRuns = convertNodeToTextRuns(tempDiv);
    if (textRuns.length > 0) {
      children.push(new docx.Paragraph({
        children: textRuns
      }));
    }
  } else {
    paragraphs.forEach(p => {
      const textRuns = convertNodeToTextRuns(p);
      
      if (textRuns.length > 0) {
        const paragraphOptions = {
          children: textRuns
        };
        
        // Handle headers
        if (p.tagName && p.tagName.toLowerCase().startsWith('h')) {
          const level = parseInt(p.tagName.charAt(1));
          paragraphOptions.heading = docx.HeadingLevel[`HEADING_${level}`] || docx.HeadingLevel.HEADING_1;
        }
        
        children.push(new docx.Paragraph(paragraphOptions));
      }
    });
  }
  
  return children;
}

// Convert DOM node to DOCX TextRun elements
function convertNodeToTextRuns(node) {
  const textRuns = [];
  
  function processNode(currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const text = currentNode.textContent;
      if (text.trim()) {
        textRuns.push(new docx.TextRun({
          text: text,
          bold: isInBold(currentNode),
          italics: isInItalics(currentNode),
          underline: isInUnderline(currentNode) ? {} : undefined
        }));
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      // Handle line breaks
      if (currentNode.tagName === 'BR') {
        textRuns.push(new docx.TextRun({
          text: '\n'
        }));
      } else {
        // Process child nodes
        for (let child of currentNode.childNodes) {
          processNode(child);
        }
      }
    }
  }
  
  processNode(node);
  return textRuns;
}

// Helper functions to check formatting
function isInBold(node) {
  let current = node;
  while (current && current.parentNode) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      if (current.tagName === 'STRONG' || current.tagName === 'B' ||
          (current.style && current.style.fontWeight === 'bold')) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

function isInItalics(node) {
  let current = node;
  while (current && current.parentNode) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      if (current.tagName === 'EM' || current.tagName === 'I' ||
          (current.style && current.style.fontStyle === 'italic')) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

function isInUnderline(node) {
  let current = node;
  while (current && current.parentNode) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      if (current.tagName === 'U' ||
          (current.style && current.style.textDecoration &&
           current.style.textDecoration.includes('underline'))) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}