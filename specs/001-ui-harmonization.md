# Feature Specification: Harmonized Webapp UI/UX Across All Modules

**Feature Branch**: `001-ui-harmonization`  
**Created**: 2026-08-07  
**Status**: Specified & Ready for Implementation  
**Input**: "Sử dụng spec-kit cân chỉnh giao diện webapp dễ thao tác hơn, gọn gàng và chuyên nghiệp hơn. Nghiên cứu giao diện đồng bộ, dễ thao tác ở tất cả module"

---

## Executive Summary

This specification defines the UI/UX harmonization and visual/operational alignment across all 7 functional modules of the `kg-tool` webapp:
1. **Shell & Navigation** (Sidebar, Mobile Drawer, Header Bar, Global Status Bar)
2. **Attendance Processing** (Chấm công)
3. **VietQR & Bill Splitter** (Thanh toán & Chia tiền Bàn)
4. **Payroll Creator** (Bảng lương & Phiếu lương)
5. **Transfer File Tool** (Chuyển đổi dữ liệu File)
6. **Text-To-Speech / TTS** (Chuyển văn bản thành giọng nói)
7. **Hikvision Cloud Sync** (Đồng bộ thiết bị chấm công Hikvision)
8. **Settings & Presets** (Cấu hình hệ thống & Tài khoản ngân hàng)

---

## User Scenarios & Testing

### User Story 1 - Unified Design System & App Shell (Priority: P1)
**Description**: As a user navigating between modules, I want a seamless, responsive sidebar and header layout with unified typography, color themes, glassmorphism cards, and clear state indicators so that the application feels cohesive and premium.

**Independent Test**: Switch between all 7 modules on desktop (1920x1080), tablet (768x1024), and mobile (375x812). Confirm sidebar collapses smoothly, mobile drawer functions properly, active tab highlight is prominent, and top bar shows consistent title + connection badge.

**Acceptance Scenarios**:
1. **Given** any screen size, **When** switching tabs, **Then** the page header title, subtext, icon, and action buttons follow a standard 2-column header pattern.
2. **Given** mobile resolution, **When** clicking the hamburger menu, **Then** a smooth slide-out drawer appears with touch-friendly tap targets (>= 48px).

---

### User Story 2 - Module Action Cards & Input Controls Harmonization (Priority: P1)
**Description**: As an operator filling forms or uploading files in Attendance, VietQR, Payroll, File Transfer, TTS, or Hikvision Sync, I want consistent input fields, dropdowns, primary/secondary action buttons, status pills, and drag-and-drop zones.

**Independent Test**: Open form inputs, file upload areas, action buttons, and modal dialogs in Attendance, VietQR, Payroll, File Transfer, TTS, and Hikvision Sync. Verify identical border-radius (`var(--radius)`), glassmorphism background, focus glow, font size (`14px`/`15px`), and button hierarchy (`btn-primary`, `btn-secondary`, `btn-danger`, `btn-success`).

**Acceptance Scenarios**:
1. **Given** any file upload zone (Attendance or File Transfer), **When** dragging files or hovering, **Then** display high-contrast drag targets with smooth border animation and upload progress indicators.
2. **Given** form fields in VietQR, Payroll, TTS, or Settings, **When** focusing or typing, **Then** show glowing accent borders with zero layout jump and clear validation labels.

---

### User Story 3 - Data Tables & Summary Stat Cards Refinement (Priority: P2)
**Description**: As a manager reviewing attendance records or payroll sheets, I want high-density yet readable data tables with sticky headers, soft hover rows, clear status badges, filter search inputs, and pagination/scroll controls.

**Independent Test**: Load sample attendance file or payroll data, filter rows, and test scrolling. Ensure summary cards (Total records, Worked days, Total Salary, Sync status) display uniform stat layouts with subtle gradients and crisp icons.

**Acceptance Scenarios**:
1. **Given** large attendance or payroll data tables, **When** scrolling, **Then** table header remains sticky, row contrast is crisp in dark mode, and badges (e.g. "Đủ công", "Đi trễ", "Vắng") have color-coded pill indicators.
2. **Given** empty state (no file loaded), **When** opening Attendance, Payroll, or Transfer File modules, **Then** render empty state illustration with clear call-to-action button.

---

### User Story 4 - High-Touch Utility Tools Harmonization (VietQR, TTS, Hikvision Sync) (Priority: P2)
**Description**: As a restaurant staff using VietQR bill splitting, TTS voice generation, or Hikvision sync, I want streamlined control panels, quick preset buttons, and live output previews (QR receipts, Audio players, Log terminals).

**Independent Test**: Generate a VietQR receipt, test TTS audio preview, and open Hikvision live event log. Verify receipt preview fits screen comfortably, TTS play/pause control is clean, and Hikvision terminal window has clear color-coded log levels.

**Acceptance Scenarios**:
1. **Given** VietQR split bill mode, **When** adjusting bill count or guest share, **Then** update receipt card and QR generator instantly without clutter.
2. **Given** Hikvision live event logs, **When** logs stream, **Then** render terminal log panel with dark monospace font, auto-scroll toggle, and copy/clear log actions.

---

## Functional Requirements

- **FR-001**: System MUST establish a unified CSS design system in `src/index.css` & `src/App.css` containing tokens for colors, glass panels, card padding, button states, and form controls.
- **FR-002**: System MUST render a standardized Page Header bar (`PageHeader` component or pattern) across `Attendance`, `VietQR`, `Payroll`, `Transfer File`, `TTS`, `Hikvision Sync`, and `Settings`.
- **FR-003**: System MUST provide unified `StatCard`, `EmptyState`, `GuidePanel`, and `Badge` components across all modules.
- **FR-004**: System MUST align input fields, file upload zones, select boxes, toggle switches, and tab switchers to use consistent styling, focus indicators, and spacing.
- **FR-005**: System MUST ensure responsive layout behavior across desktop, tablet, and mobile screens without horizontal overflow or overlapping text.
- **FR-006**: System MUST maintain existing functional logic (GAS integration, Excel processing, VietQR API, TTS web speech, Hikvision fetch/sync) completely intact with zero regressions.

---

## Success Criteria

- **SC-001**: 100% of modules (`Attendance`, `VietQR`, `Payroll`, `Transfer File`, `TTS`, `Hikvision Sync`, `Settings`) share the identical header layout, primary button style, glass card style, and typography.
- **SC-002**: Zero horizontal page scroll on desktop (1920px), laptop (1366px), tablet (768px), and mobile (375px).
- **SC-003**: Form input focus states, button hover effects, and tab transitions complete smoothly under 150ms.
- **SC-004**: All existing tool functionalities (Excel export, QR code generation, Payroll calculations, File conversions, TTS playback, Hikvision syncing) execute without any runtime errors or broken state.
