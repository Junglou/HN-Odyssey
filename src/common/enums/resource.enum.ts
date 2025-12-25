export enum Resource {
  USERS = 'USERS',
  PRODUCTS = 'PRODUCTS',
  ORDERS = 'ORDERS',
  INVENTORY = 'INVENTORY',
  MARKETING = 'MARKETING',
  REPORTS = 'REPORTS',
  SETTINGS = 'SETTINGS',

  CATEGORIES = 'CATEGORIES',
  ATTRIBUTES = 'ATTRIBUTES',
  TAGS = 'TAGS',
}

export enum Action {
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  MANAGE = 'MANAGE', // Quyền cao nhất (Làm gì cũng được)
}
