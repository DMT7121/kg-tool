# Feature Specification: Consolidated & Streamlined Webapp Modules Architecture

**Feature Branch**: `002-module-consolidation`  
**Created**: 2026-08-07  
**Status**: Specified & Ready for Implementation  
**Input**: "Sử dụng Spec-kit và nghiên cứu hoàn thiện, đồng bộ toàn bộ webapp theo hướng chuyên nghiệp và dễ sử dụng. Có thể gộp các chức năng, module tương đồng để xử lý hoặc đề xuất hoàn thiện hiệu quả"

---

## Executive Summary

To elevate `kg-tool` from 7 fragmented top-level navigation tabs into a highly professional, workflow-driven SaaS application, this spec defines a consolidated 5-Module Hub Architecture with sub-tab navigators:

1. 🕒 **Quản Lý Chấm Công & Thiết Bị** (Merged `Attendance` + `Hikvision Sync`)
   - Sub-tab 1: 📊 **Xử Lý Chấm Công & Phân Ca** (Excel/CSV upload, night shift cleaner, Apps Script sync).
   - Sub-tab 2: 🔌 **Máy Chấm Công Cloud (Hikvision)** (Webhook config, live logs, connection status).

2. 💰 **Quản Lý Lương & Chuyển Tiền** (Merged `Payroll Creator` + `Bank Transfer File Tool`)
   - Sub-tab 1: 📑 **Bảng Lương & Phiếu Lương** (Salary calculations, K80/A4 payslips, smart employee selector).
   - Sub-tab 2: 📤 **Chuyển Tiền Ngân Hàng Hàng Loạt** (Auto-convert salary list to VIB/VCB transfer files, file converter).

3. 💳 **Thanh Toán VietQR & Thu Ngân** (`VietQR` & `Bill Splitter`)
   - Sub-tab 1: ⚡ **Tạo Mã VietQR Nhanh** (Dynamic Napas247 QR, branded receipt generator).
   - Sub-tab 2: 🍽️ **Chia Tiền Bàn (Split Bill)** (Equal/custom bill splitting for restaurant tables).

4. 🔊 **Thông Báo Giọng Nói AI (TTS)** (`Text-To-Speech`)
   - Sub-tab 1: 🎙️ **Phát Giọng Đọc Thông Báo** (Vietnamese Web Speech AI, pitch/rate controls).
   - Sub-tab 2: 📚 **Mẫu Câu Nghiệp Vụ & Lịch Sử** (Restaurant voice templates & history).

5. ⚙️ **Cấu Hình System & Cloud** (`Settings`)
   - Sub-tab 1: 🔗 **Kết Nối Google Apps Script** (URL API, Spreadsheet ID, live diagnostic test).
   - Sub-tab 2: 🏦 **Tài Khoản Thụ Hưởng** (Saved bank account preset manager).

---

## User Scenarios & Testing

### User Story 1 - Streamlined Navigation & Sub-Tab Bar (Priority: P1)
**Description**: As a restaurant manager, I want a clean 5-category sidebar menu with clear sub-tab navigation bars inside each module hub, so that related tasks (e.g. attendance processing + Hikvision sync, or Payroll + Bank Transfers) are grouped together logically.

**Acceptance Scenarios**:
1. **Given** the main sidebar, **When** viewing navigation options, **Then** render 5 clean top-level hubs with crisp icons and badges.
2. **Given** any module hub (e.g. Quản Lý Lương & Chuyển Tiền), **When** clicking sub-tabs, **Then** switch views instantly without full page reloads or layout shifts.

---

### User Story 2 - Integrated Payroll-to-Bank Transfer Flow (Priority: P1)
**Description**: As an accountant who calculated payroll, I want to immediately export bank transfer files (MyVIB / Vietcombank) using the calculated net salaries with 1 click, without re-entering employee data.

**Acceptance Scenarios**:
1. **Given** calculated payroll data, **When** switching to "Chuyển Tiền Ngân Hàng", **Then** offer a 1-click button to populate bank transfer rows directly from net salary records.

---

## Success Criteria

- **SC-001**: Reduce top-level sidebar items from 7 to 5 logical hubs while keeping 100% of existing capabilities.
- **SC-002**: Sub-tab navigation transition time < 50ms with zero layout distortion.
- **SC-003**: 100% of buttons, input fields, cards, and table layouts share the identical Spec-Kit design system.
