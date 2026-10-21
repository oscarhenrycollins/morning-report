---
wizard: 0.2
id: morning-report
name: Morning Report
type: service
category: app
version: 0.2.0
summary: Read your daily morning reports, newest first, and print any edition.
license: GPL-3.0-only
source: https://github.com/oscarhenrycollins/morning-report
runtime:
  kind: runtipi
  config: runtipi/config.json
  compose: runtipi/docker-compose.yml
api:
  port: 8799
  path: /api
  spec: openapi.json
mcp:
  path: /mcp
  port: 8799
  transport: streamable-http
skill: skill/SKILL.md
view:
  path: /
  port: 8799
  source:
    path: web
    build: python3 app/build_view.py
    dist: web
provides:
- morning-report
system: false
uses: []
needs: []
health: /healthz
---

# Morning Report

A quiet, read-only reader for dated Markdown reports (with optional PDF editions) that a scheduled agent job writes into one folder. Newest edition on top, step older or newer, open the PDF, or print a clean paper copy. The report folder is mounted read-only; the app contains no report content, no schedule and no personal preferences.
