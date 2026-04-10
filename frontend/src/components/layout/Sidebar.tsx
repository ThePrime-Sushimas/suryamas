import { useMemo } from "react";
import { usePermissionStore } from "@/features/branch_context";
import { MenuItemComponent } from "./MenuItem";
import { menuItems } from "./menu.config";
import type { MenuItem, PermissionMap } from "./types";

export const filterMenuByPermission = (
  items: MenuItem[],
  permissions: PermissionMap
): MenuItem[] => {
  return items
    .map((item) => {
      if (item.submenu) {
        return {
          ...item,
          submenu: filterMenuByPermission(item.submenu, permissions),
        };
      }
      return item;
    })
    .filter((item) => {
      if (item.submenu) return item.submenu.length > 0;
      if (item.module) return permissions[item.module]?.view;
      return true;
    });
};

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onNavigate: () => void;
  sidebarRef?: React.RefObject<HTMLDivElement | null>;
}

export const Sidebar = ({ isOpen, isCollapsed, onNavigate, sidebarRef }: SidebarProps) => {
  const { permissions, isLoaded } = usePermissionStore();

  const filteredMenuItems = useMemo(() => {
    if (!isLoaded) return menuItems;
    return filterMenuByPermission(menuItems, permissions);
  }, [permissions, isLoaded]);

  return (
    <div
      ref={sidebarRef}
      className={`
        fixed inset-y-0 left-0 z-30 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-200 ease-in-out lg:static lg:translate-x-0 lg:shadow-none
        ${isOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"}
        ${isCollapsed ? "lg:w-16" : "lg:w-64"}
        w-64
      `}
    >
      <nav className="mt-8 px-4 h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="space-y-1">
          {filteredMenuItems.map((item) => (
            <MenuItemComponent
              key={item.id}
              item={item}
              level={0}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>
    </div>
  );
};
