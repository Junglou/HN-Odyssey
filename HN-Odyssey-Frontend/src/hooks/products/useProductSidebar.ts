import { useState } from "react";

export type FilterOption = { id: string; label: string; value: string };
export type FilterSection = {
  id: string;
  name: string;
  options: FilterOption[];
};

// mock data
const MOCK_FILTER_SECTIONS: FilterSection[] = [
  {
    id: "size",
    name: "Size",
    options: [
      { id: "s1", label: "S", value: "S" },
      { id: "s2", label: "M", value: "M" },
      { id: "s3", label: "L", value: "L" },
      { id: "s4", label: "XL", value: "XL" },
    ],
  },
  {
    id: "color",
    name: "Color",
    options: [
      { id: "c1", label: "Black", value: "Black" },
      { id: "c2", label: "White", value: "White" },
      { id: "c3", label: "Blue", value: "Blue" },
    ],
  },
  {
    id: "material",
    name: "Material",
    options: [
      { id: "m1", label: "Cotton", value: "Cotton" },
      { id: "m2", label: "Polyester", value: "Polyester" },
    ],
  },
];

export function useProductSidebar() {
  const [filterSections] = useState<FilterSection[]>(MOCK_FILTER_SECTIONS);

  return {
    filterSections,
  };
}
