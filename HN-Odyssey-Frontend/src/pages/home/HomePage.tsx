import { useState, useEffect } from "react";
import HeroBanner from "../../components/home/HeroBanner";
import CategoryShowcase from "../../components/home/CategoryShowcase";
import JustForYou from "../../components/home/JustForYou";
import KidsSection from "../../components/home/KidsSection";
import OtherHalfSection from "../../components/home/OtherHalfSection";
import JustInCaseSection from "../../components/home/JustInCaseSection";
import axiosClient from "../../api/axiosClient";
import type { SectionConfig } from "../../hooks/portal/Communication/ContentConfig/useContentConfig";
import "./HomePage.css";

export default function HomePage() {
  const [sections, setSections] = useState<SectionConfig[]>([]);

  // Tải dữ liệu an toàn
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axiosClient.get(
          "/marketing/content/page-configs/homepage",
        );
        const data = res.data?.data;
        if (data && data.sections && data.sections.length > 0) {
          setSections(data.sections);
        }
      } catch (error) {
        console.error(
          "Failed to load homepage config, falling back to local mocks:",
          error,
        );
      }
    };
    fetchConfig();
  }, []);

  // Chỉ căn giữa một lần cho mỗi khối để không giật lại khi người dùng đang vuốt
  // (thanh địa chỉ trình duyệt co giãn cũng phát sự kiện resize).
  useEffect(() => {
    const centerAll = () => {
      document
        .querySelectorAll<HTMLElement>(".home-canvas-scroll")
        .forEach((el) => {
          if (el.scrollWidth <= el.clientWidth) {
            delete el.dataset.centered; // lên desktop: lần sau quay lại mobile sẽ căn giữa lại
            return;
          }
          if (el.dataset.centered === "1") return;
          el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
          el.dataset.centered = "1";
        });
    };
    centerAll();
    window.addEventListener("resize", centerAll);
    return () => window.removeEventListener("resize", centerAll);
  }, []);

  // Lọc dữ liệu bằng Optional Chaining (?.)
  const justForYouSlides =
    sections?.filter((s) => s?.name?.toLowerCase()?.includes("just for you")) ||
    [];
  const kidsSection =
    sections?.find((s) => s?.name?.toLowerCase()?.includes("kids section")) ||
    null;
  const otherHalfSection =
    sections?.find((s) => s?.name?.toLowerCase()?.includes("other half")) ||
    null;
  const justInCaseSection =
    sections?.find((s) => s?.name?.toLowerCase()?.includes("just in case")) ||
    null;

  return (
    <div className="home-page-container">
      <HeroBanner />
      <CategoryShowcase />
      <JustForYou dbSlides={justForYouSlides} />
      <KidsSection dbSection={kidsSection} />
      <OtherHalfSection dbSection={otherHalfSection} />
      <JustInCaseSection dbSection={justInCaseSection} />
    </div>
  );
}
