// imports
import BlogCard from "./BlogCard";
import type { BlogNewsPost } from "../../hooks/blogNews/useBlogNews";
import "./BlogFeaturedSection.css";

// types
interface BlogFeaturedSectionProps {
  featuredPost: BlogNewsPost | null;
  gridPosts: BlogNewsPost[];
}

// component
export default function BlogFeaturedSection({
  featuredPost,
  gridPosts,
}: BlogFeaturedSectionProps) {
  if (!featuredPost) return null;

  // render
  return (
    <div className="blog-featured-wrapper">
      <div className="blog-featured-main">
        <BlogCard post={featuredPost} variant="featured" />
      </div>

      {gridPosts.length > 0 && (
        <div className="blog-featured-subgrid">
          {gridPosts.slice(0, 4).map((post) => (
            <BlogCard key={post.id} post={post} variant="standard" />
          ))}
        </div>
      )}
    </div>
  );
}
