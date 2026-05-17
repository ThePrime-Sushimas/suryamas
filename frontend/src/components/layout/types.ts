import React from "react";

export interface MenuItem {
  id: string;
  name: string;
  href?: string;
  icon: React.ReactNode;
  submenu?: MenuItem[];
  disabled?: boolean;
  badge?: number;
  module?: string;
  /** When set, menu item requires this permission (default: view) */
  permissionAction?: 'view' | 'insert' | 'update' | 'delete' | 'approve' | 'release';
}

export type PermissionMap = Record<
  string,
  {
    view?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
    approve?: boolean;
    release?: boolean;
  }
>;

