// imports
import { useState, useMemo, useCallback } from "react";

// types
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
  };
}

export interface SectionConfig {
  id: string;
  pageId: PageType;
  name: string;
  backgroundUrl: string;
  elements: EditorElement[];
}

// mock data
const MOCK_SECTIONS: SectionConfig[] = [
  {
    id: "sec-001",
    pageId: "homepage",
    name: "Main Hero Slider",
    backgroundUrl: "https://via.placeholder.com/1200x600?text=Hero+Background",
    elements: [
      {
        id: "el-1",
        type: "heading",
        x: 100,
        y: 100,
        width: 600,
        height: 80,
        content: "Giải pháp chuyển đổi số toàn diện",
        tag: "h1",
        rotate: 0,
        style: {
          color: "#111827",
          fontSize: "48px",
          fontWeight: "bold",
          textAlign: "left",
          lineHeight: "1.2",
        },
      },
      {
        id: "el-2",
        type: "text",
        x: 100,
        y: 200,
        width: 500,
        height: 80,
        content:
          "Tối ưu hóa quy trình làm việc và tăng trưởng doanh thu với nền tảng của chúng tôi.",
        tag: "p",
        rotate: 0,
        style: {
          color: "#374151",
          fontSize: "18px",
          textAlign: "left",
          lineHeight: "1.6",
        },
      },
      {
        id: "el-3",
        type: "button",
        x: 100,
        y: 300,
        width: 150,
        height: 45,
        content: "Khám phá ngay",
        link: "/services",
        rotate: 0,
        style: {
          backgroundColor: "#2563eb",
          color: "#ffffff",
          borderRadius: "8px",
          textAlign: "center",
        },
      },
    ],
  },
];

// hook
export function useContentConfig() {
  const [selectedPage, setSelectedPage] = useState<PageType>("homepage");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("sec-001");
  const [sections, setSections] = useState<SectionConfig[]>(MOCK_SECTIONS);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );

  const [history, setHistory] = useState<SectionConfig[][]>([MOCK_SECTIONS]);
  const [historyIndex, setHistoryIndex] = useState(0);

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

  const availableSections = sections.filter((s) => s.pageId === selectedPage);

  const activeElementData =
    currentSection?.elements.find((el) => el.id === selectedElementId) || null;

  const actions = {
    changePage: (page: PageType) => {
      setSelectedPage(page);
      const firstSectionOfPage = sections.find((s) => s.pageId === page);
      if (firstSectionOfPage) {
        setSelectedSectionId(firstSectionOfPage.id);
      } else {
        setSelectedSectionId("");
      }
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
        defaultContent = defaultContent || "https://via.placeholder.com/200";
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
        defaultStyle = {
          backgroundColor: "#d1d5db",
        };
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

    saveConfig: () => {
      console.log("Saving Final JSON:", currentSection);
      alert(
        `Đã lưu cấu hình section: ${currentSection?.name}. Mở Console (F12) để xem mã JSON xuất ra.`,
      );
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
  };
}
