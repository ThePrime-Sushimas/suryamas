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
