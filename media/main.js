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
        logCard.className = 'logCard';
        logCard.innerHTML = /*html*/`
            <div display='span' >
                <b font-style='italic'>Origin:</b> ${log.File}:${log.Function}
            </div>
            <div><b>Level:</b style="background-color:aquamarine;"> ${log.Level}</div>
            <div><b>LogMessage:</b> ${log.Message}</div>`;
        
        logCard.classList.add(colorMap[log.Level]);
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
