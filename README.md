# Morning Report

A Wizard app that reads dated morning reports, newest first. New editions show as an unread badge on the app's icon until you read them. Controls (older, date, newer, PDF) sit at the bottom for thumb reach; the PDF is the printable copy.

The app only reads. It shows whatever `<name>-YYYY-MM-DD.md` files (plus optional `-YYYY-MM-DD[-mobile].pdf` files) are in `media/Reports/morning-report/`. That folder is mounted read-only. Report content, schedules and preferences belong to the agent job that writes those files, so none of them are in this repo.

- View: `/` (vanilla JS, safe DOM-built Markdown, print stylesheet)
- API: `GET /api/reports`, `GET /api/reports/{date|latest}`, `GET /api/reports/{date}.pdf`, `GET /healthz`
- MCP: `POST /mcp` with read-only tools `reports_list` and `report_read`

Repackage after source edits with `python3 tools/package.py`.
