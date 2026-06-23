import { SetMetadata } from '@nestjs/common';
import { Action, Resource } from '../enums/resource.enum';

export const PERMISSIONS_KEY = 'permissions';

// Cách dùng: @RequirePermissions(Resource.PRODUCTS, Action.CREATE)
export const RequirePermissions = (resource: Resource, action: Action) =>
  SetMetadata(PERMISSIONS_KEY, { resource, action });
