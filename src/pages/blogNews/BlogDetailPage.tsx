import { Link } from "react-router-dom";
import { useBlogDetail } from "../../hooks/blogNews/useBlogDetail";
import "./BlogDetailPage.css";

export default function BlogDetailPage() {
  const { post, loading, error } = useBlogDetail();

  if (loading) {
    return (
      <div className="blog-detail-loading">
        <p>Loading article...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="blog-detail-error">
        <h2>Oops! Something went wrong.</h2>
        <p>{error || "Article not found."}</p>
        <Link to="/blog" className="blog-detail-back-btn">
          &larr; Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="blog-detail-page-wrapper">
      <div className="blog-detail-breadcrumb">
        <Link to="/">Home</Link> / <Link to="/blog">Blog</Link> /{" "}
        <span>{post.title}</span>
      </div>

      <div className="blog-detail-header">
        <div className="blog-detail-meta">
          <span className="blog-detail-category">{post.category_id.name}</span>
          <span className="blog-detail-date-author">
            {post.published_at} • By {post.author_id.full_name}
          </span>
        </div>
        <h1 className="blog-detail-title">{post.title}</h1>
      </div>

      <div className="blog-detail-thumbnail-wrap">
        <img
          src={post.thumbnail}
          alt={post.title}
          className="blog-detail-thumbnail"
        />
      </div>

      {/* Render nội dung HTML từ Editor ra giao diện */}
      <div
        className="blog-detail-content"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      <div className="blog-detail-footer">
        <Link to="/blog" className="blog-detail-back-btn">
          &larr; Back to articles
        </Link>
      </div>
    </div>
  );
}
