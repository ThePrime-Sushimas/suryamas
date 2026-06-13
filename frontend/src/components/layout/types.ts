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
  /**
   * Multi-module OR permission gate. When set, the item is visible if the user has
   * `permissionAction` on ANY of these modules. Overrides `module` for visibility checks.
   */
  modules?: string[];
  /** Color indicator for the menu item */
  color?: "red" | "green";
}

export type PermissionMap = Record<
  string,
  {
    view?: boolean;
    insert?: boolean;
    update?: boolean;
    delete?: boolean;
    approve?: boolean;
    release?: boolean;
  }
>;