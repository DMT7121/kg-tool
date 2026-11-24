import { parseSmartCurrency, parseSmartDecimal, removeVietnameseAccents, unwrapExcelCellValue } from './numberUtils';

export type SlipItemType = 'add' | 'deduct' | 'info';
export type PayrollSalaryMode = 'monthly' | 'hourly' | 'restaurant';
export type PayrollRoundMode = 'none' | 'hundred' | 'thousand';

export interface SlipAdjustmentItem {
  id: string;
  label: string;
  type: SlipItemType;
  amount: number;
  note?: string;
  visible?: boolean;
}

export interface PayrollEmployee {
  id: string;
  name: string;
  role?: string;
  dept?: string;
  days: number;
  range: string;
  salary: number;
  amount: number;
  advance?: number;
  addedDays?: number;
  totalHours?: number;
  workedDays?: number;
  lunchPay?: number;
  bonus?: number;
  overtimePay?: number;
  deduction?: number;
  slipItems?: SlipAdjustmentItem[];
  useCustomSlipItems?: boolean;
  sourceType?: 'manual' | 'excel' | 'image' | 'text' | 'attendance';
}

export interface SlipDisplayRow {
  id: string;
  label: string;
  valueText: string;
  amount?: number;
  kind: 'meta' | 'base' | 'add' | 'deduct' | 'info' | 'total';
  isBold?: boolean;
}

export interface ParsedPayrollResult {
  employees: PayrollEmployee[];
  detectedFormat: 'excel-blocks' | 'excel-table' | 'text-table' | 'text-blocks' | 'text-inline';
  detectedColumns: string[];
  warnings: string[];
}

export const QUICK_SLIP_ITEM_TEMPLATES: Array<{ label: string; type: SlipItemType; defaultAmount: number }> = [
  { label: 'Tiền cơm', type: 'add', defaultAmount: 520000 },
  { label: 'Thưởng KPI', type: 'add', defaultAmount: 500000 },
  { label: 'Tăng ca', type: 'add', defaultAmount: 300000 },
  { label: 'Phụ cấp gửi xe', type: 'add', defaultAmount: 200000 },
  { label: 'Thưởng lễ / nóng', type: 'add', defaultAmount: 300000 },
  { label: 'Tạm ứng lương', type: 'deduct', defaultAmount: 1000000 },
  { label: 'Đổ bể / Hư hỏng', type: 'deduct', defaultAmount: 100000 },
  { label: 'Phạt đi trễ', type: 'deduct', defaultAmount: 100000 },
  { label: 'Đồng phục / Quỹ', type: 'deduct', defaultAmount: 150000 },
  { label: 'BHXH / Khấu trừ khác', type: 'deduct', defaultAmount: 300000 },
];

export function createSlipItemId(prefix = 'item'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function roundPayrollAmount(n: number, mode: PayrollRoundMode): number {
  if (mode === 'thousand') return Math.round(n / 1000) * 1000;
  if (mode === 'hundred') return Math.round(n / 100) * 100;
  return Math.round(n);
}

/**
 * Parses Vietnamese shorthand money strings such as:
 * "9tr", "8.5tr", "500k", "+520k", "-150.000", "1,250,000 đ"
 */
export function parseVietnameseMoneyShorthand(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : 0;
  const text = String(raw ?? '').trim();
  if (!text) return 0;

  const isNeg = /^\s*[-−–]/.test(text) || /\(\s*-\s*\)/.test(text);
  const lower = text.toLowerCase().replace(/vnđ|vnd|đ/g, '').trim();

  // Match "8.5tr" or "8,5 tr" or "9 triệu"
  const trMatch = lower.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:tr|trieu|triệu)\b/);
  if (trMatch) {
    const num = Number(trMatch[1].replace(',', '.'));
    if (Number.isFinite(num)) {
      const val = Math.round(num * 1_000_000);
      return isNeg ? -val : val;
    }
  }

  // Match "500k" or "120.5k" or "500 nghìn"
  const kMatch = lower.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:k|nghin|nghìn|ngan|ngàn)\b/);
  if (kMatch) {
    const num = Number(kMatch[1].replace(',', '.'));
    if (Number.isFinite(num)) {
      const val = Math.round(num * 1_000);
      return isNeg ? -val : val;
    }
  }

  const parsed = Math.round(parseSmartCurrency(text));
  if (isNeg && parsed > 0) return -parsed;
  return parsed;
}

const DEDUCT_KEYWORDS = [
  'tru', 'khau tru', 'phat', 'di tre', 've som', 'do be', 'vo ly', 'hu hong',
  'tam ung', 'ung luong', 'ung', 'bhxh', 'bao hiem', 'dong phuc', 'quy', 'no',
  'boi thuong', 'nghi khong phep', 'sai sot', 'mat hang', 'thieu tien', '(-)', '( - )'
];

const ADD_KEYWORDS = [
  'thuong', 'phu cap', 'tien com', 'com', 'an ca', 'tang ca', 'ot', 'gui xe',
  'xang xe', 'nha tro', 'chuyen can', 'trach nhiem', 'ho tro', 'tip', 'hoa hong',
  'doanh so', 'kpi', 'le', 'tet', 'bu', 'cong them', '(+)', '( + )'
];

const SKIP_COMPUTED_LABELS = [
  'quy doi', 'luong theo gio', 'tong nhan', 'thuc lanh', 'thuc nhan',
  'tong cong', 'thanh tien', 'tong thu nhap', 'bang chu', 'ky ten',
  'nguoi nhan', 'nguoi lap', 'stt', 'tong luong'
];

export function inferAdjustmentType(label: string, signedValue = 0): SlipItemType {
  if (signedValue < 0) return 'deduct';
  const norm = removeVietnameseAccents(label).toLowerCase().trim();
  if (DEDUCT_KEYWORDS.some(k => norm.includes(k))) return 'deduct';
  if (ADD_KEYWORDS.some(k => norm.includes(k))) return 'add';
  return signedValue > 0 ? 'add' : 'info';
}

export function isComputedSummaryLabel(label: string): boolean {
  const norm = removeVietnameseAccents(label).toLowerCase().trim();
  return SKIP_COMPUTED_LABELS.some(k => norm === k || norm.startsWith(k + ' ') || norm.includes(k));
}

/**
 * Calculates base pay BEFORE additions/deductions across all 3 salary modes.
 */
export function calculateBasePay(
  emp: PayrollEmployee,
  mode: PayrollSalaryMode,
  standardDays: number,
  roundMode: PayrollRoundMode
): { basePay: number; quyDoi: number; workedDays: number; addedDays: number } {
  const salary = Number(emp.salary || 0);
  const workedDays = emp.workedDays !== undefined ? Number(emp.workedDays) : Number(emp.days || 0);
  const addedDays = Number(emp.addedDays || 0);

  if (mode === 'restaurant') {
    const quyDoi = Math.round(salary / 240);
    const basePay = Math.round((salary * (workedDays + addedDays)) / 30);
    return { basePay, quyDoi, workedDays, addedDays };
  }
  if (mode === 'hourly') {
    const basePay = roundPayrollAmount(salary * Number(emp.days || 0), roundMode);
    return { basePay, quyDoi: salary, workedDays: Number(emp.days || 0), addedDays: 0 };
  }
  const safeStdDays = standardDays > 0 ? standardDays : 26;
  const basePay = roundPayrollAmount((salary * Number(emp.days || 0)) / safeStdDays, roundMode);
  return { basePay, quyDoi: Math.round(salary / safeStdDays), workedDays: Number(emp.days || 0), addedDays: 0 };
}

/**
 * Converts legacy scalar fields into explicit per-employee slipItems
 * while guaranteeing exact net pay preservation (zero VNĐ drift).
 */
export function buildLegacySlipItems(emp: PayrollEmployee, mode: PayrollSalaryMode): SlipAdjustmentItem[] {
  const items: SlipAdjustmentItem[] = [];
  const workedDays = emp.workedDays !== undefined ? Number(emp.workedDays) : Number(emp.days || 0);

  if (mode === 'restaurant') {
    const tienCom = emp.lunchPay !== undefined ? Number(emp.lunchPay) : workedDays * 20000;
    const thuong = Number(emp.bonus || 0);
    const tangCa = Number(emp.overtimePay || 0);
    const tamUng = Number(emp.advance || 0);
    const doBe = Number(emp.deduction || 0);

    if (tienCom > 0) {
      items.push({ id: createSlipItemId('com'), label: 'Tiền cơm', type: 'add', amount: Math.round(tienCom), visible: true });
    }
    if (thuong > 0) {
      items.push({ id: createSlipItemId('bon'), label: 'Thưởng', type: 'add', amount: Math.round(thuong), visible: true });
    }
    if (tangCa > 0) {
      items.push({ id: createSlipItemId('ot'), label: 'Tăng ca', type: 'add', amount: Math.round(tangCa), visible: true });
    }
    if (tamUng > 0) {
      items.push({ id: createSlipItemId('adv'), label: 'Tạm ứng lương', type: 'deduct', amount: Math.round(tamUng), visible: true });
    }
    if (doBe > 0) {
      items.push({ id: createSlipItemId('ded'), label: 'Đổ bể / Khấu trừ', type: 'deduct', amount: Math.round(doBe), visible: true });
    }
  } else {
    const bonus = Number(emp.bonus || 0);
    const overtimePay = Number(emp.overtimePay || 0);
    const lunchPay = Number(emp.lunchPay || 0);
    const advance = Number(emp.advance || 0);
    const deduction = Number(emp.deduction || 0);

    if (lunchPay > 0) {
      items.push({ id: createSlipItemId('com'), label: 'Phụ cấp cơm', type: 'add', amount: Math.round(lunchPay), visible: true });
    }
    if (bonus > 0) {
      items.push({ id: createSlipItemId('bon'), label: 'Thưởng', type: 'add', amount: Math.round(bonus), visible: true });
    }
    if (overtimePay > 0) {
      items.push({ id: createSlipItemId('ot'), label: 'Tăng ca', type: 'add', amount: Math.round(overtimePay), visible: true });
    }
    if (advance > 0) {
      items.push({ id: createSlipItemId('adv'), label: 'Tạm ứng lương', type: 'deduct', amount: Math.round(advance), visible: true });
    }
    if (deduction > 0) {
      items.push({ id: createSlipItemId('ded'), label: 'Khấu trừ cá nhân', type: 'deduct', amount: Math.round(deduction), visible: true });
    }
  }

  return items;
}

export function getEffectiveSlipItems(emp: PayrollEmployee, mode: PayrollSalaryMode): SlipAdjustmentItem[] {
  if (emp.useCustomSlipItems) {
    return Array.isArray(emp.slipItems) ? emp.slipItems : [];
  }
  const baseLegacy = buildLegacySlipItems(emp, mode);
  const extra = Array.isArray(emp.slipItems) ? emp.slipItems : [];
  return [...baseLegacy, ...extra];
}

export function sumSlipItems(items: SlipAdjustmentItem[]): {
  addTotal: number;
  deductTotal: number;
  visibleAddCount: number;
  visibleDeductCount: number;
  visibleCount: number;
} {
  let addTotal = 0;
  let deductTotal = 0;
  let visibleAddCount = 0;
  let visibleDeductCount = 0;
  let visibleCount = 0;

  for (const item of items) {
    if (item.visible === false) continue;
    visibleCount += 1;
    const amt = Math.round(Math.abs(Number(item.amount || 0)));
    if (item.type === 'add') {
      addTotal += amt;
      visibleAddCount += 1;
    } else if (item.type === 'deduct') {
      deductTotal += amt;
      visibleDeductCount += 1;
    }
  }

  return { addTotal, deductTotal, visibleAddCount, visibleDeductCount, visibleCount };
}

/**
 * Single source of truth for employee net pay calculation.
 */
export function computeDynamicEmployeeTotals(
  emp: PayrollEmployee,
  mode: PayrollSalaryMode,
  standardDays: number,
  roundMode: PayrollRoundMode
) {
  const { basePay, quyDoi, workedDays, addedDays } = calculateBasePay(emp, mode, standardDays, roundMode);
  const items = getEffectiveSlipItems(emp, mode);
  const { addTotal, deductTotal, visibleAddCount, visibleDeductCount, visibleCount } = sumSlipItems(items);
  const netPay = basePay + addTotal - deductTotal;

  return {
    basePay,
    quyDoi,
    workedDays,
    addedDays,
    items,
    addTotal,
    deductTotal,
    visibleAddCount,
    visibleDeductCount,
    visibleCount,
    netPay,
  };
}

/**
 * Normalizes a single employee slip:
 * - Converts legacy fields into explicit slipItems (sets useCustomSlipItems = true)
 * - Removes/hides zero-value items (except info items with notes)
 * - Sorts additions (+) first, deductions (-) next, info lines last
 * - Recalculates exact netPay into emp.amount
 */
export function normalizeEmployeeSlip(
  emp: PayrollEmployee,
  mode: PayrollSalaryMode,
  standardDays: number,
  roundMode: PayrollRoundMode,
  options: { removeZeroRows?: boolean } = { removeZeroRows: true }
): PayrollEmployee {
  const rawItems = getEffectiveSlipItems(emp, mode);
  const cleaned = rawItems
    .map(item => ({
      ...item,
      label: item.label.trim() || (item.type === 'deduct' ? 'Khoản khấu trừ' : 'Khoản cộng thêm'),
      amount: Math.round(Math.abs(Number(item.amount || 0))),
      visible: item.visible !== false,
    }))
    .filter(item => {
      if (!options.removeZeroRows) return true;
      if (item.type === 'info') return Boolean(item.note?.trim() || item.label.trim());
      return item.amount > 0;
    });

  const orderWeight = (t: SlipItemType) => (t === 'add' ? 0 : t === 'deduct' ? 1 : 2);
  cleaned.sort((a, b) => orderWeight(a.type) - orderWeight(b.type));

  const normalized: PayrollEmployee = {
    ...emp,
    useCustomSlipItems: true,
    slipItems: cleaned,
    // Keep legacy scalars zeroed when custom items own all adjustments so external tools never double-count
    lunchPay: 0,
    bonus: 0,
    overtimePay: 0,
    deduction: 0,
    advance: 0,
  };

  const totals = computeDynamicEmployeeTotals(normalized, mode, standardDays, roundMode);
  normalized.amount = totals.netPay;
  return normalized;
}

/**
 * Builds the exact visible rows for rendering K80 / Standard A4 / Modern A4 slips.
 * Each employee can have a completely different number of rows depending on their adjustments!
 */
export function buildSlipRenderRows(
  emp: PayrollEmployee,
  mode: PayrollSalaryMode,
  standardDays: number,
  roundMode: PayrollRoundMode,
  formatMoney: (n: number) => string,
  visibility: { showTime: boolean; showBaseSalary: boolean; showAdvance: boolean; showDeductions: boolean },
  hideEmptyRows = true
): { rows: SlipDisplayRow[]; totals: ReturnType<typeof computeDynamicEmployeeTotals> } {
  const totals = computeDynamicEmployeeTotals(emp, mode, standardDays, roundMode);
  const rows: SlipDisplayRow[] = [];

  if (mode === 'restaurant') {
    if (visibility.showTime) {
      if (totals.addedDays > 0 || !hideEmptyRows) {
        rows.push({
          id: 'added-days',
          label: 'Ngày cộng thêm (lễ, bù off)',
          valueText: String(totals.addedDays),
          kind: 'meta',
        });
      }
      if ((emp.totalHours || 0) > 0 || !hideEmptyRows) {
        rows.push({
          id: 'total-hours',
          label: 'Tổng giờ làm/tháng',
          valueText: `${emp.totalHours || 0} giờ`,
          kind: 'meta',
        });
      }
      rows.push({
        id: 'worked-days',
        label: 'Số ngày làm/tháng',
        valueText: `${totals.workedDays} công`,
        kind: 'meta',
      });
    }
    if (visibility.showBaseSalary) {
      rows.push({
        id: 'base-salary',
        label: 'Mức lương cơ bản',
        valueText: formatMoney(emp.salary),
        kind: 'meta',
      });
      rows.push({
        id: 'hourly-rate',
        label: 'Quy đổi (lương/giờ)',
        valueText: formatMoney(totals.quyDoi),
        kind: 'meta',
      });
    }
    rows.push({
      id: 'base-pay',
      label: 'Lương theo công thực tế',
      valueText: formatMoney(totals.basePay),
      amount: totals.basePay,
      kind: 'base',
      isBold: true,
    });
  } else if (mode === 'hourly') {
    if (visibility.showBaseSalary) {
      rows.push({
        id: 'hourly-salary',
        label: 'Đơn giá lương giờ',
        valueText: `${formatMoney(emp.salary)} / giờ`,
        kind: 'meta',
      });
    }
    if (visibility.showTime) {
      rows.push({
        id: 'worked-hours',
        label: 'Tổng số giờ làm việc',
        valueText: emp.range ? `${emp.days} giờ (${emp.range})` : `${emp.days} giờ`,
        kind: 'meta',
      });
    }
    rows.push({
      id: 'base-pay',
      label: 'Lương theo giờ',
      valueText: formatMoney(totals.basePay),
      amount: totals.basePay,
      kind: 'base',
      isBold: true,
    });
  } else {
    if (visibility.showBaseSalary) {
      rows.push({
        id: 'monthly-salary',
        label: 'Mức lương cơ bản',
        valueText: formatMoney(emp.salary),
        kind: 'meta',
      });
    }
    if (visibility.showTime) {
      rows.push({
        id: 'worked-days',
        label: 'Công định mức / Thực tế',
        valueText: `${standardDays} / ${emp.days} công`,
        kind: 'meta',
      });
    }
    rows.push({
      id: 'base-pay',
      label: 'Lương theo ngày công',
      valueText: formatMoney(totals.basePay),
      amount: totals.basePay,
      kind: 'base',
      isBold: true,
    });
  }

  // Dynamic per-employee adjustment lines (each employee has their own exact lines!)
  for (const item of totals.items) {
    if (item.visible === false) continue;
    const normLabel = removeVietnameseAccents(item.label).toLowerCase();
    const isAdvanceItem = normLabel.includes('tam ung') || normLabel.includes('ung luong');
    if (isAdvanceItem && !visibility.showAdvance) continue;
    if (item.type === 'deduct' && !isAdvanceItem && !visibility.showDeductions) continue;
    if (hideEmptyRows && item.type !== 'info' && item.amount === 0) continue;

    const labelWithNote = item.note?.trim() ? `${item.label} (${item.note.trim()})` : item.label;
    if (item.type === 'add') {
      rows.push({
        id: item.id,
        label: `${labelWithNote} (+)`,
        valueText: `+${formatMoney(item.amount)}`,
        amount: item.amount,
        kind: 'add',
      });
    } else if (item.type === 'deduct') {
      rows.push({
        id: item.id,
        label: `${labelWithNote} (-)`,
        valueText: `-${formatMoney(item.amount)}`,
        amount: -item.amount,
        kind: 'deduct',
      });
    } else {
      rows.push({
        id: item.id,
        label: item.label,
        valueText: item.note?.trim() || (item.amount > 0 ? formatMoney(item.amount) : '—'),
        kind: 'info',
      });
    }
  }

  return { rows, totals };
}

/**
 * Parses a tabular matrix (from Excel horizontal table or pasted TSV/CSV)
 * preserving EVERY extra column as dynamic per-employee slipItems!
 */
export function parseTabularPayrollMatrix(
  matrix: Array<Array<unknown>>,
  mode: PayrollSalaryMode,
  standardDays: number,
  roundMode: PayrollRoundMode,
  payMonth: string,
  sourceType: 'excel' | 'text' = 'excel'
): ParsedPayrollResult {
  const warnings: string[] = [];
  const cleanRows = matrix.filter(r => r.some(cell => String(cell ?? '').trim() !== ''));
  if (cleanRows.length < 2) {
    return { employees: [], detectedFormat: sourceType === 'excel' ? 'excel-table' : 'text-table', detectedColumns: [], warnings: ['Bảng cần ít nhất 1 dòng tiêu đề và 1 dòng nhân viên.'] };
  }

  // Locate header row within first 8 rows
  let headerIdx = 0;
  for (let i = 0; i < Math.min(8, cleanRows.length); i++) {
    const joined = removeVietnameseAccents(cleanRows[i].map(c => String(c ?? '')).join(' ')).toLowerCase();
    if (joined.includes('ho ten') || joined.includes('ho va ten') || joined.includes('nhan vien') || joined.includes('ten nv')) {
      headerIdx = i;
      break;
    }
  }

  const headers = cleanRows[headerIdx].map((h, idx) => String(h ?? '').trim() || `Cột ${idx + 1}`);
  const normHeaders = headers.map(h => removeVietnameseAccents(h).toLowerCase().trim());

  const findCol = (patterns: string[], exclude: string[] = []) =>
    normHeaders.findIndex(h =>
      patterns.some(p => h.includes(p)) && !exclude.some(ex => h.includes(ex))
    );

  let nameCol = findCol(['ho va ten', 'ho ten', 'ten nhan vien', 'ten nv', 'nhan vien', 'full name', 'name']);
  if (nameCol < 0) nameCol = normHeaders[0] === 'stt' || normHeaders[0] === '#' ? 1 : 0;

  const sttCol = findCol(['stt', 'ma nv', 'id']);
  const roleCol = findCol(['chuc vu', 'vi tri', 'role', 'position']);
  const deptCol = findCol(['bo phan', 'phong ban', 'department', 'dept']);
  const daysCol = findCol(['so ngay lam', 'ngay cong', 'so cong', 'cong thuc te', 'cong', 'so gio', 'gio lam'], ['cong them', 'bu ngay', 'dinh muc']);
  const addedDaysCol = findCol(['ngay cong them', 'bu ngay', 'cong them', 'ngay le']);
  const hoursCol = findCol(['tong gio lam', 'gio lam/thang', 'tong gio']);
  const rangeCol = findCol(['thoi gian', 'ky luong', 'khoang thoi gian', 'tu ngay']);
  const salaryCol = findCol(['muc luong', 'luong co ban', 'luong cb', 'luong hien tai', 'luong chinh', 'luong gio', 'don gia'], ['theo gio', 'thuc lanh', 'thuc nhan', 'tong']);

  const reservedCols = new Set(
    [nameCol, sttCol, roleCol, deptCol, daysCol, addedDaysCol, hoursCol, rangeCol, salaryCol].filter(i => i >= 0)
  );

  // Any remaining non-computed column becomes a dynamic adjustment column!
  const dynamicCols: Array<{ idx: number; label: string; defaultType: SlipItemType }> = [];
  headers.forEach((label, idx) => {
    if (reservedCols.has(idx)) return;
    if (!label || isComputedSummaryLabel(label)) return;
    const norm = normHeaders[idx];
    if (norm === 'ghi chu' || norm === 'note' || norm === 'stk' || norm === 'ngan hang' || norm === 'so tai khoan') return;
    dynamicCols.push({ idx, label, defaultType: inferAdjustmentType(label, 1) });
  });

  const employees: PayrollEmployee[] = [];
  const defaultRange = payMonth ? `${payMonth.split('-')[1]}/${payMonth.split('-')[0]}` : '';

  for (let r = headerIdx + 1; r < cleanRows.length; r++) {
    const row = cleanRows[r];
    const name = String(row[nameCol] ?? '').trim();
    if (!name) continue;
    const normName = removeVietnameseAccents(name).toLowerCase();
    if (normName.startsWith('tong') || normName.startsWith('cong:') || normName === 'tong cong') continue;

    const days = daysCol >= 0 ? parseSmartDecimal(row[daysCol]) : (mode === 'hourly' ? 160 : 26);
    const addedDays = addedDaysCol >= 0 ? parseSmartDecimal(row[addedDaysCol]) : 0;
    const totalHours = hoursCol >= 0 ? parseSmartDecimal(row[hoursCol]) : (mode === 'hourly' ? days : days * 8);
    const salary = salaryCol >= 0
      ? Math.abs(parseVietnameseMoneyShorthand(row[salaryCol]))
      : (mode === 'hourly' ? 35000 : 8000000);
    const role = roleCol >= 0 ? String(row[roleCol] ?? '').trim() : undefined;
    const dept = deptCol >= 0 ? String(row[deptCol] ?? '').trim() : undefined;
    const range = rangeCol >= 0 ? String(row[rangeCol] ?? '').trim() || defaultRange : defaultRange;

    const slipItems: SlipAdjustmentItem[] = [];
    for (const col of dynamicCols) {
      const cell = row[col.idx];
      if (cell === null || cell === undefined || String(cell).trim() === '') continue;
      const signedAmt = parseVietnameseMoneyShorthand(cell);
      if (signedAmt === 0) continue;
      const itemType: SlipItemType = signedAmt < 0 ? 'deduct' : col.defaultType;
      slipItems.push({
        id: createSlipItemId('col'),
        label: col.label.replace(/\s*\(\s*[+-]\s*\)\s*/g, '').trim(),
        type: itemType,
        amount: Math.abs(signedAmt),
        visible: true,
      });
    }

    const candidate: PayrollEmployee = {
      id: createSlipItemId('emp'),
      name,
      role,
      dept,
      days,
      workedDays: days,
      addedDays,
      totalHours,
      range,
      salary,
      amount: 0,
      useCustomSlipItems: true,
      slipItems,
      sourceType,
    };

    const normalized = normalizeEmployeeSlip(candidate, mode, standardDays, roundMode);
    employees.push(normalized);
  }

  return {
    employees,
    detectedFormat: sourceType === 'excel' ? 'excel-table' : 'text-table',
    detectedColumns: [
      headers[nameCol] || 'Họ tên',
      ...(daysCol >= 0 ? [headers[daysCol]] : []),
      ...(salaryCol >= 0 ? [headers[salaryCol]] : []),
      ...dynamicCols.map(c => c.label),
    ],
    warnings,
  };
}

/**
 * Dual-format Excel workbook importer:
 * 1) Automatically detects F&B vertical blocks ("PHIẾU LƯƠNG NHÂN VIÊN") and preserves ALL custom rows per slip.
 * 2) Falls back seamlessly to horizontal tabular sheets with arbitrary dynamic columns!
 */
export async function parsePayrollExcelFile(
  file: File,
  mode: PayrollSalaryMode,
  standardDays: number,
  roundMode: PayrollRoundMode,
  payMonth: string
): Promise<ParsedPayrollResult> {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    const text = await file.text();
    return parseSmartPayrollText(text, mode, standardDays, roundMode, payMonth, 'excel');
  }

  const buffer = await file.arrayBuffer();
  const ExcelJSMod = await import('exceljs');
  const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { employees: [], detectedFormat: 'excel-table', detectedColumns: [], warnings: ['Không tìm thấy trang tính trong file Excel.'] };
  }

  const rowCount = worksheet.rowCount;
  const colCount = worksheet.columnCount;
  const blockEmployees: PayrollEmployee[] = [];
  const discoveredCols = new Set<string>();

  // Pass 1: Detect F&B vertical slip blocks ("PHIẾU LƯƠNG NHÂN VIÊN")
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= colCount; c++) {
      const cellVal = unwrapExcelCellValue(row.getCell(c)?.value);
      if (cellVal && typeof cellVal === 'string' && removeVietnameseAccents(cellVal).toUpperCase().includes('PHIEU LUONG NHAN VIEN')) {
        let name = '';
        let role = '';
        let dept = '';
        let addedDays = 0;
        let totalHours = 0;
        let workedDays = 26;
        let salary = 0;
        const slipItems: SlipAdjustmentItem[] = [];

        for (let br = r + 1; br <= Math.min(r + 28, rowCount); br++) {
          const blockRow = worksheet.getRow(br);
          const labelRaw = unwrapExcelCellValue(blockRow.getCell(c)?.value);
          if (!labelRaw || typeof labelRaw !== 'string') continue;

          const labelClean = labelRaw.trim();
          const normLabel = removeVietnameseAccents(labelClean).toLowerCase();
          if (normLabel.includes('phieu luong nhan vien')) break;

          const val1 = unwrapExcelCellValue(blockRow.getCell(c + 1)?.value);
          const val2 = unwrapExcelCellValue(blockRow.getCell(c + 2)?.value);
          const rawValue = val2 !== null && val2 !== undefined && String(val2).trim() !== '' ? val2 : val1;

          if (normLabel.includes('ho va ten') || normLabel.includes('ho ten') || normLabel === 'nhan vien') {
            const nameVal = val1 && typeof val1 === 'string' && val1.trim() !== '' ? val1 : val2;
            if (nameVal) name = String(nameVal).trim();
          } else if (normLabel.includes('chuc vu') || normLabel.includes('vi tri')) {
            if (rawValue) role = String(rawValue).trim();
          } else if (normLabel.includes('bo phan') || normLabel.includes('phong ban')) {
            if (rawValue) dept = String(rawValue).trim();
          } else if (normLabel.includes('ngay cong them') || normLabel.includes('bu ngay')) {
            addedDays = parseSmartDecimal(rawValue);
          } else if (normLabel.includes('tong gio lam') || normLabel.includes('gio lam/thang')) {
            totalHours = parseSmartDecimal(rawValue);
          } else if (normLabel.includes('so ngay lam') || normLabel.includes('ngay lam/thang') || normLabel.includes('so cong')) {
            workedDays = parseSmartDecimal(rawValue);
          } else if (normLabel.includes('muc luong') || normLabel.includes('luong hien tai') || normLabel.includes('luong co ban')) {
            salary = Math.abs(parseVietnameseMoneyShorthand(rawValue));
          } else if (!isComputedSummaryLabel(labelClean)) {
            // Preserve EVERY custom bonus / allowance / penalty / deduction line dynamically!
            const signedAmt = parseVietnameseMoneyShorthand(rawValue);
            if (signedAmt !== 0) {
              const cleanTitle = labelClean.replace(/\s*\(\s*[+-]\s*\)\s*/g, '').replace(/:$/, '').trim();
              const itemType = inferAdjustmentType(labelClean, signedAmt);
              discoveredCols.add(cleanTitle);
              slipItems.push({
                id: createSlipItemId('xls-item'),
                label: cleanTitle,
                type: itemType,
                amount: Math.abs(signedAmt),
                visible: true,
              });
            }
          }
        }

        if (name) {
          const emp: PayrollEmployee = {
            id: createSlipItemId('xls'),
            name,
            role: role || undefined,
            dept: dept || undefined,
            days: workedDays,
            workedDays,
            addedDays,
            totalHours,
            salary,
            range: payMonth ? `${payMonth.split('-')[1]}/${payMonth.split('-')[0]}` : '',
            amount: 0,
            useCustomSlipItems: true,
            slipItems,
            sourceType: 'excel',
          };
          blockEmployees.push(normalizeEmployeeSlip(emp, 'restaurant', standardDays, roundMode));
        }
      }
    }
  }

  if (blockEmployees.length > 0) {
    return {
      employees: blockEmployees,
      detectedFormat: 'excel-blocks',
      detectedColumns: ['Họ tên', 'Ngày công', 'Lương CB', ...Array.from(discoveredCols)],
      warnings: [],
    };
  }

  // Pass 2: Horizontal tabular sheet
  const matrix: Array<Array<unknown>> = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    const values: unknown[] = [];
    for (let c = 1; c <= colCount; c++) {
      values.push(unwrapExcelCellValue(row.getCell(c)?.value));
    }
    matrix.push(values);
  }

  return parseTabularPayrollMatrix(matrix, mode, standardDays, roundMode, payMonth, 'excel');
}

/**
 * Smart multi-format text / OCR parser supporting:
 * 1) Tab-separated or CSV pasted tables from Excel / Google Sheets
 * 2) Pipe-separated quick lines: "Nguyễn Minh Anh | Công: 26 | Lương: 9tr | Thưởng KPI +500k | Đi trễ -100k"
 * 3) Multi-line OCR / Zalo slip blocks (1 or multiple slips)
 */
export function parseSmartPayrollText(
  rawText: string,
  mode: PayrollSalaryMode,
  standardDays: number,
  roundMode: PayrollRoundMode,
  payMonth: string,
  sourceType: 'text' | 'image' | 'excel' = 'text'
): ParsedPayrollResult {
  const text = rawText.trim();
  if (!text) {
    return { employees: [], detectedFormat: 'text-inline', detectedColumns: [], warnings: ['Chưa có nội dung để phân tích.'] };
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const defaultRange = payMonth ? `${payMonth.split('-')[1]}/${payMonth.split('-')[0]}` : '';

  // Case 1: Tab-separated (Excel/Sheets paste) or structured CSV table
  const tabCount = lines.filter(l => l.includes('\t')).length;
  if (tabCount >= Math.max(2, Math.floor(lines.length * 0.6))) {
    const matrix = lines.map(l => l.split('\t').map(c => c.trim()));
    const firstRowNorm = removeVietnameseAccents(matrix[0].join(' ')).toLowerCase();
    const hasHeader = firstRowNorm.includes('ho ten') || firstRowNorm.includes('nhan vien') || firstRowNorm.includes('luong') || firstRowNorm.includes('cong');
    if (hasHeader) {
      return parseTabularPayrollMatrix(matrix, mode, standardDays, roundMode, payMonth, sourceType === 'excel' ? 'excel' : 'text');
    }
    // Headerless TSV: Name | Days | Range | Salary | Optional extra +/- tokens
    const headerlessEmployees: PayrollEmployee[] = [];
    matrix.forEach((cols, idx) => {
      const name = cols[0]?.trim();
      if (!name) return;
      const days = parseSmartDecimal(cols[1]);
      const col2IsMoney = cols.length === 3 && Math.abs(parseVietnameseMoneyShorthand(cols[2])) >= 10000;
      const range = col2IsMoney ? defaultRange : (cols[2]?.trim() || defaultRange);
      const salary = col2IsMoney
        ? Math.abs(parseVietnameseMoneyShorthand(cols[2]))
        : Math.abs(parseVietnameseMoneyShorthand(cols[3] || (mode === 'hourly' ? '35000' : '8000000')));
      const slipItems: SlipAdjustmentItem[] = [];
      for (let c = 4; c < cols.length; c++) {
        const token = cols[c]?.trim();
        if (!token) continue;
        const parsedItem = parseInlineAdjustmentToken(token);
        if (parsedItem) slipItems.push(parsedItem);
      }
      const emp: PayrollEmployee = {
        id: createSlipItemId(`tsv-${idx}`),
        name,
        days,
        workedDays: days,
        totalHours: mode === 'hourly' ? days : days * 8,
        salary,
        range,
        amount: 0,
        useCustomSlipItems: true,
        slipItems,
        sourceType,
      };
      headerlessEmployees.push(normalizeEmployeeSlip(emp, mode, standardDays, roundMode));
    });
    return {
      employees: headerlessEmployees,
      detectedFormat: 'text-table',
      detectedColumns: ['Họ tên', 'Công/Giờ', 'Lương CB', 'Các khoản cộng/trừ'],
      warnings: [],
    };
  }

  // Case 2: Pipe-separated single-line format ("Tên | Công: 26 | Lương: 9tr | Thưởng +500k | Phạt -100k")
  const pipeLines = lines.filter(l => l.includes('|'));
  if (pipeLines.length >= 1 && pipeLines.length >= lines.length * 0.5) {
    const detectedCols = new Set<string>(['Họ tên', 'Công/Giờ', 'Lương CB']);
    const employees: PayrollEmployee[] = [];

    pipeLines.forEach((line, idx) => {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length < 2) return;
      const name = parts[0].replace(/^(?:ho\s*va\s*ten|ho\s*ten|ten|nv)\s*[:：-]\s*/i, '').trim();
      if (!name) return;

      let days = mode === 'hourly' ? 160 : 26;
      let salary = mode === 'hourly' ? 35000 : 8000000;
      let role = '';
      let dept = '';
      let addedDays = 0;
      const slipItems: SlipAdjustmentItem[] = [];

      for (let i = 1; i < parts.length; i++) {
        const token = parts[i];
        const norm = removeVietnameseAccents(token).toLowerCase();

        if (/^(?:chuc vu|vi tri)\s*[:：-]/.test(norm)) {
          role = token.split(/[:：-]/).slice(1).join(':').trim();
        } else if (/^(?:bo phan|phong ban)\s*[:：-]/.test(norm)) {
          dept = token.split(/[:：-]/).slice(1).join(':').trim();
        } else if (/^(?:cong them|bu ngay|ngay cong them)\s*[:：-]/.test(norm)) {
          addedDays = parseSmartDecimal(token.split(/[:：-]/).slice(1).join(''));
        } else if (/^(?:cong|so cong|ngay cong|gio|so gio)\s*[:：-]?/.test(norm)) {
          const valPart = token.replace(/^[^0-9.,]+/, '');
          days = parseSmartDecimal(valPart);
        } else if (/^(?:luong cb|luong co ban|luong|muc luong)\s*[:：-]?/.test(norm)) {
          const valPart = token.replace(/^[^0-9.,]+/, '');
          salary = Math.abs(parseVietnameseMoneyShorthand(valPart));
        } else {
          const item = parseInlineAdjustmentToken(token);
          if (item) {
            detectedCols.add(item.label);
            slipItems.push(item);
          }
        }
      }

      const emp: PayrollEmployee = {
        id: createSlipItemId(`inline-${idx}`),
        name,
        role: role || undefined,
        dept: dept || undefined,
        days,
        workedDays: days,
        addedDays,
        totalHours: mode === 'hourly' ? days : days * 8,
        salary,
        range: defaultRange,
        amount: 0,
        useCustomSlipItems: true,
        slipItems,
        sourceType,
      };
      employees.push(normalizeEmployeeSlip(emp, mode, standardDays, roundMode));
    });

    return {
      employees,
      detectedFormat: 'text-inline',
      detectedColumns: Array.from(detectedCols),
      warnings: [],
    };
  }

  // Case 3: Multi-line OCR / Zalo Slip Blocks (1 or more employees)
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    const norm = removeVietnameseAccents(line).toLowerCase();
    const isBlockStart =
      norm.includes('phieu luong') ||
      /^(?:ho\s*(?:va\s*)?ten|ten\s*nv|nhan\s*vien)\s*[:：-]/.test(norm) ||
      /^-{3,}$/.test(line);

    if (isBlockStart && currentBlock.length > 0 && currentBlock.some(l => removeVietnameseAccents(l).toLowerCase().match(/(?:luong|cong|tien|thuong|phat|ung)/))) {
      blocks.push(currentBlock);
      currentBlock = /^-{3,}$/.test(line) ? [] : [line];
    } else if (!/^-{3,}$/.test(line)) {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  const detectedCols = new Set<string>(['Họ tên', 'Công/Giờ', 'Lương CB']);
  const blockEmps: PayrollEmployee[] = [];

  blocks.forEach((block, bIdx) => {
    let name = '';
    let role = '';
    let dept = '';
    let days = mode === 'hourly' ? 160 : 26;
    let addedDays = 0;
    let totalHours = 0;
    let salary = 0;
    const slipItems: SlipAdjustmentItem[] = [];

    for (const line of block) {
      const norm = removeVietnameseAccents(line).toLowerCase();
      if (norm.includes('phieu luong') || norm.includes('kings grill') || norm.includes('thang ')) {
        continue;
      }

      // Split "Label: Value" or "Label   1.200.000"
      let label = '';
      let valStr = '';
      const colonIdx = line.search(/[:：]/);
      if (colonIdx > 0) {
        label = line.slice(0, colonIdx).trim();
        valStr = line.slice(colonIdx + 1).trim();
      } else {
        const trailingMoney = line.match(/^(.+?)\s+([+-]?\s*[0-9][0-9.,]*(?:\s*(?:tr|trieu|triệu|k|đ|vnd|vnđ))?)\s*$/i);
        if (trailingMoney) {
          label = trailingMoney[1].trim();
          valStr = trailingMoney[2].trim();
        }
      }

      if (!label && !valStr) continue;
      const normLabel = removeVietnameseAccents(label).toLowerCase();

      if (normLabel.includes('ho va ten') || normLabel.includes('ho ten') || normLabel === 'ten' || normLabel === 'nhan vien' || normLabel === 'ten nv') {
        name = valStr;
      } else if (normLabel.includes('chuc vu') || normLabel.includes('vi tri')) {
        role = valStr;
      } else if (normLabel.includes('bo phan') || normLabel.includes('phong ban')) {
        dept = valStr;
      } else if (normLabel.includes('ngay cong them') || normLabel.includes('bu ngay')) {
        addedDays = parseSmartDecimal(valStr);
      } else if (normLabel.includes('tong gio') || normLabel.includes('so gio')) {
        totalHours = parseSmartDecimal(valStr);
        if (mode === 'hourly') days = totalHours;
      } else if (normLabel.includes('so ngay') || normLabel.includes('ngay cong') || normLabel.includes('so cong') || normLabel === 'cong') {
        days = parseSmartDecimal(valStr);
      } else if (normLabel.includes('muc luong') || normLabel.includes('luong co ban') || normLabel.includes('luong cb') || normLabel.includes('luong hien tai')) {
        salary = Math.abs(parseVietnameseMoneyShorthand(valStr));
      } else if (!isComputedSummaryLabel(label)) {
        const signedAmt = parseVietnameseMoneyShorthand(valStr);
        if (signedAmt !== 0) {
          const cleanLabel = label.replace(/\s*\(\s*[+-]\s*\)\s*/g, '').trim();
          const itemType = inferAdjustmentType(label, signedAmt);
          detectedCols.add(cleanLabel);
          slipItems.push({
            id: createSlipItemId('blk-item'),
            label: cleanLabel,
            type: itemType,
            amount: Math.abs(signedAmt),
            visible: true,
          });
        }
      }
    }

    if (name || salary > 0 || slipItems.length > 0) {
      const emp: PayrollEmployee = {
        id: createSlipItemId(`blk-${bIdx}`),
        name: name || `Nhân viên #${bIdx + 1}`,
        role: role || undefined,
        dept: dept || undefined,
        days,
        workedDays: days,
        addedDays,
        totalHours: totalHours || (mode === 'hourly' ? days : days * 8),
        salary: salary || (mode === 'hourly' ? 35000 : 8000000),
        range: defaultRange,
        amount: 0,
        useCustomSlipItems: true,
        slipItems,
        sourceType,
      };
      blockEmps.push(normalizeEmployeeSlip(emp, mode, standardDays, roundMode));
    }
  });

  return {
    employees: blockEmps,
    detectedFormat: 'text-blocks',
    detectedColumns: Array.from(detectedCols),
    warnings: blockEmps.length === 0 ? ['Chưa nhận diện được dòng nhân viên. Hãy thử dạng "Họ tên | Công: 26 | Lương: 9tr | Thưởng +500k | Phạt -100k".'] : [],
  };
}

function parseInlineAdjustmentToken(token: string): SlipAdjustmentItem | null {
  const cleaned = token.trim();
  if (!cleaned) return null;

  // Pattern: "Thưởng KPI +500k" or "Đi trễ: -100.000" or "Tiền cơm 520k"
  const match = cleaned.match(/^(.+?)\s*[:：]?\s*([+-]?\s*[0-9][0-9.,]*\s*(?:tr|trieu|triệu|k|nghin|nghìn|đ|vnd|vnđ)?)\s*$/i);
  if (!match) return null;

  const rawLabel = match[1].replace(/[:：-]+$/, '').trim();
  const rawVal = match[2].trim();
  if (!rawLabel || isComputedSummaryLabel(rawLabel)) return null;

  const signedAmt = parseVietnameseMoneyShorthand(rawVal);
  if (signedAmt === 0) return null;

  const hasExplicitPlus = rawVal.startsWith('+');
  const hasExplicitMinus = rawVal.startsWith('-') || rawVal.startsWith('−');
  const type: SlipItemType = hasExplicitMinus
    ? 'deduct'
    : hasExplicitPlus
      ? 'add'
      : inferAdjustmentType(rawLabel, signedAmt);

  return {
    id: createSlipItemId('tok'),
    label: rawLabel.replace(/\s*\(\s*[+-]\s*\)\s*/g, '').trim(),
    type,
    amount: Math.abs(signedAmt),
    visible: true,
  };
}
