// imports
import { useState, useRef } from "react";
import { useClickOutside } from "../../hooks/common/useClickOutside";
import { SearchIcon, ChevronDownIcon } from "../../assets/icons/BlogNewsIcons";
import "./BlogToolbar.css";

// types
interface BlogToolbarProps {
  search: string;
  categories: string[];
  activeCategory: string;
  sortOptions: string[];
  sortBy: string;
  onSearchChange: (val: string) => void;
  onCategoryChange: (cat: string) => void;
  onSortChange: (sort: string) => void;
}

// component
export default function BlogToolbar({
  search,
  categories,
  activeCategory,
  sortOptions,
  sortBy,
  onSearchChange,
  onCategoryChange,
  onSortChange,
}: BlogToolbarProps) {
  // dropdown states
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [hasSortOpened, setHasSortOpened] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useClickOutside(sortRef, () => setIsSortOpen(false));

  // render
  return (
    <div className="blog-toolbar-wrapper">
      <div className="blog-toolbar">
        {/* ô search bo tròn */}
        <div className="blog-search-box">
          <SearchIcon className="blog-search-icon" />
          <input
            type="text"
            placeholder="Search blog article ..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* tab danh mục */}
        <div className="blog-tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`blog-tab ${activeCategory === cat ? "active" : ""}`}
              onClick={() => onCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* dropdown custom đồng bộ UI */}
        <div className="blog-toolbar-custom-dropdown" ref={sortRef}>
          <div
            className={`blog-toolbar-dropdown-trigger ${isSortOpen ? "active" : ""}`}
            onClick={() => {
              setIsSortOpen(!isSortOpen);
              if (!hasSortOpened) setHasSortOpened(true);
            }}
          >
            <span className="blog-toolbar-dropdown-value">
              Sort by: <strong>{sortBy}</strong>
            </span>
            <div className="blog-toolbar-icon-wrapper">
              <ChevronDownIcon className={isSortOpen ? "open" : ""} />
            </div>
          </div>

          <div
            className={`blog-toolbar-dropdown-options ${
              isSortOpen ? "open" : hasSortOpened ? "closed" : ""
            }`}
          >
            {sortOptions.map((opt) => (
              <div
                key={opt}
                className={`blog-toolbar-dropdown-option ${
                  sortBy === opt ? "active" : ""
                }`}
                onClick={() => {
                  onSortChange(opt);
                  setIsSortOpen(false);
                }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
