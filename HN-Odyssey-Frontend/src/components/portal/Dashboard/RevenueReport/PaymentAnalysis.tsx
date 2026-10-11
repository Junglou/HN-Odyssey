import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import "./PaymentAnalysis.css";
import type {
  CashFlow,
  PaymentShare,
} from "../../../../hooks/portal/Dashboard/RevenueReport/useRevenueReport";
import { formatMoney } from "../../../../utils/reportFormat";
import ChartCard from "../../../../hooks/portal/common/ChartCard/ChartCard";

interface PaymentAnalysisProps {
  paymentShares: PaymentShare[];
  cashFlow: CashFlow;
  period: string;
  canExport: boolean;
}

const METHOD_COLORS = ["#334155", "#c4a484", "#64748b", "#e6d5c3", "#94a3b8"];
const PAID_COLOR = "#16a34a";
const PENDING_COLOR = "#ca8a04";

const percentOf = (value: number, total: number): string =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%";

export default function PaymentAnalysis({
  paymentShares,
  cashFlow,
  period,
  canExport,
}: PaymentAnalysisProps) {
  const methodTotal = paymentShares.reduce((sum, p) => sum + p.revenue, 0);
  const cashTotal = cashFlow.paid + cashFlow.pending;
  const cashData = [
    { key: "paid", label: "Paid", value: cashFlow.paid, color: PAID_COLOR },
    {
      key: "pending",
      label: "Pending",
      value: cashFlow.pending,
      color: PENDING_COLOR,
    },
  ];

  return (
    <div className="pa-wrapper">
      <div className="pa-section-title">Payment &amp; Cash Flow Analysis</div>

      <div className="pa-grid">
        {/* US.87 AC6: tỷ trọng doanh thu theo phương thức thanh toán */}
        <ChartCard
          title="Revenue by Payment Method"
          period={period}
          pdfTitle="Doanh thu theo phương thức thanh toán"
          fileNamePrefix="PaymentMethods"
          canExport={canExport}
        >
          <div className="pa-body">
            <div className="pa-chart">
              {methodTotal > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={paymentShares}
                      dataKey="revenue"
                      nameKey="label"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {paymentShares.map((p, i) => (
                        <Cell
                          key={p.method}
                          fill={METHOD_COLORS[i % METHOD_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        formatMoney(Number(value)),
                        String(name),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                // US.87 AC8: không có dữ liệu → hiển thị 0, không để trống
                <div className="pa-empty">{formatMoney(0)}</div>
              )}
            </div>

            <ul className="pa-legend">
              {paymentShares.length === 0 ? (
                <li className="pa-legend-row">
                  <span className="pa-legend-name">No revenue yet</span>
                  <span className="pa-legend-value">
                    <strong>{formatMoney(0)}</strong>
                  </span>
                </li>
              ) : (
                paymentShares.map((p, i) => (
                  <li key={p.method} className="pa-legend-row">
                    <span className="pa-legend-name">
                      <i
                        style={{
                          backgroundColor:
                            METHOD_COLORS[i % METHOD_COLORS.length],
                        }}
                      />
                      {p.label}
                    </span>
                    <span className="pa-legend-value">
                      <strong>{formatMoney(p.revenue)}</strong>
                      <em>{p.percentage.toFixed(1)}%</em>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </ChartCard>

        {/* US.87 AC7: tách Đã thanh toán / Chờ thanh toán */}
        <ChartCard
          title="Cash Flow Status"
          subtitle="Paid: funds received · Pending: COD in delivery / not yet reconciled"
          period={period}
          pdfTitle="Tình trạng thực thu"
          fileNamePrefix="CashFlow"
          canExport={canExport}
        >
          <div className="pa-body">
            <div className="pa-chart">
              {cashTotal > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={cashData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {cashData.map((c) => (
                        <Cell key={c.key} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        formatMoney(Number(value)),
                        String(name),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="pa-empty">{formatMoney(0)}</div>
              )}
            </div>

            <ul className="pa-legend">
              {cashData.map((c) => (
                <li key={c.key} className="pa-legend-row">
                  <span className="pa-legend-name">
                    <i style={{ backgroundColor: c.color }} />
                    {c.label}
                  </span>
                  <span className="pa-legend-value">
                    <strong>{formatMoney(c.value)}</strong>
                    <em>{percentOf(c.value, cashTotal)}</em>
                  </span>
                </li>
              ))}
              <li className="pa-legend-row pa-legend-total">
                <span className="pa-legend-name">Total recorded revenue</span>
                <span className="pa-legend-value">
                  <strong>{formatMoney(cashTotal)}</strong>
                </span>
              </li>
            </ul>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
