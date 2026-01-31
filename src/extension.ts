import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('logger5x.openLogViewer', () => {
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
        // Updated regex to match: [dateTime] LEVEL fileName:lineNumber moduleName - message
        const regex = config.stringRegex
            ? new RegExp(config.stringRegex)
            : /^\[(?<dateTime>.+?)\]\s+(?<level>\w+)\s+(?<fileName>[^:]+):(?<lineNumber>\d+)\s+(?<moduleName>\w+)\s*-\s*(?<message>.+)$/;
        const match = regex.exec(line);
        if (match && match.groups) {
            return {
                fileName: match.groups.fileName || '',
                lineNumber: match.groups.lineNumber || '',
                level: match.groups.level || '',
                moduleName: match.groups.moduleName || '',
                dateTime: match.groups.dateTime || '',
                message: match.groups.message || '',
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
                        this.setDirectory(message.text);
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

        <!-- Logs -->
        <div id="logContainer" aria-live="polite"></div>

        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}


    private setDirectory(directory: string) {
        this._logDir = directory;
        vscode.workspace.getConfiguration().update('logger5x.logDir', directory, vscode.ConfigurationTarget.Global);
    }

    private getLogParseConfig(formatOverride?: 'json' | 'string'): LogParseConfig {
        const config = vscode.workspace.getConfiguration('logger5x');
        const format = formatOverride || config.get<'json' | 'string'>('logFormat', 'json');
        // Always fetch stringRegex from settings, regardless of format
        let stringRegex = config.get<string>('stringLogRegex');
        // If not set, use the default regex as string
        if (!stringRegex) {
            stringRegex = "^\\[(?<dateTime>.+?)\\]\\s+(?<level>\\w+)\\s+(?<fileName>[^:]+):(?<lineNumber>\\d+)\\s+(?<moduleName>\\w+)\\s*-\\s*(?<message>.+)$";
        }
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
        const logDir = this._logDir || vscode.workspace.getConfiguration().get('logger5x.logDir') as string;
        if (logDir) {
            fs.readdir(logDir, (err, files) => {
                if (err) {
                    vscode.window.showErrorMessage('Could not load log files');
                    return;
                }

                // Only process .log and .json files
                const logFiles = files.filter(file => file.endsWith('.log') || file.endsWith('.json'));
                const logs: ParsedLog[] = [];

                logFiles.forEach(file => {
                    const filePath = path.join(logDir, file);
                    const data = fs.readFileSync(filePath, 'utf8');
                    const logLines = data.split('\n').filter(line => line.trim());

                    // Determine format based on file extension
                    const format: 'json' | 'string' = file.endsWith('.json') ? 'json' : 'string';
                    const parseConfig = this.getLogParseConfig(format);

                    logLines.forEach(line => {
                        const log = parseLogLine(line, parseConfig);
                        if (log) {
                            // If fileName is missing, use the log file name
                            if (!log.fileName) log.fileName = file;
                            logs.push(log);
                        }
                    });
                });

                this._panel.webview.postMessage({ command: 'showLogs', logs });
            });
        } else {
            vscode.window.showErrorMessage('Log directory is not set');
        }
    }

    private filterLogs(level: string) {
        this._panel.webview.postMessage({ command: 'filterLogs', level });
    }
}
