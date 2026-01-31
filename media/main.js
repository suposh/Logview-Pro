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

        // Use correct property names
        const origin = `${log.fileName || ''}${log.lineNumber ? ':' + log.lineNumber : ''}`;
        const level = log.level || '';
        const message = log.message || '';

        logCard.innerHTML = /*html*/`
            <span class="logOrigin">${origin}</span>
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
