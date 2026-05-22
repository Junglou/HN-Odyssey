// imports
import "./BlogCard.css";
import type { BlogNewsPost } from "../../hooks/blogNews/useBlogNews";

// types
interface BlogCardProps {
  post: BlogNewsPost;
  variant?: "standard" | "featured";
}

const PASTEL_COLORS = [
  { bg: "#E8F0FE", text: "#1A73E8" },
  { bg: "#FCE8E6", text: "#D93025" },
  { bg: "#E6F4EA", text: "#1E8E3E" },
  { bg: "#FEF7E0", text: "#F9AB00" },
  { bg: "#F3E8FD", text: "#9334E6" },
  { bg: "#E4F7FB", text: "#12B5CB" },
  { bg: "#FBE9F1", text: "#D01884" },
];

const getColorForCategory = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
};

// component
export default function BlogCard({
  post,
  variant = "standard",
}: BlogCardProps) {
  if (!post) return null;

  const isFeatured = variant === "featured";
  const tagColor = getColorForCategory(post.category_id.name);

  // render
  return (
    <div className={`blog-card ${isFeatured ? "featured" : "standard"}`}>
      <div className="blog-card-img-wrap">
        <img src={post.thumbnail} alt={post.title} className="blog-card-img" />
      </div>

      <div className="blog-card-content">
        <h3 className="blog-card-title">{post.title}</h3>
        <p className="blog-card-summary">{post.summary}</p>

        <div className="blog-card-meta">
          <span>
            {post.published_at}. {post.author_id.full_name}
          </span>
        </div>

        <div className="blog-card-footer">
          <button className="blog-card-read-more">Read More</button>
          <span
            className="blog-card-badge"
            style={{
              backgroundColor: tagColor.bg,
              color: tagColor.text,
            }}
          >
            {post.category_id.name}
          </span>
        </div>
      </div>
    </div>
  );
}
