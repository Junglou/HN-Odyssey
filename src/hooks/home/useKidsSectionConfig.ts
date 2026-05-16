import type { ConfigElement } from "./useJustForYouSlider";

export interface KidsSectionData {
  id: string;
  backgroundColor: string;
  elements: ConfigElement[];
}

// Mock data: Tọa độ kéo thả từ Portal (Canvas 1920x738)
const MOCK_KIDS_DATA: KidsSectionData = {
  id: "kids-section-1",
  backgroundColor: "#C9E3E8",
  elements: [
    {
      id: "el-k1-img",
      type: "image",
      x: 81,
      y: 50,
      width: 353,
      height: 470,
      content: "Adventure Awaits_ Embracing the Outdoors with Kids.jpg",
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
        fontWeight: 700,
      },
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
        fontWeight: 700,
      },
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
    },
    {
      id: "el-k2-img",
      type: "image",
      x: 480,
      y: 160,
      width: 620,
      height: 443,
      content:
        "One young explorer will take home $20,000, learn from Jeff Corwin, and appear in Ranger Rick magazine!.jpg",
      style: { borderRadius: "10px" },
    },

    {
      id: "el-k3-img",
      type: "image",
      x: 1140,
      y: 100,
      width: 350,
      height: 528,
      content: "tải xuống 10.jpg",
      style: { borderRadius: "10px" },
    },

    {
      id: "el-k4-img",
      type: "image",
      x: 1530,
      y: 50,
      width: 379,
      height: 474,
      content: "image.png",
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
        fontWeight: 700,
      },
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
        fontWeight: 700,
        fontSize: "24px",
      },
    },
  ],
};

export function useKidsSectionConfig() {
  return {
    configData: MOCK_KIDS_DATA,
  };
}
