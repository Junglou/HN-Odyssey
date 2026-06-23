// imports
import { useBlogNews } from "../../hooks/blogNews/useBlogNews";
import BlogHero from "../../components/blogNews/BlogHero";
import BlogToolbar from "../../components/blogNews/BlogToolbar";
import BlogFeaturedSection from "../../components/blogNews/BlogFeaturedSection";
import BlogGridSection from "../../components/blogNews/BlogGridSection";
import BlogPagination from "../../components/blogNews/BlogPagination";
import BlogCard from "../../components/blogNews/BlogCard";
import "./BlogNewsPage.css";

// component
export default function BlogNewsPage() {
  // hooks
  const {
    categories,
    sortOptions,
    search,
    activeCategory,
    sortBy,
    currentPage,
    totalPages,
    featuredPost,
    featuredGridPosts,
    paginatedSections,
    specificCategoryPosts,
    handleSearchChange,
    handleCategoryChange,
    handleSortChange,
    handlePageChange,
  } = useBlogNews();

  // render
  return (
    <div className="blog-news-page-wrapper">
      <BlogHero />

      <BlogToolbar
        search={search}
        categories={categories}
        activeCategory={activeCategory}
        sortOptions={sortOptions}
        sortBy={sortBy}
        onSearchChange={handleSearchChange}
        onCategoryChange={handleCategoryChange}
        onSortChange={handleSortChange}
      />

      <h2 className="blog-category-main-title">{activeCategory}</h2>

      {activeCategory === "All articles" ? (
        <>
          {currentPage === 1 && featuredPost && (
            <BlogFeaturedSection
              featuredPost={featuredPost}
              gridPosts={featuredGridPosts}
            />
          )}

          {paginatedSections.map((section) => (
            <BlogGridSection
              key={section.title}
              title={section.title}
              posts={section.posts}
              variant="scroll"
              onReadMore={() => handleCategoryChange(section.title)}
            />
          ))}
        </>
      ) : (
        <>
          {currentPage === 1 && featuredPost && (
            <div className="blog-single-featured">
              <BlogCard post={featuredPost} variant="featured" />
            </div>
          )}

          <BlogGridSection posts={specificCategoryPosts} variant="grid" />
        </>
      )}

      {activeCategory === "All articles" &&
        paginatedSections.length === 0 &&
        !featuredPost && (
          <div className="blog-news-empty">
            <p>No articles found matching your criteria.</p>
          </div>
        )}

      {activeCategory !== "All articles" &&
        specificCategoryPosts.length === 0 &&
        !featuredPost && (
          <div className="blog-news-empty">
            <p>No articles found matching your criteria.</p>
          </div>
        )}

      <BlogPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
