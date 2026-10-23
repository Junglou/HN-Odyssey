import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import "./ManageAdSpendDrawer.css";
import PortalPagination from "../../common/Pagination/PortalPagination";
import {
  NO_SPEND_TOOLTIP,
  calcRoi,
  formatRoi,
  formatUSD,
  roiToStatus,
  roundMoney,
  type AdCampaign,
  type AdSpendEntry,
  type AdSpendEntryList,
  type AdSpendLedgerApi,
  type ProfitStatus,
} from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";
import { formatPeriod, toVnDate } from "../../../../utils/reportFormat";

interface ManageAdSpendDrawerProps {
  campaign: AdCampaign;
  ledger: AdSpendLedgerApi;
  canUpdate: boolean;
  onClose: () => void;
}

const MAX_AMOUNT = 1_000_000_000;
const TEXT_MAX = 500;
const DAY_MS = 86_400_000;

// ---------- Ngày "YYYY-MM-DD" theo lịch trình duyệt ----------
const toYmd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayNumber = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

// Phần chi phí của dòng mới rơi vào kỳ đang lọc (chia đều theo ngày như Backend) — chỉ để xem trước
const allocateToRange = (
  amount: number,
  from: string,
  to: string,
  rangeStart: string,
  rangeEnd: string,
): number => {
  const total = dayNumber(to) - dayNumber(from) + 1;
  const overlap =
    Math.min(dayNumber(to), dayNumber(rangeEnd)) -
    Math.max(dayNumber(from), dayNumber(rangeStart)) +
    1;
  if (total <= 0 || overlap <= 0) return 0;
  return roundMoney((amount * overlap) / total);
};

const validateAmount = (raw: string): string | null => {
  const value = raw.trim();
  if (value === "") return "Please enter the amount.";
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return "Use a positive number with up to 2 decimals (e.g. 1500 or 1500.50).";
  }
  const n = Number(value);
  if (n <= 0) return "Amount must be greater than 0.";
  if (n > MAX_AMOUNT) return "Amount is too large.";
  return null;
};

const validatePeriod = (
  from: string,
  to: string,
  today: string,
): string | null => {
  if (!from || !to) return "Please select both dates.";
  if (from > to) return "Start date must be on or before the end date.";
  if (to > today) return "End date cannot be in the future.";
  return null;
};

const formatEntryPeriod = (e: AdSpendEntry): string =>
  e.period_start === e.period_end
    ? toVnDate(e.period_start)
    : `${toVnDate(e.period_start)} → ${toVnDate(e.period_end)}`;

const formatDateTime = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

// US.82 AC3
const ROI_CLASS: Record<ProfitStatus, string> = {
  PROFIT: "masd-roi-profit",
  BREAK_EVEN: "masd-roi-breakeven",
  LOSS: "masd-roi-loss",
  NO_SPEND: "masd-roi-nospend",
};

export default function ManageAdSpendDrawer({
  campaign,
  ledger,
  canUpdate,
  onClose,
}: ManageAdSpendDrawerProps) {
  const { range, fetchEntries } = ledger;
  const today = toYmd(new Date());
  const periodLabel = formatPeriod(range.start, range.end);

  // ---------- Danh sách nhật ký ----------
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [listState, setListState] = useState<{
    key: string;
    data: AdSpendEntryList | null;
  }>({ key: "", data: null });

  const requestKey = `${campaign.id}|${range.start}|${range.end}|${page}|${reloadKey}`;
  const isListLoading = listState.key !== requestKey;
  const list = listState.data;
  const totalPages = list?.meta.total_pages ?? 1;

  useEffect(() => {
    let cancelled = false;
    void fetchEntries(campaign.id, page).then((data) => {
      if (!cancelled) setListState({ key: requestKey, data });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchEntries, campaign.id, page, requestKey]);

  // ---------- Form thêm chi phí ----------
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(range.end);
  const [to, setTo] = useState(range.end);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ---------- Hủy dòng ----------
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidTouched, setVoidTouched] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  const isBusy = isSaving || isVoiding;

  // Khóa cuộn trang nền khi drawer mở
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Esc: đóng hộp hủy trước, rồi mới đóng drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isBusy) return;
      if (voidingId) setVoidingId(null);
      else onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, voidingId, onClose]);

  // ---------- Chọn nhanh kỳ áp dụng ----------
  const pickSingleDay = () => {
    const day = from || today;
    setFrom(day);
    setTo(day);
  };
  const pickThisMonth = () => {
    const now = new Date();
    setFrom(toYmd(new Date(now.getFullYear(), now.getMonth(), 1)));
    setTo(today);
  };
  const pickLastMonth = () => {
    const now = new Date();
    setFrom(toYmd(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
    setTo(toYmd(new Date(now.getFullYear(), now.getMonth(), 0)));
  };

  // ---------- Kiểm tra & xem trước ----------
  const amountError = validateAmount(amount);
  const periodError = validatePeriod(from, to, today);
  const amountValue = amountError ? null : Number(amount);

  const lifetimeNow = list?.lifetime_total ?? campaign.lifetimeSpendValue;
  const periodSpendNow = list?.period_total ?? campaign.spendValue;
  const roiNow = calcRoi(campaign.revenueValue, periodSpendNow);

  const lifetimeAfter =
    amountValue !== null && !periodError
      ? roundMoney(lifetimeNow + amountValue)
      : null;
  const roiAfter =
    amountValue !== null && !periodError
      ? calcRoi(
          campaign.revenueValue,
          roundMoney(
            periodSpendNow +
              allocateToRange(amountValue, from, to, range.start, range.end),
          ),
        )
      : null;
  const overBudgetBy =
    lifetimeAfter !== null && campaign.budgetValue > 0
      ? roundMoney(lifetimeAfter - campaign.budgetValue)
      : 0;

  const canSave = !amountError && !periodError && !isBusy;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (!canSave || amountValue === null) return;

    setIsSaving(true);
    const ok = await ledger.addEntry(campaign.id, {
      amount: amountValue,
      period_start: from,
      period_end: to,
      note: note.trim() || undefined,
    });
    setIsSaving(false);

    if (ok) {
      setAmount("");
      setNote("");
      setTouched(false);
      setPage(1);
      setReloadKey((k) => k + 1);
    }
  };

  const openVoid = (entryId: string) => {
    setVoidingId(entryId);
    setVoidReason("");
    setVoidTouched(false);
  };

  const handleConfirmVoid = async () => {
    setVoidTouched(true);
    const reason = voidReason.trim();
    if (!voidingId || !reason) return;

    setIsVoiding(true);
    const ok = await ledger.voidEntry(campaign.id, voidingId, reason);
    setIsVoiding(false);

    if (ok) {
      setVoidingId(null);
      setReloadKey((k) => k + 1);
    }
  };

  const showVoidError = voidTouched && !voidReason.trim();

  return createPortal(
    <div
      className="masd-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <aside
        className="masd-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="masd-title"
      >
        {/* header */}
        <div className="masd-header">
          <div className="masd-header-text">
            <h2 id="masd-title" className="masd-title">
              {canUpdate ? "Manage Ad Spend" : "Ad Spend Log"}
            </h2>
            <p className="masd-subtitle" title={campaign.name}>
              {campaign.name}
            </p>
            <p className="masd-period">Selected period: {periodLabel}</p>
          </div>
          <button
            type="button"
            className="masd-close-btn"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="masd-body">
          {/* 1. Tóm tắt */}
          <div className="masd-summary">
            <div className="masd-summary-item">
              <span className="masd-summary-label">Status</span>
              <span
                className={`masd-status masd-status-${campaign.status.toLowerCase()}`}
              >
                {campaign.status}
              </span>
            </div>
            <div className="masd-summary-item">
              <span className="masd-summary-label">Budget</span>
              <span className="masd-summary-value">{campaign.budget}</span>
            </div>
            <div className="masd-summary-item">
              <span className="masd-summary-label">Lifetime spend</span>
              <span className="masd-summary-value">
                {formatUSD(lifetimeNow)}
              </span>
            </div>
            <div className="masd-summary-item">
              <span className="masd-summary-label">Spend in period</span>
              <span className="masd-summary-value">
                {formatUSD(periodSpendNow)}
              </span>
            </div>
            <div className="masd-summary-item">
              <span className="masd-summary-label">Revenue in period</span>
              <span className="masd-summary-value">{campaign.revenue}</span>
            </div>
            <div className="masd-summary-item">
              <span className="masd-summary-label">ROI in period</span>
              <span
                className={`masd-summary-value ${ROI_CLASS[roiToStatus(roiNow)]}`}
                title={roiNow === null ? NO_SPEND_TOOLTIP : undefined}
              >
                {formatRoi(roiNow)}
              </span>
            </div>
          </div>

          {/* 2. Form thêm chi phí — chỉ người có quyền UPDATE */}
          {canUpdate && (
            <form
              className="masd-section masd-form"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="masd-section-title">Add spend</div>

              <label htmlFor="masd-amount" className="masd-label">
                Amount (USD) <span className="masd-required">*</span>
              </label>
              <div
                className={`masd-input-wrapper ${touched && amountError ? "masd-has-error" : ""}`}
              >
                <span className="masd-input-prefix">$</span>
                <input
                  id="masd-amount"
                  className="masd-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  disabled={isBusy}
                  onChange={(e) => setAmount(e.target.value.replace(/,/g, ""))}
                  onBlur={() => setTouched(true)}
                />
              </div>
              {touched && amountError && (
                <p className="masd-error">{amountError}</p>
              )}

              <div className="masd-label">
                Applies to <span className="masd-required">*</span>
              </div>
              <div className="masd-date-row">
                <label className="masd-date-field">
                  <span>From</span>
                  <input
                    type="date"
                    className="masd-text-input"
                    value={from}
                    max={today}
                    disabled={isBusy}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className="masd-date-field">
                  <span>To</span>
                  <input
                    type="date"
                    className="masd-text-input"
                    value={to}
                    min={from || undefined}
                    max={today}
                    disabled={isBusy}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
              <div className="masd-quick-picks">
                <button
                  type="button"
                  className="masd-chip"
                  onClick={pickSingleDay}
                  disabled={isBusy}
                >
                  Single day
                </button>
                <button
                  type="button"
                  className="masd-chip"
                  onClick={pickThisMonth}
                  disabled={isBusy}
                >
                  This month
                </button>
                <button
                  type="button"
                  className="masd-chip"
                  onClick={pickLastMonth}
                  disabled={isBusy}
                >
                  Last month
                </button>
              </div>
              {touched && periodError ? (
                <p className="masd-error">{periodError}</p>
              ) : (
                <p className="masd-hint">
                  The amount is spread evenly across each day of this period.
                  The period must fall within the campaign&apos;s run dates.
                </p>
              )}

              <label htmlFor="masd-note" className="masd-label">
                Note <span className="masd-optional">(optional)</span>
              </label>
              <input
                id="masd-note"
                className="masd-text-input"
                type="text"
                autoComplete="off"
                maxLength={TEXT_MAX}
                placeholder="e.g. Facebook invoice #FB-1029"
                value={note}
                disabled={isBusy}
                onChange={(e) => setNote(e.target.value)}
              />

              {/* Mục 7 #5: cảnh báo vàng khi vượt ngân sách, vẫn cho lưu */}
              {overBudgetBy > 0 && (
                <div className="masd-warning" role="status">
                  Lifetime spend will exceed the budget by{" "}
                  {formatUSD(overBudgetBy)}.
                </div>
              )}

              {lifetimeAfter !== null && (
                <div className="masd-preview">
                  <div className="masd-preview-row">
                    <span>Lifetime spend after adding</span>
                    <span className="masd-preview-value">
                      {formatUSD(lifetimeAfter)}
                    </span>
                  </div>
                  <div className="masd-preview-row">
                    <span>ROI in selected period after adding</span>
                    <span
                      className={`masd-preview-value ${ROI_CLASS[roiToStatus(roiAfter)]}`}
                      title={roiAfter === null ? NO_SPEND_TOOLTIP : undefined}
                    >
                      {formatRoi(roiAfter)}
                    </span>
                  </div>
                </div>
              )}

              <div className="masd-form-actions">
                <button
                  type="submit"
                  className="masd-btn masd-btn-primary"
                  disabled={!canSave}
                >
                  {isSaving ? "Saving..." : "Add Spend"}
                </button>
              </div>
            </form>
          )}

          {/* 3. Danh sách nhật ký */}
          <div className="masd-section">
            <div className="masd-section-header">
              <div className="masd-section-title">Spend log</div>
              {list && (
                <span className="masd-count">
                  {list.meta.total}{" "}
                  {list.meta.total === 1 ? "entry" : "entries"}
                </span>
              )}
            </div>

            {list === null ? (
              <div className="masd-empty">
                {isListLoading ? "Loading..." : "Could not load the spend log."}
              </div>
            ) : list.entries.length === 0 ? (
              <div className="masd-empty">No ad spend recorded yet.</div>
            ) : (
              <ul
                className={`masd-entries ${isListLoading ? "masd-is-loading" : ""}`}
              >
                {list.entries.map((entry) => (
                  <li
                    key={entry.entry_id}
                    className={`masd-entry ${entry.is_voided ? "masd-entry-voided" : ""}`}
                  >
                    <div className="masd-entry-top">
                      <span className="masd-entry-period">
                        {formatEntryPeriod(entry)}
                      </span>
                      <span className="masd-entry-amount">
                        {formatUSD(entry.amount)}
                      </span>
                    </div>

                    {entry.note && (
                      <div className="masd-entry-note">{entry.note}</div>
                    )}

                    <div className="masd-entry-meta">
                      <span
                        className={`masd-badge ${entry.is_voided ? "masd-badge-voided" : "masd-badge-active"}`}
                      >
                        {entry.is_voided ? "Voided" : "Active"}
                      </span>
                      <span>
                        Added by {entry.created_by?.name ?? "System"} ·{" "}
                        {formatDateTime(entry.created_at)}
                      </span>
                    </div>

                    {entry.is_voided && (
                      <div className="masd-void-info">
                        Voided by {entry.voided_by?.name ?? "Unknown"} ·{" "}
                        {formatDateTime(entry.voided_at)}
                        <br />
                        Reason: {entry.void_reason}
                      </div>
                    )}

                    {canUpdate &&
                      !entry.is_voided &&
                      voidingId !== entry.entry_id && (
                        <div className="masd-entry-actions">
                          <button
                            type="button"
                            className="masd-btn-link-danger"
                            onClick={() => openVoid(entry.entry_id)}
                            disabled={isBusy}
                          >
                            Void
                          </button>
                        </div>
                      )}

                    {voidingId === entry.entry_id && (
                      <div className="masd-void-box">
                        <label
                          htmlFor={`masd-void-${entry.entry_id}`}
                          className="masd-label"
                        >
                          Reason for voiding{" "}
                          <span className="masd-required">*</span>
                        </label>
                        <textarea
                          id={`masd-void-${entry.entry_id}`}
                          className={`masd-text-input masd-textarea ${showVoidError ? "masd-has-error" : ""}`}
                          rows={2}
                          maxLength={TEXT_MAX}
                          autoFocus
                          placeholder="e.g. Entered the wrong amount"
                          value={voidReason}
                          disabled={isVoiding}
                          onChange={(e) => setVoidReason(e.target.value)}
                        />
                        {showVoidError ? (
                          <p className="masd-error">Please enter a reason.</p>
                        ) : (
                          <p className="masd-hint">
                            The entry stays in the log as voided. This cannot be
                            undone.
                          </p>
                        )}
                        <div className="masd-void-actions">
                          <button
                            type="button"
                            className="masd-btn masd-btn-secondary"
                            onClick={() => setVoidingId(null)}
                            disabled={isVoiding}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="masd-btn masd-btn-danger"
                            onClick={() => void handleConfirmVoid()}
                            disabled={isVoiding}
                          >
                            {isVoiding ? "Voiding..." : "Confirm Void"}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {totalPages > 1 && (
              <div className="masd-pagination">
                <PortalPagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  disabled={isListLoading}
                />
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="masd-footer">
          <button
            type="button"
            className="masd-btn masd-btn-secondary"
            onClick={onClose}
            disabled={isBusy}
          >
            Close
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
