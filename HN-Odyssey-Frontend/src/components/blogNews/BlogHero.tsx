// imports
import "./BlogHero.css";

// component
export default function BlogHero() {
  // render
  return (
    <div className="blog-hero-section">
      <div className="blog-hero-breadcrumb">Home / Blog</div>
      <h1 className="blog-hero-title">Latest News & Insights</h1>
      <p className="blog-hero-subtitle">
        Discover trends, company updates and Guides
      </p>
    </div>
  );
}
