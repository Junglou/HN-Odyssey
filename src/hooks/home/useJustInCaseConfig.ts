import type { SectionConfig } from "../portal/Communication/ContentConfig/useContentConfig";
import type { ConfigElement } from "./useJustForYouSlider";

export interface JustInCaseData {
  id: string;
  backgroundColor: string;
  elements: ConfigElement[];
}

// Bỏ hoàn toàn chữ "any" ở đây, TypeScript sẽ tự nội suy dựa vào interface JustInCaseData
const MOCK_JUST_IN_CASE_DATA: JustInCaseData = {
  id: "jic-1",
  backgroundColor: "#ffffff",
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
        fontWeight: 700,
        textAlign: "center",
        textDecoration: "underline",
      },
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
        fontWeight: 700,
        textAlign: "center",
        textDecoration: "underline",
      },
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
        fontWeight: 700,
        textAlign: "center",
        textDecoration: "underline",
      },
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
        fontWeight: 700,
        textAlign: "center",
        textDecoration: "underline",
      },
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
        fontWeight: 700,
        textAlign: "center",
        textDecoration: "underline",
      },
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
        fontWeight: 700,
        textAlign: "center",
        textDecoration: "underline",
      },
    },
    {
      id: "jic-cio",
      type: "heading",
      x: 585,
      y: 650,
      width: 749,
      height: 31,
      content: "Check it Out!",
      style: { fontSize: "24px", fontFamily: "Lemon", textAlign: "center" },
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
        fontWeight: 700,
      },
    },
  ],
};

export function useJustInCaseConfig(dbSection?: SectionConfig | null) {
  const configData: JustInCaseData =
    dbSection && dbSection.elements && dbSection.elements.length > 0
      ? {
          id: dbSection.id,
          backgroundColor: dbSection.backgroundUrl || "#ffffff",
          // Fix ESLint lỗi Any bằng cách ép qua unknown trước
          elements: dbSection.elements as unknown as ConfigElement[],
        }
      : MOCK_JUST_IN_CASE_DATA;

  return { configData };
}
