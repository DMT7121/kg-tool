import React from 'react';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import {
  type PayrollEmployee,
  type PayrollRoundMode,
  type PayrollSalaryMode,
  type SlipAdjustmentItem,
  type SlipItemType,
  QUICK_SLIP_ITEM_TEMPLATES,
  computeDynamicEmployeeTotals,
  createSlipItemId
} from '../utils/payrollParser';

interface PayrollSlipEditorProps {
  employee: PayrollEmployee;
  salaryMode: PayrollSalaryMode;
  standardDays: number;
  roundMode: PayrollRoundMode;
  defaultPosition: string;
  defaultDept: string;
  formatMoney: (n: number) => string;
  onUpdateEmployee: (updated: PayrollEmployee) => void;
  onNormalizeSlip: () => void;
}

export const PayrollSlipEditor: React.FC<PayrollSlipEditorProps> = ({
  employee,
  salaryMode,
  standardDays,
  roundMode,
  defaultPosition,
  defaultDept,
  formatMoney,
  onUpdateEmployee,
  onNormalizeSlip
}) => {
  const totals = computeDynamicEmployeeTotals(employee, salaryMode, standardDays, roundMode);
  const items = totals.items;

  const commitItems = (nextItems: SlipAdjustmentItem[]) => {
    const nextEmp: PayrollEmployee = {
      ...employee,
      useCustomSlipItems: true,
      slipItems: nextItems,
      lunchPay: 0,
      bonus: 0,
      overtimePay: 0,
      deduction: 0,
      advance: 0,
    };
    const nextTotals = computeDynamicEmployeeTotals(nextEmp, salaryMode, standardDays, roundMode);
    nextEmp.amount = nextTotals.netPay;
    onUpdateEmployee(nextEmp);
  };

  const handleFieldChange = (patch: Partial<PayrollEmployee>) => {
    const nextEmp: PayrollEmployee = { ...employee, ...patch };
    const nextTotals = computeDynamicEmployeeTotals(nextEmp, salaryMode, standardDays, roundMode);
    nextEmp.amount = nextTotals.netPay;
    onUpdateEmployee(nextEmp);
  };

  const addCustomItem = (label = '', type: SlipItemType = 'add', defaultAmount = 0) => {
    const newItem: SlipAdjustmentItem = {
      id: createSlipItemId('adj'),
      label: label || (type === 'deduct' ? 'Khoản khấu trừ mới' : 'Khoản thưởng / phụ cấp mới'),
      type,
      amount: defaultAmount,
      note: '',
      visible: true,
    };
    commitItems([...items, newItem]);
  };

  const updateItem = (id: string, patch: Partial<SlipAdjustmentItem>) => {
    commitItems(items.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    commitItems(items.filter(it => it.id !== id));
  };

  const moveItem = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    commitItems(copy);
  };

  return (
    <div className="payroll-slip-editor" aria-label={`Chuẩn hóa phiếu lương ${employee.name}`}>
      {/* Header */}
      <div className="payroll-slip-editor-head">
        <div className="payroll-slip-editor-title">
          <span className="payroll-slip-avatar">{(employee.name || 'N').charAt(0).toUpperCase()}</span>
          <div>
            <h4>Chuẩn hóa phiếu: {employee.name || 'Nhân viên mới'}</h4>
            <p>
              Phiếu này đang hiển thị <strong>{totals.visibleCount}</strong> khoản cộng/trừ riêng
              ({totals.visibleAddCount} cộng · {totals.visibleDeductCount} trừ) — tự động co giãn số dòng khi in K80/A4.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-outline"
          onClick={onNormalizeSlip}
          style={{ height: '34px', fontSize: '12px' }}
          title="Tự động ẩn dòng 0 đ, gom khoản cộng lên trên và khoản trừ xuống dưới"
        >
          <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
          <span>Chuẩn hóa phiếu (ẩn 0đ)</span>
        </button>
      </div>

      {/* Core Employee Base Fields (Compact Clean Grid) */}
      <div className="payroll-core-fields-grid">
        <label className="payroll-mini-field">
          <span>Họ và tên</span>
          <input
            type="text"
            className="form-control"
            value={employee.name}
            onChange={(e) => handleFieldChange({ name: e.target.value })}
          />
        </label>
        <label className="payroll-mini-field">
          <span>Chức vụ / Bộ phận</span>
          <input
            type="text"
            className="form-control"
            placeholder={`${defaultPosition} · ${defaultDept}`}
            value={employee.role || ''}
            onChange={(e) => handleFieldChange({ role: e.target.value })}
          />
        </label>
        <label className="payroll-mini-field">
          <span>{salaryMode === 'hourly' ? 'Tổng số giờ' : 'Số ngày công'}</span>
          <input
            type="number"
            step="0.5"
            className="form-control tabular-nums"
            value={salaryMode === 'restaurant' ? (employee.workedDays ?? employee.days) : employee.days}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              handleFieldChange({ days: val, workedDays: val });
            }}
          />
        </label>
        {salaryMode === 'restaurant' && (
          <label className="payroll-mini-field">
            <span>Ngày cộng thêm</span>
            <input
              type="number"
              step="0.5"
              className="form-control tabular-nums"
              value={employee.addedDays ?? 0}
              onChange={(e) => handleFieldChange({ addedDays: Number(e.target.value) || 0 })}
            />
          </label>
        )}
        <label className="payroll-mini-field">
          <span>{salaryMode === 'hourly' ? 'Lương / giờ (VNĐ)' : 'Lương cơ bản (VNĐ)'}</span>
          <input
            type="number"
            className="form-control tabular-nums"
            value={employee.salary}
            onChange={(e) => handleFieldChange({ salary: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
          />
        </label>
      </div>

      {/* Quick-Add Adjustment Chips */}
      <div className="payroll-quick-chips-bar">
        <span className="payroll-quick-chips-label">Thêm nhanh dòng cho phiếu này:</span>
        <div className="payroll-quick-chips-list">
          {QUICK_SLIP_ITEM_TEMPLATES.map(tpl => (
            <button
              key={tpl.label}
              type="button"
              className={`payroll-quick-chip is-${tpl.type}`}
              onClick={() => addCustomItem(tpl.label, tpl.type, tpl.defaultAmount)}
            >
              <span>{tpl.type === 'deduct' ? '−' : '+'}</span>
              <span>{tpl.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="payroll-quick-chip is-custom"
            onClick={() => addCustomItem('', 'add', 0)}
          >
            <Plus size={12} />
            <span>Dòng tự nhập</span>
          </button>
        </div>
      </div>

      {/* Per-Employee Dynamic Line Items Table */}
      <div className="payroll-slip-items-list">
        {items.length === 0 ? (
          <div className="payroll-slip-items-empty">
            <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />
            <span>Nhân viên này chưa có khoản thưởng, phụ cấp hay phạt riêng — phiếu in sẽ chỉ hiển thị gọn lương công cơ bản. Bấm chip phía trên để thêm dòng riêng.</span>
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className={`payroll-slip-item-row ${item.visible === false ? 'is-hidden' : ''}`}>
              {/* Type toggle (+ / - / i) */}
              <div className="payroll-type-toggle" role="group" aria-label="Loại khoản">
                <button
                  type="button"
                  className={item.type === 'add' ? 'active is-add' : ''}
                  onClick={() => updateItem(item.id, { type: 'add' })}
                  title="Khoản cộng (+)"
                >
                  + Cộng
                </button>
                <button
                  type="button"
                  className={item.type === 'deduct' ? 'active is-deduct' : ''}
                  onClick={() => updateItem(item.id, { type: 'deduct' })}
                  title="Khoản trừ (-)"
                >
                  − Trừ
                </button>
                <button
                  type="button"
                  className={item.type === 'info' ? 'active is-info' : ''}
                  onClick={() => updateItem(item.id, { type: 'info' })}
                  title="Dòng ghi chú tham chiếu (không cộng trừ)"
                >
                  Ghi chú
                </button>
              </div>

              {/* Label */}
              <input
                type="text"
                className="form-control payroll-item-label-input"
                placeholder="Tên khoản (VD: Thưởng KPI, Phạt đi trễ...)"
                value={item.label}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
              />

              {/* Optional short note */}
              <input
                type="text"
                className="form-control payroll-item-note-input"
                placeholder="Chi tiết (VD: 2 buổi)"
                value={item.note || ''}
                onChange={(e) => updateItem(item.id, { note: e.target.value })}
              />

              {/* Amount */}
              <input
                type="number"
                className={`form-control payroll-item-amount-input tabular-nums is-${item.type}`}
                placeholder="0"
                disabled={item.type === 'info'}
                value={item.type === 'info' ? 0 : item.amount}
                onChange={(e) => updateItem(item.id, { amount: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              />

              {/* Row Actions: Show/Hide, Up/Down, Delete */}
              <div className="payroll-item-row-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => updateItem(item.id, { visible: item.visible === false })}
                  title={item.visible === false ? 'Hiện dòng này trên phiếu in' : 'Ẩn dòng này trên phiếu in'}
                >
                  {item.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={idx === 0}
                  onClick={() => moveItem(idx, -1)}
                  title="Đẩy lên"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={idx === items.length - 1}
                  onClick={() => moveItem(idx, 1)}
                  title="Đẩy xuống"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ color: 'var(--status-danger)' }}
                  onClick={() => removeItem(item.id)}
                  title="Xóa dòng này"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Live Transparent Formula Summary Bar */}
      <div className="payroll-slip-formula-bar">
        <div className="payroll-formula-part">
          <span>Lương công</span>
          <strong className="tabular-nums">{formatMoney(totals.basePay)}</strong>
        </div>
        <span className="payroll-formula-op">+</span>
        <div className="payroll-formula-part is-add">
          <span>Tổng cộng ({totals.visibleAddCount})</span>
          <strong className="tabular-nums">+{formatMoney(totals.addTotal)}</strong>
        </div>
        <span className="payroll-formula-op">−</span>
        <div className="payroll-formula-part is-deduct">
          <span>Tổng trừ ({totals.visibleDeductCount})</span>
          <strong className="tabular-nums">−{formatMoney(totals.deductTotal)}</strong>
        </div>
        <span className="payroll-formula-op">=</span>
        <div className="payroll-formula-part is-net">
          <span>Thực nhận phiếu này</span>
          <strong className="tabular-nums">{formatMoney(totals.netPay)}</strong>
        </div>
      </div>
    </div>
  );
};
