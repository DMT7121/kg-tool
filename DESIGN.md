# KG Studio — Design System & Architecture (`DESIGN.md`)

## 1. Visual Direction & Domain Exemplars
- **Domain**: Enterprise F&B Operations, POS Billing, HR Payroll & FinTech Disbursement Suite (`KG Studio`).
- **Aesthetic Persona**: **High-Craft Editorial Operations Studio** (inspired by **Linear**, **Stripe Dashboard**, **Square POS**, and **Raycast**).
- **100% Visual Transformation**:
  - Replaced the legacy dark-navy `#050b1e` + neon-cyan glassmorphism look with a dual-mode **Warm Carbon & Emerald/Terracotta Studio** dark theme and **Crisp Alabaster & Forest Slate** daylight theme.
  - Eliminated heavy multi-layer `backdrop-filter: blur(24px)` GPU bottlenecks in favor of crisp `1px solid` structural hairlines, subtle surface luminance hierarchy, and tactile micro-interactions.
  - Dual deployment architecture: **Standalone Webapp (PWA)** + **Browser Extension (Manifest V3 Side Panel & Popup Companion)**.

---

## 2. Color & Atmospheric Polarity (Dual Adaptive Palette)

### Dark Theme (`[data-theme="dark"]` — Default Carbon Studio)
| Token | Value | Role |
| :--- | :--- | :--- |
| `--bg` / `--bg-dark` | `#0c0d10` | Primary carbon canvas |
| `--bg-elevated` | `#13151a` | Sidebar, topbar, and structural frame |
| `--panel-bg` / `--card-bg` | `#171920` | Primary Bento card surface |
| `--card-bg-hover` | `#1d2029` | Interactive row/card hover state |
| `--surface-subtle` | `#21242e` | Segmented control track, input fill |
| `--border` / `--glass-border` | `rgba(255, 255, 255, 0.08)` | Crisp 1px structural hairline |
| `--border-strong` | `rgba(255, 255, 255, 0.15)` | Highlighted / focused border |
| `--text` / `--text-main` | `#f3f4f6` | Alabaster primary ink |
| `--muted` / `--text-muted` | `#9ca3af` | Neutral slate secondary label |
| `--primary` / `--blue` | `#10b981` | **Emerald Studio Accent** (Primary CTA & active state) |
| `--primary-hover` | `#059669` | Deep emerald hover |
| `--accent` / `--cyan` | `#f59e0b` | **Warm Amber Accent** (Highlights, monetary emphasis) |
| `--gold` | `#fbbf24` | Gold badge & premium indicator |
| `--green` / `--success` | `#22c55e` | Verified / Online / Positive delta |
| `--red` / `--danger` | `#ef4444` | Error / Deduction / Destructive action |

### Light Theme (`[data-theme="light"]` — Crisp Daylight Alabaster)
| Token | Value | Role |
| :--- | :--- | :--- |
| `--bg` / `--bg-dark` | `#f6f5f2` | Warm alabaster paper canvas |
| `--bg-elevated` | `#ffffff` | Pure white navigation & header surface |
| `--panel-bg` / `--card-bg` | `#ffffff` | Crisp white card surface |
| `--card-bg-hover` | `#f1f0ec` | Subtle stone hover surface |
| `--surface-subtle` | `#eeede8` | Input & pill track surface |
| `--border` / `--glass-border` | `rgba(15, 23, 42, 0.09)` | Crisp stone hairline |
| `--border-strong` | `rgba(15, 23, 42, 0.18)` | Active control border |
| `--text` / `--text-main` | `#111827` | Deep charcoal primary ink |
| `--muted` / `--text-muted` | `#6b7280` | Balanced slate secondary text |
| `--primary` / `--blue` | `#059669` | Deep Emerald primary action |
| `--accent` / `--cyan` | `#d97706` | Warm Terracotta Amber |
| `--gold` | `#b45309` | Warm bronze-gold |

---

## 3. Typography & Scannable Hierarchy
- **Primary UI Sans**: `'Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', -apple-system, sans-serif`
- **Display / Headings**: `'Plus Jakarta Sans', 'Be Vietnam Pro', sans-serif` (`font-weight: 700–800`, `letter-spacing: -0.025em`)
- **Numeric & Financial Discipline**: `'JetBrains Mono', 'Be Vietnam Pro', monospace` with `font-variant-numeric: tabular-nums` enforced across all currency values, bank accounts, hours, workdays, and timestamps.

---

## 4. Layout, Spatial Architecture & Dual Webapp/Extension Ergonomics
1. **Desktop & Tablet Webapp Mode**:
   - **Left Structural Rail (`248px` expanded / `68px` collapsed)**: Grouped into clear operational domains (*Nhân sự & Lương*, *Tài chính & POS*, *Tiện ích & Hệ thống*), with instant keyboard shortcut badges (`Alt+1`..`Alt+5`, `Ctrl+K`).
   - **Sticky Operational Topbar (`58px`)**: Breadcrumb context, **1-Click Cross-Module Pipeline Actions** (e.g., *Chấm công → Tính lương*, *Tính lương → Lập lệnh chuyển khoản*), **Quick Extension Mode / Side Panel Launcher**, **Theme Switcher (Dark/Light)**, and **Command Palette Trigger (`Ctrl+K`)**.
2. **Browser Extension Mode (`?mode=extension` or viewport `< 520px` / Chrome Side Panel & Popup)**:
   - Automatically adapts into a compact, zero-waste **Quick Companion Workspace** with a bottom/top dock, instant VietQR POS generator, 1-click TTS broadcast, and Bank Account / Attendance quick tools.
