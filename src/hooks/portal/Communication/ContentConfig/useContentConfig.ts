import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export type PageType =
  | "homepage"
  | "about_us"
  | "contact"
  | "product_page"
  | "global";

export type ElementType =
  | "text"
  | "button"
  | "image"
  | "heading"
  | "badge"
  | "blockquote"
  | "dropcap"
  | "animated"
  | "textlink"
  | "divider"
  | "video-link"
  | "video-upload"
  | "rectangle"
  | "ellipse";

export interface EditorElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  link?: string;
  tag?: string;
  rotate?: number;
  style?: {
    backgroundColor?: string;
    color?: string;
    fontSize?: string;
    borderRadius?: string;
    textAlign?: "left" | "center" | "right" | "justify";
    lineHeight?: string;
    fontWeight?: string;
    fontStyle?: string;
    borderLeft?: string;
    paddingLeft?: string;
    textDecoration?: string;
    textUnderlineOffset?: string;
    clipPath?: string;
    transform?: string;
    fontFamily?: string;
    margin?: string | number;
    border?: string;
    cursor?: string;
    objectFit?: string;
    background?: string;
    padding?: string;
  };
}

export interface SectionConfig {
  id: string;
  pageId: PageType | string;
  name: string;
  backgroundUrl: string;
  elements: EditorElement[];
}

// BỘ KHUNG PREDEFINED ĐẦY ĐỦ 100% Y HỆT BÊN CLIENT
const getPredefinedSections = (page: PageType): SectionConfig[] => {
  const timestamp = Date.now();
  if (page === "homepage") {
    return [
      {
        id: `sec-jfy-${timestamp}-1`,
        pageId: page,
        name: "Just For You - Slide 1",
        backgroundUrl:
          "https://placehold.co/1920x900/111827/ffffff?text=Slide+1",
        elements: [
          {
            id: "el-1",
            type: "heading",
            x: 81,
            y: 170,
            width: 382,
            height: 40,
            content: "Recommend for you",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "32px",
              fontWeight: "700",
              color: "rgba(255,255,255,0.9)",
              margin: "0",
            },
            tag: "h2",
          },
          {
            id: "el-2",
            type: "text",
            x: 81,
            y: 220,
            width: 300,
            height: 40,
            content: "Thoughtfully chosen to match your moment.",
            style: {
              fontFamily: "'Lexend', sans-serif",
              fontSize: "16px",
              fontWeight: "400",
              color: "rgba(255,255,255,0.9)",
              margin: "0",
            },
            tag: "p",
          },
          {
            id: "el-3",
            type: "button",
            x: 81,
            y: 290,
            width: 200,
            height: 50,
            content: "Explore",
            style: {
              backgroundColor: "#fff",
              borderRadius: "268px",
              border: "none",
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "24px",
              fontWeight: "700",
              color: "#000",
              cursor: "pointer",
            },
          },
        ],
      },
      {
        id: `sec-jfy-${timestamp}-2`,
        pageId: page,
        name: "Just For You - Slide 2",
        backgroundUrl:
          "https://placehold.co/1920x900/374151/ffffff?text=Slide+2",
        elements: [
          {
            id: "el-4",
            type: "heading",
            x: 81,
            y: 220,
            width: 400,
            height: 40,
            content: "New Arrivals",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "32px",
              fontWeight: "700",
              color: "rgba(255,255,255,0.9)",
              margin: "0",
            },
            tag: "h2",
          },
        ],
      },
      {
        id: "sec-jfy-3",
        pageId: page,
        name: "Just For You - Slide 3",
        backgroundUrl:
          "https://placehold.co/1920x900/4b5563/ffffff?text=Slide+3",
        elements: [
          {
            id: "el-jfy3-1",
            type: "heading",
            x: 81,
            y: 170,
            width: 382,
            height: 40,
            content: "Trending Now",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "32px",
              fontWeight: "700",
              color: "rgba(255,255,255,0.9)",
              margin: "0",
            },
            tag: "h2",
          },
          {
            id: "el-jfy3-2",
            type: "text",
            x: 81,
            y: 220,
            width: 350,
            height: 40,
            content: "Discover what's hot this season.",
            style: {
              fontFamily: "'Lexend', sans-serif",
              fontSize: "16px",
              fontWeight: "400",
              color: "rgba(255,255,255,0.9)",
              margin: "0",
            },
            tag: "p",
          },
          {
            id: "el-jfy3-3",
            type: "button",
            x: 81,
            y: 290,
            width: 200,
            height: 50,
            content: "Shop Now",
            style: {
              backgroundColor: "#fff",
              borderRadius: "268px",
              border: "none",
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "24px",
              fontWeight: "700",
              color: "#000",
              cursor: "pointer",
            },
          },
        ],
      },
      {
        id: "sec-jfy-4",
        pageId: page,
        name: "Just For You - Slide 4",
        backgroundUrl:
          "https://placehold.co/1920x900/9ca3af/ffffff?text=Slide+4",
        elements: [
          {
            id: "el-jfy4-1",
            type: "heading",
            x: 81,
            y: 170,
            width: 382,
            height: 40,
            content: "Limited Offers",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "32px",
              fontWeight: "700",
              color: "rgba(255,255,255,0.9)",
              margin: "0",
            },
            tag: "h2",
          },
          {
            id: "el-jfy4-2",
            type: "text",
            x: 81,
            y: 220,
            width: 350,
            height: 40,
            content: "Grab them before they're gone!",
            style: {
              fontFamily: "'Lexend', sans-serif",
              fontSize: "16px",
              fontWeight: "400",
              color: "rgba(255,255,255,0.9)",
              margin: "0",
            },
            tag: "p",
          },
          {
            id: "el-jfy4-3",
            type: "button",
            x: 81,
            y: 290,
            width: 200,
            height: 50,
            content: "View Deals",
            style: {
              backgroundColor: "#fff",
              borderRadius: "268px",
              border: "none",
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "24px",
              fontWeight: "700",
              color: "#000",
              cursor: "pointer",
            },
          },
        ],
      },
      {
        id: "sec-jfy-5",
        pageId: page,
        name: "Just For You - Slide 5",
        backgroundUrl:
          "https://placehold.co/1920x900/1f2937/ffffff?text=Slide+5",
        elements: [
          {
            id: "el-jfy5-1",
            type: "heading",
            x: 81,
            y: 170,
            width: 450,
            height: 40,
            content: "Members Exclusive",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "32px",
              fontWeight: "700",
              color: "rgba(255,255,255,0.9)",
              margin: "0",
            },
            tag: "h2",
          },
          {
            id: "el-jfy5-2",
            type: "text",
            x: 81,
            y: 220,
            width: 350,
            height: 40,
            content: "Special deals just for you.",
            style: {
              fontFamily: "'Lexend', sans-serif",
              fontSize: "16px",
              fontWeight: "400",
              color: "rgba(255,255,255,0.9)",
              margin: "0",
            },
            tag: "p",
          },
          {
            id: "el-jfy5-3",
            type: "button",
            x: 81,
            y: 290,
            width: 200,
            height: 50,
            content: "Join Now",
            style: {
              backgroundColor: "#fff",
              borderRadius: "268px",
              border: "none",
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "24px",
              fontWeight: "700",
              color: "#000",
              cursor: "pointer",
            },
          },
        ],
      },
      {
        id: `sec-kids-${timestamp}`,
        pageId: page,
        name: "Kids Section",
        backgroundUrl: "#C9E3E8",
        elements: [
          {
            id: "el-k1-img",
            type: "image",
            x: 81,
            y: 50,
            width: 353,
            height: 470,
            content: "https://placehold.co/353x470/111827/ffffff?text=Kids+Img",
            style: { borderRadius: "10px" },
          },
          {
            id: "el-k1-title",
            type: "heading",
            x: 81,
            y: 560,
            width: 322,
            height: 47,
            content: "Made for Play, Built for Joy",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "32px",
              fontWeight: "700",
            },
            tag: "h3",
          },
          {
            id: "el-k1-desc",
            type: "text",
            x: 81,
            y: 620,
            width: 322,
            height: 20,
            content: "“Designed for every little moment.”",
            style: { fontFamily: "'Lexend', sans-serif", fontSize: "16px" },
            tag: "p",
          },
          {
            id: "el-k2-title",
            type: "heading",
            x: 480,
            y: 50,
            width: 544,
            height: 47,
            content: "Little Adventures Await",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "32px",
              fontWeight: "700",
            },
            tag: "h3",
          },
          {
            id: "el-k2-desc",
            type: "text",
            x: 480,
            y: 110,
            width: 544,
            height: 20,
            content: "“Inspired by the wonder of childhood...”",
            style: { fontFamily: "'Lexend', sans-serif", fontSize: "16px" },
            tag: "p",
          },
          {
            id: "el-k2-img",
            type: "image",
            x: 480,
            y: 160,
            width: 620,
            height: 443,
            content:
              "https://placehold.co/620x443/e5e7eb/000000?text=Kid+Image+2",
            style: { borderRadius: "10px" },
          },
          {
            id: "el-k3-img",
            type: "image",
            x: 1140,
            y: 100,
            width: 350,
            height: 528,
            content:
              "https://placehold.co/350x528/e5e7eb/000000?text=Kid+Image+3",
            style: { borderRadius: "10px" },
          },
          {
            id: "el-k4-img",
            type: "image",
            x: 1530,
            y: 50,
            width: 379,
            height: 474,
            content:
              "https://placehold.co/379x474/e5e7eb/000000?text=Kid+Image+4",
            style: { borderRadius: "10px" },
          },
          {
            id: "el-k4-title",
            type: "heading",
            x: 1530,
            y: 560,
            width: 382,
            height: 47,
            content: "Bright Styles for Bright Smiles",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "32px",
              fontWeight: "700",
            },
            tag: "h3",
          },
          {
            id: "el-k4-desc",
            type: "text",
            x: 1530,
            y: 620,
            width: 382,
            height: 20,
            content: "“Where comfort meets curiosity.”",
            style: { fontFamily: "'Lexend', sans-serif", fontSize: "16px" },
            tag: "p",
          },
          {
            id: "el-k4-btn",
            type: "button",
            x: 1530,
            y: 680,
            width: 193,
            height: 50,
            content: "Explore",
            style: {
              backgroundColor: "#fff",
              borderRadius: "268px",
              fontWeight: "700",
              fontSize: "24px",
              color: "#000",
            },
          },
        ],
      },
      {
        id: `sec-oh-${timestamp}`,
        pageId: page,
        name: "Other Half",
        backgroundUrl: "#ffffff",
        elements: [
          {
            id: "oh-img-left",
            type: "image",
            x: 0,
            y: 0,
            width: 960,
            height: 990,
            content:
              "https://placehold.co/960x990/e5e7eb/000000?text=Her+Image",
            style: { objectFit: "cover" },
          },
          {
            id: "oh-her-title",
            type: "heading",
            x: 640,
            y: 91,
            width: 260,
            height: 30,
            content: "Gifts for Her",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "24px",
              fontWeight: "700",
              color: "#fff",
              textAlign: "right",
            },
            tag: "h3",
          },
          {
            id: "oh-her-desc",
            type: "text",
            x: 640,
            y: 126,
            width: 260,
            height: 15,
            content: "“A touch of beauty crafted just for her.”",
            style: {
              fontFamily: "'Lexend', sans-serif",
              fontSize: "12px",
              color: "#fff",
              textAlign: "right",
            },
            tag: "p",
          },
          {
            id: "oh-her-btn",
            type: "button",
            x: 810,
            y: 156,
            width: 90,
            height: 20,
            content: "DISCOVER",
            style: {
              fontFamily: "'Lexend', sans-serif",
              fontSize: "16px",
              fontWeight: "700",
              color: "#fff",
              background: "none",
              border: "none",
              textDecoration: "underline",
              padding: "0",
            },
          },
          {
            id: "oh-img-right",
            type: "image",
            x: 960,
            y: 0,
            width: 960,
            height: 990,
            content:
              "https://placehold.co/960x990/374151/ffffff?text=Him+Image",
            style: { objectFit: "cover" },
          },
          {
            id: "oh-him-title",
            type: "heading",
            x: 970,
            y: 750,
            width: 300,
            height: 30,
            content: "Gifts for Him",
            style: {
              fontFamily: "'Lexend Deca', sans-serif",
              fontSize: "24px",
              fontWeight: "700",
              color: "#fff",
              textAlign: "left",
            },
            tag: "h3",
          },
          {
            id: "oh-him-desc",
            type: "text",
            x: 970,
            y: 785,
            width: 300,
            height: 15,
            content: "“Thoughtful picks made to match his moments.”",
            style: {
              fontFamily: "'Lexend', sans-serif",
              fontSize: "12px",
              color: "#fff",
              textAlign: "left",
            },
            tag: "p",
          },
          {
            id: "oh-him-btn",
            type: "button",
            x: 970,
            y: 815,
            width: 90,
            height: 20,
            content: "DISCOVER",
            style: {
              fontFamily: "'Lexend', sans-serif",
              fontSize: "16px",
              fontWeight: "700",
              color: "#fff",
              background: "none",
              border: "none",
              textDecoration: "underline",
              padding: "0",
            },
          },
        ],
      },
      {
        id: `sec-jic-${timestamp}`,
        pageId: page,
        name: "Just In Case",
        backgroundUrl: "#ffffff",
        elements: [
          {
            id: "jic-1",
            type: "image",
            x: 418,
            y: 0,
            width: 318,
            height: 230,
            content: "https://placehold.co/318x230",
            style: { borderRadius: "10px" },
          },
          {
            id: "jic-t1",
            type: "heading",
            x: 418,
            y: 244,
            width: 318,
            height: 20,
            content: "The Power Ration",
            style: {
              fontSize: "16px",
              fontWeight: "700",
              textAlign: "center",
              textDecoration: "underline",
            },
            tag: "h3",
          },
          {
            id: "jic-2",
            type: "image",
            x: 801,
            y: 0,
            width: 318,
            height: 230,
            content: "https://placehold.co/318x230",
            style: { borderRadius: "10px" },
          },
          {
            id: "jic-t2",
            type: "heading",
            x: 801,
            y: 244,
            width: 318,
            height: 20,
            content: "Vital Aid",
            style: {
              fontSize: "16px",
              fontWeight: "700",
              textAlign: "center",
              textDecoration: "underline",
            },
            tag: "h3",
          },
          {
            id: "jic-3",
            type: "image",
            x: 1184,
            y: 0,
            width: 318,
            height: 230,
            content: "https://placehold.co/318x230",
            style: { borderRadius: "10px" },
          },
          {
            id: "jic-t3",
            type: "heading",
            x: 1184,
            y: 244,
            width: 318,
            height: 20,
            content: "Solo Survivor",
            style: {
              fontSize: "16px",
              fontWeight: "700",
              textAlign: "center",
              textDecoration: "underline",
            },
            tag: "h3",
          },
          {
            id: "jic-4",
            type: "image",
            x: 418,
            y: 310,
            width: 318,
            height: 230,
            content: "https://placehold.co/318x230",
            style: { borderRadius: "10px" },
          },
          {
            id: "jic-t4",
            type: "heading",
            x: 418,
            y: 554,
            width: 318,
            height: 20,
            content: "The Bunker",
            style: {
              fontSize: "16px",
              fontWeight: "700",
              textAlign: "center",
              textDecoration: "underline",
            },
            tag: "h3",
          },
          {
            id: "jic-5",
            type: "image",
            x: 801,
            y: 310,
            width: 318,
            height: 230,
            content: "https://placehold.co/318x230",
            style: { borderRadius: "10px" },
          },
          {
            id: "jic-t5",
            type: "heading",
            x: 801,
            y: 554,
            width: 318,
            height: 20,
            content: "The Wayfinder",
            style: {
              fontSize: "16px",
              fontWeight: "700",
              textAlign: "center",
              textDecoration: "underline",
            },
            tag: "h3",
          },
          {
            id: "jic-6",
            type: "image",
            x: 1184,
            y: 310,
            width: 318,
            height: 230,
            content: "https://placehold.co/318x230",
            style: { borderRadius: "10px" },
          },
          {
            id: "jic-t6",
            type: "heading",
            x: 1184,
            y: 554,
            width: 318,
            height: 20,
            content: "Odyssey Guardian",
            style: {
              fontSize: "16px",
              fontWeight: "700",
              textAlign: "center",
              textDecoration: "underline",
            },
            tag: "h3",
          },
          {
            id: "jic-cio",
            type: "heading",
            x: 585,
            y: 650,
            width: 749,
            height: 31,
            content: "Check it Out!",
            style: {
              fontSize: "24px",
              fontFamily: "Lemon",
              textAlign: "center",
            },
            tag: "h3",
          },
          {
            id: "jic-btn",
            type: "button",
            x: 860,
            y: 706,
            width: 200,
            height: 50,
            content: "More",
            style: {
              background: "#000",
              color: "#fff",
              borderRadius: "268px",
              fontSize: "24px",
              fontWeight: "700",
            },
          },
        ],
      },
    ];
  }
  return [
    {
      id: `sec-def-1`,
      pageId: page,
      name: "Default Section",
      backgroundUrl: "",
      elements: [],
    },
  ];
};

export function useContentConfig() {
  const [selectedPage, setSelectedPage] = useState<PageType>("homepage");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );

  const [history, setHistory] = useState<SectionConfig[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axiosClient.get(
          `/marketing/content/page-configs/${selectedPage}`,
        );
        const data = res.data?.data;
        const initialSections = getPredefinedSections(selectedPage);

        // NẾU DATABASE TRỐNG HOẶC ÍT HƠN BỘ PREDEFINED (Do lưu lỗi trước đó), NÓ SẼ RESET LẠI FULL KHUNG
        if (data && data.sections && data.sections.length > 0) {
          const mergedSections = initialSections.map((mockSec) => {
            const dbSec = data.sections.find(
              (s: SectionConfig) => s.name === mockSec.name,
            );
            // Cập nhật thông minh: Chỉ ghi đè khi dbSec có nhiều element hơn mockSec (nghĩa là Admin đã thật sự chỉnh sửa)
            if (dbSec && dbSec.elements.length >= mockSec.elements.length) {
              return dbSec;
            }
            return mockSec;
          });

          setSections(mergedSections);
          setHistory([mergedSections]);
          setHistoryIndex(0);
          setSelectedSectionId(mergedSections[0].id);
        } else {
          setSections(initialSections);
          setHistory([initialSections]);
          setHistoryIndex(0);
          setSelectedSectionId(initialSections[0].id);
        }
      } catch (error) {
        console.error("Lỗi lấy cấu hình từ API:", error);
        toast.error("Không thể tải cấu hình giao diện từ Server!");
      }
    };

    fetchConfig();
  }, [selectedPage]);

  const saveHistory = useCallback(
    (newSections: SectionConfig[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newSections);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setSections(newSections);
    },
    [history, historyIndex],
  );

  const currentSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || null;
  }, [sections, selectedSectionId]);

  const availableSections = sections;
  const activeElementData =
    currentSection?.elements.find((el) => el.id === selectedElementId) || null;

  const actions = {
    changePage: (page: PageType) => {
      setSelectedPage(page);
      setSelectedElementId(null);
    },
    changeSection: (sectionId: string) => {
      setSelectedSectionId(sectionId);
      setSelectedElementId(null);
    },
    selectElement: (elementId: string | null) => {
      setSelectedElementId(elementId);
    },
    addElement: (
      type: ElementType,
      dropX: number,
      dropY: number,
      customContent?: string,
    ) => {
      if (!currentSection) return;
      let defaultWidth = 200,
        defaultHeight = 60,
        defaultContent = customContent || "";
      let defaultStyle: EditorElement["style"] = {
        color: "#000",
        fontSize: "16px",
      };
      let defaultTag = "p";

      if (type === "button") {
        defaultWidth = 150;
        defaultHeight = 45;
        defaultContent = defaultContent || "Click Here";
        defaultStyle = {
          backgroundColor: "#111827",
          color: "#fff",
          borderRadius: "6px",
          textAlign: "center",
        };
      } else if (type === "image") {
        defaultWidth = 200;
        defaultHeight = 200;
        defaultContent =
          defaultContent ||
          "https://placehold.co/200x200/e2e8f0/6b7280?text=Image";
        defaultStyle = { borderRadius: "0px" };
      } else if (type === "video-link") {
        defaultWidth = 400;
        defaultHeight = 225;
        defaultContent =
          defaultContent || "https://www.youtube.com/embed/dQw4w9WgXcQ";
      } else if (type === "video-upload") {
        defaultWidth = 400;
        defaultHeight = 225;
        defaultContent = defaultContent || "";
      } else if (type === "rectangle") {
        defaultWidth = 150;
        defaultHeight = 150;
        defaultContent = "";
        defaultStyle = {
          backgroundColor: "#d1d5db",
          borderRadius: "0px",
          clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
        };
      } else if (type === "ellipse") {
        defaultWidth = 150;
        defaultHeight = 150;
        defaultContent = "";
        defaultStyle = {
          backgroundColor: "#d1d5db",
          borderRadius: "50%",
          clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
        };
      } else if (type === "text") {
        defaultWidth = 300;
        defaultHeight = 80;
        defaultContent = defaultContent || "Nhập đoạn mô tả của bạn vào đây...";
        defaultStyle = {
          color: "#4b5563",
          fontSize: "16px",
          textAlign: "left",
          lineHeight: "1.6",
        };
      } else if (type === "heading") {
        defaultWidth = 450;
        defaultHeight = 60;
        defaultContent = defaultContent || "Nhập tiêu đề chính";
        defaultTag = "h2";
        defaultStyle = {
          color: "#111827",
          fontSize: "36px",
          fontWeight: "bold",
          textAlign: "left",
          lineHeight: "1.2",
        };
      } else if (type === "badge") {
        defaultWidth = 120;
        defaultHeight = 30;
        defaultContent = defaultContent || "Label";
        defaultStyle = {
          backgroundColor: "#fee2e2",
          color: "#ef4444",
          fontSize: "12px",
          fontWeight: "bold",
          borderRadius: "15px",
          textAlign: "center",
        };
      } else if (type === "blockquote") {
        defaultWidth = 400;
        defaultHeight = 100;
        defaultContent =
          defaultContent ||
          "Sự sáng tạo đòi hỏi phải có can đảm để buông tay khỏi những điều chắc chắn.";
        defaultTag = "blockquote";
        defaultStyle = {
          color: "#4b5563",
          fontSize: "18px",
          fontStyle: "italic",
          borderLeft: "4px solid #3b82f6",
          paddingLeft: "16px",
          lineHeight: "1.6",
        };
      } else if (type === "dropcap") {
        defaultWidth = 400;
        defaultHeight = 120;
        defaultContent =
          defaultContent ||
          "Khởi đầu của mọi thành công luôn bắt nguồn từ một ý tưởng táo bạo...";
        defaultStyle = {
          color: "#374151",
          fontSize: "16px",
          lineHeight: "1.6",
          textAlign: "left",
        };
      } else if (type === "animated") {
        defaultWidth = 500;
        defaultHeight = 60;
        defaultContent = defaultContent || "Chúng tôi tạo ra sự khác biệt";
        defaultTag = "h2";
        defaultStyle = {
          color: "#111827",
          fontSize: "32px",
          fontWeight: "bold",
          textAlign: "center",
        };
      } else if (type === "textlink") {
        defaultWidth = 120;
        defaultHeight = 40;
        defaultContent = defaultContent || "DISCOVER";
        defaultTag = "span";
        defaultStyle = {
          color: "#111827",
          fontSize: "16px",
          fontWeight: "bold",
          textAlign: "center",
          textDecoration: "underline",
          textUnderlineOffset: "4px",
        };
      } else if (type === "divider") {
        defaultWidth = 300;
        defaultHeight = 2;
        defaultContent = "";
        defaultStyle = { backgroundColor: "#d1d5db" };
      }

      const newElement: EditorElement = {
        id: `el-${Date.now()}`,
        type,
        x: dropX,
        y: dropY,
        width: defaultWidth,
        height: defaultHeight,
        content: defaultContent,
        link: type === "button" || type === "textlink" ? "/" : undefined,
        tag: defaultTag,
        style: defaultStyle,
        rotate: 0,
      };

      const newSections = sections.map((sec) =>
        sec.id === currentSection.id
          ? { ...sec, elements: [...sec.elements, newElement] }
          : sec,
      );
      saveHistory(newSections);
      setSelectedElementId(newElement.id);
    },

    updateSectionBackground: (url: string) => {
      if (!currentSection) return;
      const newSections = sections.map((sec) =>
        sec.id === currentSection.id ? { ...sec, backgroundUrl: url } : sec,
      );
      saveHistory(newSections);
    },

    reorderElement: (
      elementId: string,
      direction: "front" | "back" | "up" | "down",
    ) => {
      if (!currentSection) return;
      const elIndex = currentSection.elements.findIndex(
        (el) => el.id === elementId,
      );
      if (elIndex === -1) return;
      const newElements = [...currentSection.elements];
      const [el] = newElements.splice(elIndex, 1);
      if (direction === "front") newElements.push(el);
      else if (direction === "back") newElements.unshift(el);
      else if (direction === "up")
        newElements.splice(Math.min(newElements.length, elIndex + 1), 0, el);
      else if (direction === "down")
        newElements.splice(Math.max(0, elIndex - 1), 0, el);
      const newSections = sections.map((sec) =>
        sec.id === currentSection.id ? { ...sec, elements: newElements } : sec,
      );
      saveHistory(newSections);
    },

    updateElementPosition: (elementId: string, newX: number, newY: number) => {
      if (!currentSection) return;
      const newSections = sections.map((sec) =>
        sec.id === currentSection.id
          ? {
              ...sec,
              elements: sec.elements.map((el) =>
                el.id === elementId
                  ? { ...el, x: Math.max(0, newX), y: Math.max(0, newY) }
                  : el,
              ),
            }
          : sec,
      );
      saveHistory(newSections);
    },

    updateElementProperties: (
      elementId: string,
      updates: Partial<EditorElement>,
    ) => {
      if (!currentSection) return;
      const newSections = sections.map((sec) =>
        sec.id === currentSection.id
          ? {
              ...sec,
              elements: sec.elements.map((el) =>
                el.id === elementId
                  ? {
                      ...el,
                      ...updates,
                      style: { ...el.style, ...updates.style },
                    }
                  : el,
              ),
            }
          : sec,
      );
      saveHistory(newSections);
    },

    removeElement: (elementId: string) => {
      if (!currentSection) return;
      const newSections = sections.map((sec) =>
        sec.id === currentSection.id
          ? {
              ...sec,
              elements: sec.elements.filter((el) => el.id !== elementId),
            }
          : sec,
      );
      saveHistory(newSections);
      if (selectedElementId === elementId) setSelectedElementId(null);
    },

    duplicateElement: (elementId: string) => {
      if (!currentSection) return;
      const targetElement = currentSection.elements.find(
        (el) => el.id === elementId,
      );
      if (!targetElement) return;
      const newElement: EditorElement = {
        ...targetElement,
        id: `el-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        x: targetElement.x + 20,
        y: targetElement.y + 20,
      };
      const newSections = sections.map((sec) =>
        sec.id === currentSection.id
          ? { ...sec, elements: [...sec.elements, newElement] }
          : sec,
      );
      saveHistory(newSections);
      setSelectedElementId(newElement.id);
    },

    undo: () => {
      if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setSections(history[historyIndex - 1]);
      }
    },

    saveConfig: async () => {
      setIsSaving(true);
      try {
        await axiosClient.patch(
          `/marketing/content/page-configs/${selectedPage}`,
          { sections },
        );
        toast.success(`Lưu cấu hình trang "${selectedPage}" thành công!`);
      } catch (error: unknown) {
        const err = error as { response?: { data?: unknown } };
        console.error("Lỗi lưu JSON:", err.response?.data || error);
        toast.error("Đã xảy ra lỗi khi lưu cấu hình. Vui lòng thử lại!");
      } finally {
        setIsSaving(false);
      }
    },
  };

  return {
    selectedPage,
    selectedSectionId,
    currentSection,
    selectedElementId,
    availableSections,
    activeElementData,
    actions,
    isSaving,
  };
}
