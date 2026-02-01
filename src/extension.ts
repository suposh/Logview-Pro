import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('logviewpro.openLogViewer', () => {
            LogViewerPanel.createOrShow(context.extensionUri);
        })
    );
}

// Utility: Parse a log line based on config
function parseLogLine(line: string, config: LogParseConfig): ParsedLog | null {
    if (!line.trim()) return null;
    // Remove trailing \r (carriage return) for Windows line endings
    line = line.replace(/\r$/, '');
    if (config.format === 'json') {
        try {
            const obj = JSON.parse(line);
            return {
                fileName: obj[config.fields.fileName] || '',
                lineNumber: obj[config.fields.lineNumber] || '',
                level: obj[config.fields.level] || '',
                moduleName: obj[config.fields.moduleName] || '',
                dateTime: obj[config.fields.dateTime] || '',
                message: obj[config.fields.message] || '',
                raw: line
            };
        } catch {
            return null;
        }
    } else if (config.format === 'string') {
        // Use only the regex from settings.json
        if (!config.stringRegex) return null;
        const regex = new RegExp(config.stringRegex);
        const match = regex.exec(line);
        if (match && (match.groups || match.length >= 6)) {
            const groups = match.groups || {};
            return {
                dateTime: groups.dateTime || match[1] || '',
                moduleName: groups.moduleName || match[2] || '',
                level: groups.level || match[3] || '',
                message: groups.message || match[4] || '',
                fileName: groups.fileName || match[5] || '',
                lineNumber: groups.lineNumber || match[6] || '',
                raw: line
            };
        }
    }
    return null;
}

interface LogParseConfig {
    format: 'json' | 'string';
    fields: {
        fileName: string;
        lineNumber: string;
        level: string;
        moduleName: string;
        dateTime: string;
        message: string;
    };
    stringRegex?: string;
}

interface ParsedLog {
    dateTime: string;
    fileName: string;
    lineNumber: string;
    level: string;
    moduleName: string;
    message: string;
    raw: string;
}

class LogViewerPanel {
    public static currentPanel: LogViewerPanel | undefined;
    public static readonly viewType = 'logViewer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _logDir: string | undefined;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (LogViewerPanel.currentPanel) {
            LogViewerPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            LogViewerPanel.viewType,
            'Log Viewer',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
            }
        );

        LogViewerPanel.currentPanel = new LogViewerPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'setDirectory':
                        // Support relative path flag from webview
                        this.setDirectory(message.text, message.isRelative);
                        return;
                    case 'loadLogs':
                        this.loadLogs();
                        return;
                    case 'filterLogs':
                        this.filterLogs(message.level);
                        return;
                }
            },
            null,
            this._disposables
        );

        this._update();
    }

    public dispose() {
        LogViewerPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        // Get workspace root path or empty string
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const defaultLogDir = workspaceFolders && workspaceFolders.length > 0
            ? workspaceFolders[0].uri.fsPath
            : '';
        this._panel.webview.html = this._getHtmlForWebview(webview, defaultLogDir);
    }

    // Accept defaultLogDir as parameter
    private _getHtmlForWebview(webview: vscode.Webview, defaultLogDir: string) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css')
        );

        return /*html*/`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Log Viewer</title>
        <link href="${styleUri}" rel="stylesheet" />
    </head>
    <body>
        <!-- Toolbar -->
        <div class="toolbar">
            <input
                type="text"
                id="logDir"
                placeholder="Set Log Directory"
                value="${defaultLogDir.replace(/\\/g, '\\\\')}"
            />
            <button class="primary" onclick="setDirectory()">Set Directory</button>
            <button class="primary" onclick="loadLogs()">Load</button>
            <select id="logLevel" onchange="filterLogs()">
                <option value="ALL">ALL</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
            </select>
            <button class="secondary" onclick="clearLogs()">Clear</button>
        </div>

        <!-- Column header with resizable anchors -->
        <div id="logHeader" class="logHeader">
            <span class="headerCell" data-col="origin">
                File:Line
                <span class="col-resize-handle" data-col="origin"></span>
            </span>
            <span class="headerCell" data-col="module">
                Module
                <span class="col-resize-handle" data-col="module"></span>
            </span>
            <span class="headerCell" data-col="level">
                Level
                <span class="col-resize-handle" data-col="level"></span>
            </span>
            <span class="headerCell" data-col="message">
                Message
                <!-- No handle for last column (flexible) -->
            </span>
        </div>

        <!-- Logs -->
        <div id="logContainer" aria-live="polite"></div>

        <script src="${scriptUri}"></script>
    </body>
    </html>`;
    }

    private setDirectory(directory: string, isRelative?: boolean) {
        let dir = directory;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (isRelative && workspaceFolders && workspaceFolders.length > 0) {
            const rootFolder = workspaceFolders[0];
            const root = rootFolder.uri.fsPath;
            dir = path.resolve(root, directory);
        }
        this._logDir = dir;
        vscode.workspace.getConfiguration().update('logviewpro.logDir', dir, vscode.ConfigurationTarget.Global);
    }

    private getLogParseConfig(formatOverride?: 'json' | 'string'): LogParseConfig {
        const config = vscode.workspace.getConfiguration('logviewpro', vscode.workspace.workspaceFolders?.[0]);
        const format = formatOverride || config.get<'json' | 'string'>('logFormat', 'json');
        // Fetch stringRegex from the correct scope (workspace or user)
        let stringRegex = config.inspect<string>('stringLogRegex')?.workspaceFolderValue
            || config.inspect<string>('stringLogRegex')?.workspaceValue
            || config.inspect<string>('stringLogRegex')?.globalValue
            || config.get<string>('stringLogRegex');
        return {
            format,
            fields: {
                fileName: config.get<string>('fields.fileName', 'fileName'),
                lineNumber: config.get<string>('fields.lineNumber', 'lineNumber'),
                level: config.get<string>('fields.level', 'level'),
                moduleName: config.get<string>('fields.moduleName', 'moduleName'),
                dateTime: config.get<string>('fields.dateTime', 'dateTime'),
                message: config.get<string>('fields.message', 'message'),
            },
            stringRegex
        };
    }

    private loadLogs() {
        const logDir = this._logDir || vscode.workspace.getConfiguration().get('logviewpro.logDir') as string;
        if (logDir) {
            fs.readdir(logDir, (err, files) => {
                if (err) {
                    vscode.window.showErrorMessage('Could not load log files');
                    return;
                }

                // Only process .log and .json files
                const logFiles = files.filter(file => file.endsWith('.log') || file.endsWith('.json'));
                let logs: ParsedLog[] = [];

                logFiles.forEach(file => {
                    const filePath = path.join(logDir, file);
                    const data = fs.readFileSync(filePath, 'utf8');
                    const logLines = data.split('\n').filter(line => line.trim());

                    // Determine format based on file extension
                    const format: 'json' | 'string' = file.endsWith('.json') ? 'json' : 'string';
                    const parseConfig = this.getLogParseConfig(format);

                    logLines.forEach((line, idx) => {
                        const log = parseLogLine(line, parseConfig);
                        if (log) {
                            // If fileName is missing, use the log file name
                            if (!log.fileName) log.fileName = file;
                            // Attach file and line index for stable sort
                            (log as any)._file = file;
                            (log as any)._fileIndex = idx;
                            logs.push(log);
                        }
                    });
                });

                // Sort logs by dateTime ascending, then by file, then by line index
                logs.sort((a, b) => {
                    // Parse ISO date
                    const ta = Date.parse(a.dateTime);
                    const tb = Date.parse(b.dateTime);
                    if (ta !== tb) return ta - tb; // Oldest first (bottom)
                    // If same time, sort by file name (stable for multi-file)
                    if ((a as any)._file < (b as any)._file) return -1;
                    if ((a as any)._file > (b as any)._file) return 1;
                    // If same file and time, preserve original order (first line is older)
                    return (a as any)._fileIndex - (b as any)._fileIndex;
                });

                // Remove temp sort fields before sending to webview
                logs = logs.map(log => {
                    const { _file, _fileIndex, ...rest } = log as any;
                    return rest;
                });

                // Send logs in reverse order so most recent is on top
                this._panel.webview.postMessage({ command: 'showLogs', logs: logs.reverse() });
            });
        } else {
            vscode.window.showErrorMessage('Log directory is not set');
        }
    }

    private filterLogs(level: string) {
        this._panel.webview.postMessage({ command: 'filterLogs', level });
    }
}
