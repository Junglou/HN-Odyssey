// imports
import HeroBanner from "../../components/home/HeroBanner";
import CategoryShowcase from "../../components/home/CategoryShowcase";
import JustForYou from "../../components/home/JustForYou";
import KidsSection from "../../components/home/KidsSection";
import OtherHalfSection from "../../components/home/OtherHalfSection";
import JustInCaseSection from "../../components/home/JustInCaseSection";
import "./HomePage.css";

// container
export default function HomePage() {
  // render
  return (
    <div className="home-page-container">
      <HeroBanner />
      <CategoryShowcase />
      <JustForYou />
      <KidsSection />
      <OtherHalfSection />
      <JustInCaseSection />
    </div>
  );
}
