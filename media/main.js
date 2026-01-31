const vscode = acquireVsCodeApi();

function setDirectory() {
    const logDir = document.getElementById('logDir').value;
    vscode.postMessage({ command: 'setDirectory', text: logDir });
}

function loadLogs() {
    vscode.postMessage({ command: 'loadLogs' });
}

function filterLogs() {
    const logLevel = document.getElementById('logLevel').value;
    vscode.postMessage({ command: 'filterLogs', level: logLevel });
}

function clearLogs() {
    document.getElementById('logContainer').innerHTML = '';
}

window.addEventListener('message', event => {
    const message = event.data;
    // Debug: log incoming messages
    console.log('Webview received message:', message);

    switch (message.command) {
        case 'showLogs':
            showLogs(message.logs);
            break;
        case 'filterLogs':
            applyLogFilter(message.level);
            break;
    }
});

// Configurable filename column width and max chars
const FILENAME_COL_PX = 340; // ~40 monospace chars at 8-9px/char
const FILENAME_MAX_CHARS = 40; // Configurable

// Set CSS variable for column width
document.documentElement.style.setProperty('--origin-col-width', FILENAME_COL_PX + 'px');

// Add popup container for notifications
if (!document.getElementById('copyPopup')) {
    const popup = document.createElement('div');
    popup.id = 'copyPopup';
    popup.style.display = 'none';
    popup.style.position = 'fixed';
    popup.style.right = '32px';
    popup.style.bottom = '32px';
    popup.style.background = '#222';
    popup.style.color = '#fff';
    popup.style.padding = '12px 22px';
    popup.style.borderRadius = '8px';
    popup.style.fontSize = '15px';
    popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
    popup.style.zIndex = 9999;
    popup.style.transition = 'opacity 0.2s';
    document.body.appendChild(popup);
}

function showCopyPopup(text) {
    const popup = document.getElementById('copyPopup');
    popup.textContent = text;
    popup.style.display = 'block';
    popup.style.opacity = '1';
    setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => { popup.style.display = 'none'; }, 300);
    }, 1200);
}

function showLogs(logs) {
    const logContainer = document.getElementById('logContainer');
    logContainer.innerHTML = '';

    // Use lower-case keys for case-insensitive mapping
    const colorMap = {
        "error": "ErrorCard",
        "info": "InfoCard",
        "warning": "WarnCard",
        "warn": "WarnCard",
        "debug": "DebugCard"
    };

    logs.forEach(log => {
        const logCard = document.createElement('div');
        logCard.className = 'logCard';

        let originFull = `${log.fileName || ''}${log.lineNumber ? ':' + log.lineNumber : ''}`;
        let originDisplay = originFull;
        let originClass = '';
        if (originFull.length > FILENAME_MAX_CHARS) {
            const head = Math.max(10, Math.floor((FILENAME_MAX_CHARS - 3) / 2));
            const tail = FILENAME_MAX_CHARS - 3 - head;
            originDisplay = originFull.slice(0, head) + '...' + originFull.slice(-tail);
            originClass = 'long-filename';
        }

        // Use level as-is, but normalize for color mapping
        let level = log.level || '';
        let normalizedLevel = level.toLowerCase();
        const message = log.message || '';

        logCard.innerHTML = /*html*/`
            <span class="logOrigin ${originClass}" data-fullname="${originFull.replace(/"/g, '&quot;')}">${originDisplay}</span>
            <span class="logLevel">${level}</span>
            <span class="logMessage">${message}</span>
        `;

        // Case-insensitive match for level
        const colorClass = colorMap[normalizedLevel];
        if (level && colorClass) {
            logCard.classList.add(colorClass);
        }
        logContainer.appendChild(logCard);

        // Add double-click to copy for .logOrigin
        const originElem = logCard.querySelector('.logOrigin');
        if (originElem) {
            originElem.addEventListener('dblclick', function (e) {
                // Use Clipboard API
                navigator.clipboard.writeText(originFull).then(() => {
                    showCopyPopup(`Copied: ${originFull}`);
                });
                e.stopPropagation();
            });
        }
    });
}

function applyLogFilter(level) {
    const logCards = document.getElementsByClassName('logCard');

    Array.from(logCards).forEach(card => {
        const logLevel = card.querySelector('div:nth-child(3)').innerText.split(': ')[1];
        if (level === 'ALL' || logLevel === level) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}
