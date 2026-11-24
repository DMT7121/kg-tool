# KG Studio — Design System & Architecture (`DESIGN.md`)

## 1. Visual Direction & Usability Philosophy (Option G — Command Home Launchpad)
- **Domain**: Enterprise F&B Operations, POS Billing (VietQR), AI TTS Broadcast, HR Payroll K80 & FinTech Disbursement Suite (`KG Studio`).
- **Aesthetic Persona**: **Command Home Launchpad — Ocean Sapphire** (grounded in NN/g Usability Heuristics, Fitts's Law, Jakob's Law, Square POS, and Apple HIG).
- **Core UX Upgrades**:
  - **6 Large 1-Click Launchpad Tiles** on the default Home screen showing live operational metrics and instant action buttons so new staff and cashiers know where to tap in under 2 seconds.
  - **Single-Tier Full-Label Top Navigation (`58px`)**: Eliminated the redundant dual-tier ribbon; every navigation item pairs a crisp `lucide-react` icon with a clear Vietnamese text label.
  - **Ergonomic Touch & Desk Controls**: Comfortable `40px` table rows, `38–44px` buttons (`>= 44px` on touch/mobile), semantic `<button>` controls throughout, zero glassmorphism blur bottlenecks, and `10–14px` clean surface radii.
  - **Dual Deployment**: Standalone Webapp (PWA) + Chrome/Edge Extension Side Panel (`420px`) & Mobile Dock with full access to all 7 modules + Home.

---

## 2. Color & Atmospheric Polarity (Dual Adaptive Palette)

### Light Theme (`[data-theme="light"]` — Default Soft Sky-Cloud & Ocean Sapphire)
| Token | Value | Role |
| :--- | :--- | :--- |
| `--bg-canvas` / `--bg-base` | `#F5F8FB` | Soft sky-cloud primary canvas |
| `--bg-surface` / `--bg-panel` | `#FFFFFF` | Crisp elevated card & header surface |
| `--bg-subtle` | `#EAF1F7` | Subtle input/pill track & table header |
| `--border-default` | `#D4E0EC` | Clean 1px structural sky hairline |
| `--border-strong` | `#B3C6D9` | Focused / active border |
| `--text-primary` | `#0F1C2A` | High-contrast marine charcoal ink |
| `--text-muted` | `#4A5E73` | WCAG AA balanced secondary text |
| `--accent-primary` | `#0369A1` | **Ocean Sapphire** (Primary CTA & active nav) |
| `--accent-primary-hover` | `#075985` | Deep sapphire hover |
| `--accent-primary-subtle` | `#E0F2FE` | Soft sapphire active highlight |
| `--status-success` | `#15803D` | Verified / Sheets Live |
| `--status-warning` | `#B45309` | Warnings & highlights |
| `--status-danger` | `#B42318` | Destructive actions & errors |

### Dark Theme (`[data-theme="dark"]` — Deep Marine Slate & Crisp Sky)
| Token | Value | Role |
| :--- | :--- | :--- |
| `--bg-canvas` / `--bg-base` | `#0B1219` | Deep marine slate canvas |
| `--bg-surface` / `--bg-panel` | `#131D27` | Elevated card & header surface |
| `--bg-subtle` | `#1C2937` | Pill track & subtle container |
| `--border-default` | `#263749` | Crisp dark marine hairline |
| `--text-primary` | `#F0F6FC` | Clean alabaster ink |
| `--text-muted` | `#94A7BC` | Balanced slate muted label |
| `--accent-primary` | `#38BDF8` | **Crisp Sky** accent |
| `--accent-contrast` | `#062030` | High-contrast ink on bright sky |

---

## 3. Typography & Numeric Discipline
- **Display / Headings**: `'Plus Jakarta Sans', 'Be Vietnam Pro', -apple-system, sans-serif`
- **Body / UI**: `'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, sans-serif`
- **Financial & Tabular Data**: `'JetBrains Mono', 'IBM Plex Mono', monospace` with `font-variant-numeric: tabular-nums` right-aligned across all VNĐ amounts, bank accounts, hours, and workdays.
