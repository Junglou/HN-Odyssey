import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "react-toastify"; // THÊM IMPORT TOASTIFY
import axiosClient from "../../../../api/axiosClient"; // Sửa lại đường dẫn nếu cần

// --- THÊM LẠI VÀ EXPORT CÁC TYPE BỊ THIẾU ---
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
// --------------------------------------------

export function useContentConfig() {
  const [selectedPage, setSelectedPage] = useState<PageType>("homepage");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );

  const [history, setHistory] = useState<SectionConfig[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false); // Thêm state tracking việc lưu

  // FETCH DATA TỪ BACKEND ĐỂ RENDER (KHÔNG DÙNG MOCK)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axiosClient.get(
          `/marketing/content/page-configs/${selectedPage}`,
        );
        const data = res.data?.data;

        if (data && data.sections && data.sections.length > 0) {
          setSections(data.sections);
          setHistory([data.sections]);
          setHistoryIndex(0);
          setSelectedSectionId(data.sections[0].id);
        } else {
          // Khởi tạo 1 section trắng mặc định nếu BE trả về rỗng (Bắt buộc để UI builder có chỗ vẽ)
          const defaultSection: SectionConfig = {
            id: `sec-${Date.now()}`,
            pageId: selectedPage,
            name: "Default Section",
            backgroundUrl: "",
            elements: [],
          };
          setSections([defaultSection]);
          setHistory([[defaultSection]]);
          setHistoryIndex(0);
          setSelectedSectionId(defaultSection.id);
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

  // Vì API trả về list sections theo từng pageId riêng biệt, nên availableSections chính là sections
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

    // Hàm tạo giá trị khởi tạo (Templates) cho một thẻ HTML bất kỳ lúc user kéo thả
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

    // GỌI API ĐỂ LƯU VỀ DATABSE (PATCH) VỚI GIAO DIỆN REACT-TOASTIFY
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
    isSaving, // Trả ra ngoài để nếu thích bạn có thể dùng disable nút Save khi đang call API
  };
}
