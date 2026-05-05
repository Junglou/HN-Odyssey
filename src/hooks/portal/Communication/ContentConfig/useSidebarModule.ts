// imports
import { useState, useMemo } from "react";
import type { ElementType } from "./useContentConfig";

// types
export type ModuleActionType = "drag" | "click";

export interface SidebarModule {
  id: string;
  type: ElementType;
  actionType: ModuleActionType;
  label: string;
  iconId: string;
}

export interface SidebarCategory {
  id: string;
  title: string;
  modules: SidebarModule[];
}

// config data
const SIDEBAR_DATA: SidebarCategory[] = [
  {
    id: "cat-typography",
    title: "Typography",
    modules: [
      {
        id: "mod-heading",
        type: "heading",
        actionType: "drag",
        label: "Heading",
        iconId: "heading",
      },
      {
        id: "mod-text",
        type: "text",
        actionType: "drag",
        label: "Text",
        iconId: "text",
      },
      {
        id: "mod-badge",
        type: "badge",
        actionType: "drag",
        label: "Badge",
        iconId: "badge",
      },
      {
        id: "mod-blockquote",
        type: "blockquote",
        actionType: "drag",
        label: "Blockquote",
        iconId: "blockquote",
      },
      {
        id: "mod-dropcap",
        type: "dropcap",
        actionType: "drag",
        label: "Dropcap",
        iconId: "dropcap",
      },
      {
        id: "mod-animated",
        type: "animated",
        actionType: "drag",
        label: "Animated",
        iconId: "animated",
      },
    ],
  },
  {
    id: "cat-basic",
    title: "Basic Elements",
    modules: [
      {
        id: "mod-btn",
        type: "button",
        actionType: "drag",
        label: "Button",
        iconId: "button",
      },
    ],
  },
  {
    id: "cat-media",
    title: "Media & Assets",
    modules: [
      {
        id: "mod-img",
        type: "image",
        actionType: "drag",
        label: "Image Box",
        iconId: "image",
      },
      {
        id: "mod-upload",
        type: "image",
        actionType: "click",
        label: "Upload",
        iconId: "upload",
      },
    ],
  },
];

// hook
export function useSidebarModule() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    "cat-typography",
    "cat-basic",
    "cat-media",
  ]);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) =>
      prev.includes(id) ? prev.filter((catId) => catId !== id) : [...prev, id],
    );
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return SIDEBAR_DATA;
    const lowerQuery = searchQuery.toLowerCase();

    return SIDEBAR_DATA.map((cat) => ({
      ...cat,
      modules: cat.modules.filter((mod) =>
        mod.label.toLowerCase().includes(lowerQuery),
      ),
    })).filter((cat) => cat.modules.length > 0);
  }, [searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    expandedCategories,
    toggleCategory,
    filteredCategories,
  };
}
