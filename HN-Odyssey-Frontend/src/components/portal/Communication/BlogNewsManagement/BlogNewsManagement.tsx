import { useState, useRef } from "react";
import "./BlogNewsManagement.css";
import TableSkeleton from "../../common/TableSkeleton/TableSkeleton";
import PortalPagination from "../../common/Pagination/PortalPagination";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import {
  SearchIcon,
  ChevronDownIcon,
  EditIcon,
  ViewIcon,
} from "../../../../assets/icons/BlogNewsManagementIcons";
import type {
  BlogNewsRecord,
  BlogNewsStatus,
} from "../../../../hooks/portal/Communication/BlogNewsManagement/useBlogNewsManagement";
import SmartImage from "../../../common/SmartImage/SmartImage";
import { getCurrentUser, hasPermission } from "../../../../utils/permission";
import { Action, Resource } from "../../../../types/permissions";

interface BlogNewsManagementProps {
  data: BlogNewsRecord[];
  isLoading?: boolean;
  search: string;
  statusFilter: BlogNewsStatus | "All";
  selectedIds: Set<string>;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalFiltered: number;
    startIndex: number;
  };
  actions: {
    changeSearch: (val: string) => void;
    changeStatusFilter: (status: BlogNewsStatus | "All") => void;
    clearFilters: () => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (isAll: boolean) => void;
    openAddDrawer: () => void;
    openEditDrawer: (record: BlogNewsRecord) => void;
    openViewDrawer: (record: BlogNewsRecord) => void;
    openDeleteModal: (id?: string) => void;
  };
  bulkActions: {
    bulkPublish: () => void;
    bulkHide: () => void;
    bulkDelete: () => void;
  };
}

export default function BlogNewsManagement({
  data,
  isLoading = false,
  search,
  statusFilter,
  selectedIds,
  pagination,
  actions,
  bulkActions,
}: BlogNewsManagementProps) {
  const currentUser = getCurrentUser();
  const canPublish = hasPermission(
    currentUser,
    Resource.CONTENT_POSTS,
    Action.PUBLISH,
  );
  const canUnpublish = hasPermission(
    currentUser,
    Resource.CONTENT_POSTS,
    Action.UNPUBLISH,
  );

  // quản lý trạng thái đóng mở cho bộ lọc
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [hasStatusOpened, setHasStatusOpened] = useState(false);

  const statusRef = useRef<HTMLDivElement>(null);

  // theo dõi hành động click chuột ra ngoài để đóng dropdown
  useClickOutside(statusRef, () => setIsStatusOpen(false));

  const isAllSelected = data.length > 0 && selectedIds.size === data.length;

  return (
    <div className="ban-container">
      <div className="ban-header">
        <div>
          <h1 className="ban-title">Blog&News Management</h1>
          <p className="ban-breadcrumb">Communication / Blog&News Management</p>
        </div>
        <button className="ban-btn-add" onClick={actions.openAddDrawer}>
          + Create Article
        </button>
      </div>

      <div className="ban-card">
        <div className="ban-toolbar">
          <div className="ban-filters-row">
            <div className="ban-search-wrapper">
              <SearchIcon />
              <input
                type="text"
                className="ban-filter-input"
                placeholder="Search by Title"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
            </div>

            <div className="ban-custom-dropdown" ref={statusRef}>
              <div
                className={`ban-dropdown-trigger ${isStatusOpen ? "active" : ""}`}
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  if (!hasStatusOpened) setHasStatusOpened(true);
                }}
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDownIcon
                  className={`ban-dropdown-arrow ${isStatusOpen ? "open" : ""}`}
                />
              </div>

              <div
                className={`ban-dropdown-options ${isStatusOpen ? "open" : hasStatusOpened ? "closed" : ""}`}
              >
                {(
                  ["All", "Published", "Scheduled", "Draft", "Hidden"] as const
                ).map((opt) => (
                  <div
                    key={opt}
                    className={`ban-dropdown-option ${statusFilter === opt ? "active" : ""}`}
                    onClick={() => {
                      actions.changeStatusFilter(opt);
                      setIsStatusOpen(false);
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="ban-btn-clear"
              onClick={actions.clearFilters}
            >
              Clear Filter
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="ban-bulk-actions">
            <span className="ban-bulk-text">
              {selectedIds.size} items selected
            </span>
            {canPublish && (
              <button
                className="ban-btn-bulk publish"
                onClick={bulkActions.bulkPublish}
              >
                Publish
              </button>
            )}
            {canUnpublish && (
              <button
                className="ban-btn-bulk hide"
                onClick={bulkActions.bulkHide}
              >
                Hide
              </button>
            )}
            {hasPermission(
              currentUser,
              Resource.CONTENT_POSTS,
              Action.DELETE,
            ) && (
              <button
                className="ban-btn-bulk delete"
                onClick={bulkActions.bulkDelete}
              >
                Delete
              </button>
            )}
          </div>
        )}

        <div className="ban-table-container">
          <table className="ban-table">
            <thead>
              <tr>
                <th style={{ width: "4%" }}>
                  <input
                    type="checkbox"
                    className="ban-checkbox"
                    checked={isAllSelected}
                    onChange={(e) => actions.toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ width: "35%" }}>Article</th>
                <th style={{ width: "15%" }}>Category</th>
                <th style={{ width: "12%" }}>Author</th>
                <th style={{ width: "12%" }}>Publish Date</th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "12%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody
              className={`portal-tbody ${isLoading && data.length > 0 ? "is-refreshing" : ""}`}
            >
              {isLoading && data.length === 0 ? (
                <TableSkeleton columns={7} />
              ) : data.length > 0 ? (
                data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="ban-checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => actions.toggleSelection(row.id)}
                      />
                    </td>
                    <td>
                      <div className="ban-article-info">
                        <SmartImage
                          src={row.featuredImage}
                          alt={row.title}
                          className="ban-article-img"
                        />
                        <div className="ban-article-text">
                          <span className="ban-article-title" title={row.title}>
                            {row.title}
                          </span>
                          <span
                            className="ban-article-slug"
                            title={`/${row.slug}`}
                          >
                            /{row.slug}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{row.category}</td>
                    <td>{row.author}</td>
                    <td>{row.publishDate || "N/A"}</td>
                    <td>
                      <span
                        className={`ban-status-badge ${row.status.toLowerCase()}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="ban-row-actions">
                        {/* chỉ giữ lại các nút có trong thiết kế prototype ban đầu */}
                        <button
                          className="ban-icon-btn"
                          onClick={() => actions.openViewDrawer(row)}
                          title="View Details"
                        >
                          <ViewIcon />
                        </button>
                        <button
                          className="ban-icon-btn"
                          onClick={() => actions.openEditDrawer(row)}
                          title="Edit Article"
                        >
                          <EditIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="portal-empty-state">
                    No articles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PortalPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalFiltered}
          pageSize={pagination.limit}
          onPageChange={actions.changePage}
          onPageSizeChange={actions.changeLimit}
          itemLabel="articles"
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
