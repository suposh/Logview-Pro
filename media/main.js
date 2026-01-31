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

function showLogs(logs) {
    const logContainer = document.getElementById('logContainer');
    logContainer.innerHTML = '';

    const colorMap = {
        "ERROR": "ErrorCard",
        "INFO": "InfoCard",
        "WARN": "WarnCard",
        "DEBUG": "InfoCard"
    };

    logs.forEach(log => {
        const logCard = document.createElement('div');
        logCard.className = 'logCard';

        let originFull = `${log.fileName || ''}${log.lineNumber ? ':' + log.lineNumber : ''}`;
        let originDisplay = originFull;
        let originClass = '';
        if (originFull.length > FILENAME_MAX_CHARS) {
            // Show first 18 ... last 18 (or split based on max chars)
            const head = Math.max(10, Math.floor((FILENAME_MAX_CHARS - 3) / 2));
            const tail = FILENAME_MAX_CHARS - 3 - head;
            originDisplay = originFull.slice(0, head) + '...' + originFull.slice(-tail);
            originClass = 'long-filename';
        }

        const level = log.level || '';
        const message = log.message || '';

        logCard.innerHTML = /*html*/`
            <span class="logOrigin ${originClass}" data-fullname="${originFull.replace(/"/g, '&quot;')}">${originDisplay}</span>
            <span class="logLevel">${level}</span>
            <span class="logMessage">${message}</span>
        `;

        logCard.classList.add(colorMap[level] || '');
        logContainer.appendChild(logCard);
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
