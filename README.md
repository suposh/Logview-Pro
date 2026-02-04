# LogViewPro

LogViewPro is a powerful, configurable log viewer extension for Visual Studio Code. It allows you to view, filter, and analyze logs from multiple files, merging them by timestamp and supporting both JSON and custom string log formats via regex.

## Features

- **Multi-file log merging:** Automatically merges logs from all `.log` and `.json` files in a directory, sorted by timestamp.
- **Configurable log parsing:** Supports both JSON and string log formats. String logs are parsed using a user-configurable regex.
- **Columnar view:** Displays logs in a card-based, columnar layout with resizable columns for File:Line, Module, Level, and Message.
- **Interactive UI:** Filter logs by level, clear logs, and set the log directory directly from the UI.
- **Relative path support:** Set log directory using absolute or workspace-relative paths.
- **Copy to clipboard:** Double-click the File:Line field to copy it, with a popup notification.
- **Responsive design:** Works well on HiDPI screens and adapts to different window sizes.
- **Performance:** Efficiently handles thousands of log lines.


## Requirements

- Visual Studio Code v1.89.0 or later.
- Node.js for development (if building from source).

## Extension Settings

LogViewPro contributes the following settings (add these to your `.vscode/settings.json` or user settings):

```jsonc
"logviewpro.logFormat": "string", // or "json"
"logviewpro.fields.fileName": "fileName",
"logviewpro.fields.lineNumber": "lineNumber",
"logviewpro.fields.level": "level",
"logviewpro.fields.moduleName": "moduleName",
"logviewpro.fields.dateTime": "dateTime",
"logviewpro.fields.message": "message",
"logviewpro.stringLogRegex": "^(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?) \\[(?<moduleName>[^\\]]+)\\] \\[(?<level>[^\\]]+)\\] (?<message>.+) \\((?<fileName>[^:]+):(?<lineNumber>\\d+)\\)$"
```

- For JSON logs, set the field names as they appear in your log objects.
- For string logs, provide a regex with named groups: `fileName`, `lineNumber`, `level`, `moduleName`, `dateTime`, `message`.

## Usage

1. Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and run **"LogViewPro: Open Log Viewer"**.
2. Set the log directory (absolute or relative to workspace).
3. Click **Load** to view logs. Use the filter dropdown to filter by log level.
4. Resize columns by dragging the markers in the header row.
5. Double-click a File:Line field to copy it to clipboard.

## Known Issues

- Very large log files (10,000+ lines) may impact performance. For best results, keep log directories to a reasonable size.
- Only `.log` and `.json` files are processed.
- Regex parsing for string logs must match the log format exactly.

## Release Notes

### 0.0.1

- Initial release: multi-file log merging, configurable parsing, interactive UI, and clipboard support.

---

## Following extension guidelines

This extension follows [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines) and best practices for UI and performance.

## For more information

- [Visual Studio Code API](https://code.visualstudio.com/api)
- [VS Code Extension Marketplace](https://marketplace.visualstudio.com/)

**Enjoy using LogViewPro!**
