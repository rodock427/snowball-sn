# Snowball

A browser extension for ServiceNow. Save the replies, hand-offs and ticket templates you use all the time, then fill a ticket, drop in a reply or start a new ticket in one keystroke.

## Install (unpacked)

- **Chrome / Edge:** `chrome://extensions` → Developer mode → **Load unpacked** → pick this folder.
- **Firefox 128+:** `about:debugging` → This Firefox → **Load Temporary Add-on** → pick `manifest.json`. Grant site access in the add-on's settings for the floating button. (Temporary add-ons vanish on restart.)

## Use

Open it with the toolbar icon, **Alt+Shift+S**, or the snowball button on ServiceNow ticket pages.

- **Replies** — canned messages, customer-visible or work note. Placeholders: `{first_name}`, `{me}`, or any field like `{number}`.
- **Hand-offs** — just assignment group / assigned to (plus an optional note). Use *Just the routing* when saving a ticket.
- **Templates** — any set of fields from a ticket.

↑↓ pick · ⏎ use (fill this ticket, or start a new one when you're not on a ticket) · ⇧⏎ always start a new ticket · esc close. Every fill can be undone.

Works on the classic form UI (including Next Experience). Not Agent Workspace. Saved groups/users are tied to the instance they were recorded on.

## Test

```bash
node test.js
```
