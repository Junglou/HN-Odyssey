// imports
import { useRef } from "react";
import BlogCard from "./BlogCard";
import type { BlogNewsPost } from "../../hooks/blogNews/useBlogNews";
import "./BlogGridSection.css";

// types
interface BlogGridSectionProps {
  title?: string;
  posts: BlogNewsPost[];
  variant?: "grid" | "scroll";
  onReadMore?: () => void;
}

// component
export default function BlogGridSection({
  title,
  posts,
  variant = "grid",
  onReadMore,
}: BlogGridSectionProps) {
  // refs
  const containerRef = useRef<HTMLDivElement>(null);

  if (!posts || posts.length === 0) return null;

  // render
  return (
    <div className={`blog-grid-section ${variant}`}>
      {title && (
        <div className="blog-grid-header">
          <h2 className="blog-grid-title">{title}</h2>
          {onReadMore && (
            <button className="blog-grid-read-more" onClick={onReadMore}>
              Read more &rarr;
            </button>
          )}
        </div>
      )}

      <div className="blog-grid-container" ref={containerRef}>
        {posts.map((post) => (
          <div key={post.id} className="blog-grid-item-wrap">
            <BlogCard post={post} variant="standard" />
          </div>
        ))}
      </div>
    </div>
  );
}
