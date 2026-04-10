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
}

export type PermissionMap = Record<
  string,
  {
    view?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  }
>;

