# Claude Chinese Localization Toolkit (claude-chinese)

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

> 🚀 **High-performance, Non-invasive, Self-healing Chinese Localization Toolkit for Anthropic Claude Desktop clients (Windows MSIX / Win32 / macOS / Linux).**

A robust, industrial-grade localization engine tailored for **Claude Desktop**, fully aligned with the **`antigravity-chinese`** architectural principles. Built to survive frequent upstream updates, Windows MSIX ACL restrictions, and customized third-party routing (e.g., **CC Switch + DeepSeek** in `cowork + code` hybrid modes).

---

## 🌟 Core Highlights & Architectural Philosophy

- 🛡️ **Non-invasive Dual-layer Injection**: Hooks directly into official i18n JSON resources (`Shell` + `Ion-Dist Web UI`) and JS language registries without binary decompilation or ASAR corruption.
- 🧬 **Self-healing & Drift-resistant**: Equipped with upstream drift detectors (`npm run scan:drift`) that monitor, diff, and auto-align with upstream updates in seconds.
- 🎯 **100% HashKey & UI Coverage**: Over 18,900+ curated translations covering Cowork canvases, manual/auto approval flows, Claude Code, model selectors, and settings.
- 🔒 **Strict ICU AST Syntax Firewall**: Absolute protection for dynamic ICU variables (`{count, plural...}`, `{apps}`, `{folderName}`) and technical specs (`1M`, `128k`, `MCP`, `API`, `OAuth`), ensuring task workflows never freeze.
- 🪟 **MSIX & WindowsApps Specialized Adapter**: Built-in automated UAC elevation and ACL management for sideloaded Windows AppX packages.

---

## 🔌 Dual-Mode Architecture

```mermaid
graph TD
    User((Developer / User)) --> ClaudeApp[Claude Desktop App]
    
    subgraph Mode1 ["Mode A: Host UI Localization"]
        ClaudeApp --> ShellLayer["Shell Layer (550+ entries)"]
        ClaudeApp --> WebUILayer["Ion-Dist Web UI (18,900+ entries)"]
        ClaudeApp --> DynamicLayer["Dynamic Model Features"]
    end
    
    subgraph Mode2 ["Mode B: MCP Agent Suite & Gateway Routing"]
        ClaudeApp --> MCP["MCP Server Chinese Protocols"]
        ClaudeApp --> Rules["Chinese Interaction & Engineering Rules"]
        ClaudeApp --> Switcher["1P Official / 3P Third-Party Gateway Routing"]
    end
```

---

## 📋 Prerequisites

1. **Operating System**: Windows 10/11 (x64), macOS (Apple Silicon / Intel), Linux.
2. **Node.js**: >= 16.x (with npm).
3. **Claude Desktop**: Official desktop client installed.

---

## 🚀 Quick Start

### Option 1: One-Click Script (Recommended)

#### Windows
* **Install**: Right-click [`install.bat`](install.bat) and choose "Run as administrator".
* **Self-Healing Launch**: Double-click [`launch.bat`](launch.bat).
* **Restore English**: Double-click [`uninstall.bat`](uninstall.bat).

#### macOS / Linux
* **Install**: Run `./install.sh`
* **Restore English**: Run `./uninstall.sh`

---

### Option 2: CLI Manager

```bash
# Check client and patch health status
node cli.js status

# Install full localization patch
node cli.js install

# Restore official English
node cli.js restore

# Launch with self-healing check
node cli.js launch

# Upstream drift detection scan
node cli.js drift
```

---

## 🧪 Testing & Verification

```bash
# Run full automated regression & ICU firewall assertions
npm test

# Run comprehensive dictionary audit
node tools/comprehensive-audit.js
```

---

## 💖 Sponsorship & Support

If this project helps your daily development and you'd like to support continuous maintenance, documentation, and automated testing, voluntary sponsorship of any amount is greatly appreciated:

- **PayPal**: **[PayPal Sponsorship Link](https://www.paypal.com/ncp/payment/LNTF8KXGJXMZY)**
- **WeChat Pay / Alipay**: Supported via QR codes in [README.md](README.md).

---

## ⚠️ Disclaimer & Compliance

1. **Non-official Project**: This is an open-source community localization tool and is not affiliated with or endorsed by Anthropic, PBC.
2. **Trademarks**: `Claude`, `Anthropic`, `DeepSeek`, and all related trademarks belong to their respective owners.
3. **Privacy**: This project contains zero telemetry, trackers, or credential interception. 100% open-source.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
