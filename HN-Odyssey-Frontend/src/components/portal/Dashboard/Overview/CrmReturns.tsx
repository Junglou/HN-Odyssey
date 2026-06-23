import "./CrmReturns.css";

interface CrmProps {
  tickets: { id: string; status: string }[];
  returns: { name: string; status: string; type: string }[];
}

const getStatusClass = (status: string, type?: string) => {
  if (!status) return "cr-status-default";
  const s = status.toLowerCase();
  if (type === "warning" || s.includes("pending") || s.includes("open"))
    return "cr-status-pending";
  if (type === "success" || s.includes("approv") || s.includes("progress"))
    return "cr-status-approved";
  if (type === "error" || s.includes("reject") || s.includes("closed"))
    return "cr-status-rejected";
  return "cr-status-default";
};

export default function CrmReturns({ tickets, returns }: CrmProps) {
  return (
    <div className="cr-card">
      <div className="cr-card-title">CRM & Returns Overview</div>

      <div className="cr-split-grid">
        {/* cột 1 hiển thị danh sách ticket */}
        <div className="cr-grid-column">
          <div className="cr-section-title">Recent Ticket Activity</div>
          <div className="cr-table-wrapper">
            <div className="cr-table">
              <div className="cr-table-header">
                <span className="cr-col-left">Ticket ID</span>
                <span className="cr-col-right">Status</span>
              </div>
              {tickets?.map((ticket, idx) => (
                <div className="cr-table-row" key={idx}>
                  <span className="cr-col-left">{ticket.id}</span>
                  <span className="cr-col-right">
                    <span
                      className={`cr-status-badge ${getStatusClass(ticket.status)}`}
                    >
                      {ticket.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* vạch ngăn cách */}
        <div className="cr-divider"></div>

        {/* cột 2 hiển thị danh sách yêu cầu trả hàng */}
        <div className="cr-grid-column">
          <div className="cr-section-title">Pending Return Approvals</div>
          <div className="cr-table-wrapper">
            <div className="cr-table">
              <div className="cr-table-header">
                <span className="cr-col-left">Name</span>
                <span className="cr-col-right">Status</span>
              </div>
              {returns?.map((ret, idx) => (
                <div className="cr-table-row" key={idx}>
                  <span className="cr-col-left">{ret.name}</span>
                  <span className="cr-col-right">
                    <span
                      className={`cr-status-badge ${getStatusClass(ret.status, ret.type)}`}
                    >
                      {ret.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
