import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MenuItem } from "./types";

export const isItemActive = (item: MenuItem, pathname: string): boolean => {
  if (item.href === pathname) return true;

  if (item.submenu) {
    return item.submenu.some((sub) => isItemActive(sub, pathname));
  }

  return false;
};

export const MenuItemComponent = ({
  item,
  level,
  onNavigate,
}: {
  item: MenuItem;
  level: number;
  onNavigate?: () => void;
}) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const hasSubmenu = !!item.submenu?.length;
  const isActive = isItemActive(item, location.pathname);

  useEffect(() => {
    if (hasSubmenu && isActive) {
      setIsOpen(true);
    }
  }, [hasSubmenu, isActive]);

  const handleClick = () => {
    if (hasSubmenu) {
      setIsOpen((prev) => !prev);
      return; // Don't close sidebar when toggling submenu
    }
    onNavigate?.();
  };

  const padding =
    level === 0 ? "px-3" : level === 1 ? "ml-4 px-3" : "ml-8 px-3";

  const baseClass =
    "group flex items-center w-full py-2 text-sm font-medium rounded-md transition-colors";

  const activeClass = isActive
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700";

  // =======================
  // WITH SUBMENU
  // =======================
  if (hasSubmenu) {
    return (
      <div>
        <button
          onClick={handleClick}
          className={`${baseClass} ${padding} ${activeClass}`}
        >
          <span className="mr-3 shrink-0">{item.icon}</span>
          <span className="flex-1 text-left">{item.name}</span>

          {isOpen ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>

        {isOpen && (
          <div className="mt-1 space-y-1">
            {item.submenu!.map((sub) => (
              <MenuItemComponent
                key={sub.id}
                item={sub}
                level={level + 1}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // =======================
  // SINGLE LINK
  // =======================
  return (
    <Link
      to={item.href || "#"}
      onClick={handleClick}
      className={`${baseClass} ${padding} ${activeClass}`}
    >
      <span className="mr-3 shrink-0">{item.icon}</span>
      {item.name}
    </Link>
  );
};
