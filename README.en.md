# Claude Chinese Localization Toolkit (claude-chinese)

<p align="center">
  <a href="https://github.com/yiheng8023/claude-chinese/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/yiheng8023/claude-chinese/ci.yml?branch=main&label=CI&logo=github" alt="CI Status"></a>
  <a href="https://github.com/yiheng8023/claude-chinese/releases/latest"><img src="https://img.shields.io/github/v/release/yiheng8023/claude-chinese?color=blue&label=Release" alt="Latest Release"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D16.x-brightgreen?logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform Support">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/yiheng8023/claude-chinese?color=green" alt="License"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

> 🚀 **High-performance, Non-invasive, Self-healing Chinese Localization Toolkit for Anthropic Claude Desktop clients (Windows MSIX / Win32 / macOS / Linux).**

A robust, industrial-grade localization engine tailored for **Claude Desktop**. Built to survive frequent upstream updates, Windows MSIX ACL restrictions, and customized third-party routing (e.g., **CC Switch + DeepSeek** in `cowork + code` hybrid modes).

---

## 🌟 Core Highlights & Architectural Philosophy

- 🛡️ **Non-invasive Incremental Overlay & Pure Fallback**: Merges translations on top of official `en-US` dictionaries while preserving the native English dictionary 100% intact as an ultimate fallback. Eliminates "update-and-break" risks when upstream adds new keys.
- 🕊️ **Official Chinese Detection & Graceful Yield**: Automatically detects when Anthropic officially rolls out native Chinese localization and yields gracefully without manual intervention.
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
# Check installation & patch status
node cli.js status

# Run preflight health checks (Node version, client paths, process locks, permissions)
node cli.js check

# Install localization patch with automatic preflight and process locking guard
node cli.js install

# Start hot-reload daemon (live reload on dict change via Ctrl+R, auto-healing on updates)
node cli.js watch

# Launch with self-healing check
node cli.js launch

# Upstream drift detection scan
node cli.js drift

# Restore official English
node cli.js restore
```

---

## 🧪 Testing & Verification

This project uses comprehensive automated regression test suites and cross-platform CI (Windows / macOS / Ubuntu) to ensure stability:

```bash
# Run full automated regression test suite
npm test
```

- **Dictionary Integrity (`test/verify-dict.js`)**: Validates core dictionary structure with zero missing or empty entries.
- **ICU Syntax Firewall (`test/test-icu.js`)**: Ensures all template variables, plural branches, and technical terms remain structurally symmetrical.
- **Lifecycle & Reversible Restore (`test/test-restore-cycle.js`)**: End-to-end install -> status check -> clean rollback -> fallback verification.
- **Cross-Platform Live Detector (`test/test-cross-platform-live.js`)**: Verifies 0-argument automatic path detection on physical platform runners.

---

## 📁 Repository Structure

```text
claude-chinese/
├── dict/                     # Localization dictionary assets
│   ├── zh-CN.json            # Shell layer dictionary (550+ entries)
│   ├── ion-zh-CN.json        # Web UI dictionary (18,900+ entries)
│   └── dynamic-zh-CN.json    # Dynamic features and placeholder dictionary
├── core/                     # Injection engine
│   ├── patcher.js            # Patch injection, JS registration, and restore core
│   ├── msix-detector.js      # MSIX container detector & cross-platform path resolver
│   └── permissions.js        # Windows ACL permissions and elevation utilities
├── test/                     # Automated regression test suites
│   ├── verify-dict.js        # Dictionary integrity assertions
│   ├── test-icu.js           # ICU variable syntax firewall assertions
│   ├── test-restore-cycle.js # Install and restore lifecycle regression tests
│   └── test-cross-platform-live.js # Live cross-platform path detection tests
├── tools/                    # Text extraction, diff comparison, and drift detectors
├── docs/assets/sponsoring/   # Sponsorship & donation assets
├── cli.js                    # Cross-platform CLI lifecycle entry point
├── install.bat / install.sh  # One-click installation scripts
├── launch.bat                # Self-healing launcher script
├── uninstall.bat / uninstall.sh # One-click restore scripts
├── package.json              # Project configuration and npm scripts
├── LICENSE                   # MIT License
└── README.md                 # Documentation
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
