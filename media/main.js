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
const FILENAME_MAX_CHARS = 40; // Max chars before truncation

// Set initial CSS variables for column widths
const ORIGIN_COL_PX = 340;
const MODULE_COL_PX = 120;
const LEVEL_COL_PX = 90;
const MIN_ORIGIN_COL_PX = 80;
const MIN_MODULE_COL_PX = 60;
const MIN_LEVEL_COL_PX = 50;

document.documentElement.style.setProperty('--origin-col-width', ORIGIN_COL_PX + 'px');
document.documentElement.style.setProperty('--module-col-width', MODULE_COL_PX + 'px');
document.documentElement.style.setProperty('--level-col-width', LEVEL_COL_PX + 'px');

// Draggable column resizing
window.addEventListener('DOMContentLoaded', () => {
    const colVars = {
        origin: { css: '--origin-col-width', min: MIN_ORIGIN_COL_PX },
        module: { css: '--module-col-width', min: MIN_MODULE_COL_PX },
        level: { css: '--level-col-width', min: MIN_LEVEL_COL_PX }
    };

    let dragging = null;
    let startX = 0;
    let startWidth = 0;

    document.querySelectorAll('.col-resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', function (e) {
            const col = handle.getAttribute('data-col');
            if (!colVars[col]) return;
            dragging = { col, handle };
            startX = e.clientX;
            // Always get the current width from the grid column, not the header cell
            startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue(colVars[col].css)) || colVars[col].min;
            handle.classList.add('active');
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });
    });

    window.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        const { col, handle } = dragging;
        const delta = e.clientX - startX;
        let newWidth = startWidth + delta;
        // Minimum width is the header cell's offsetWidth or configured min
        const headerCell = document.querySelector(`.headerCell[data-col="${col}"]`);
        // Use offsetWidth of the headerCell's first child (the label text) for true min
        let labelMin = 0;
        if (headerCell && headerCell.childNodes.length > 0) {
            for (let i = 0; i < headerCell.childNodes.length; ++i) {
                const node = headerCell.childNodes[i];
                if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.classList && !node.classList.contains('col-resize-handle'))) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        // Create a temp span to measure text node
                        const span = document.createElement('span');
                        span.style.visibility = 'hidden';
                        span.style.position = 'absolute';
                        span.textContent = node.textContent.trim();
                        document.body.appendChild(span);
                        labelMin = Math.max(labelMin, span.offsetWidth + 24); // 24px for padding/gap
                        document.body.removeChild(span);
                    } else {
                        labelMin = Math.max(labelMin, node.offsetWidth + 24);
                    }
                }
            }
        }
        const minWidth = Math.max(colVars[col].min, labelMin);
        newWidth = Math.max(minWidth, newWidth);
        document.documentElement.style.setProperty(colVars[col].css, newWidth + 'px');
    });

    window.addEventListener('mouseup', function () {
        if (dragging) {
            dragging.handle.classList.remove('active');
            document.body.style.cursor = '';
            dragging = null;
        }
    });
});

// Interactive anchors for resizing columns
window.addEventListener('DOMContentLoaded', () => {
    const colVars = {
        origin: { css: '--origin-col-width', px: ORIGIN_COL_PX, min: 80, max: 800, step: 40 },
        module: { css: '--module-col-width', px: MODULE_COL_PX, min: 60, max: 400, step: 20 },
        level: { css: '--level-col-width', px: LEVEL_COL_PX, min: 50, max: 200, step: 10 },
        message: { css: '', px: 0 } // message column is flexible
    };
    document.querySelectorAll('.resizeAnchor').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const col = anchor.getAttribute('data-col');
            const dir = anchor.getAttribute('data-dir');
            if (!colVars[col] || !colVars[col].css) return;
            let curr = parseInt(getComputedStyle(document.documentElement).getPropertyValue(colVars[col].css)) || colVars[col].px;
            let next = curr + (dir === '+' ? colVars[col].step : -colVars[col].step);
            next = Math.max(colVars[col].min, Math.min(colVars[col].max, next));
            document.documentElement.style.setProperty(colVars[col].css, next + 'px');
        });
    });
});

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

        let level = log.level || '';
        let normalizedLevel = level.toLowerCase();
        const moduleName = log.moduleName || '';
        const message = log.message || '';

        logCard.innerHTML = /*html*/`
            <span class="logOrigin ${originClass}" data-fullname="${originFull.replace(/"/g, '&quot;')}">${originDisplay}</span>
            <span class="logModule">${moduleName}</span>
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
