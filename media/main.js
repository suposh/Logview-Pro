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
    
    colorMap = {
        "ERROR": "ErrorCard",
        "INFO": "InfoCard",
        "WARN": "InfoCard",
        "DEBUG": "InfoCard"
    }
    
    logs.forEach(log => {
    const logCard = document.createElement('div');
    logCard.className = `logCard ${colorMap[log.level]}`;

    logCard.innerHTML = /*html*/`
        <div class="logHeader">
            <span class="logOrigin">${log.fileName}:${log.lineNumber}</span>
            <span class="logLevel ${log.level.toLowerCase()}">${log.level}</span>
        </div>

        <div class="logMessage">
            ${log.message}
        </div>
    `;

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
