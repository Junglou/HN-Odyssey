export interface CategoryTree {
  _id: string;
  name: string;
  slug: string;
  parentId: string | null;
  image?: string;
  level: number;
  order: number;
  is_active: boolean;
  children: CategoryTree[];
}
