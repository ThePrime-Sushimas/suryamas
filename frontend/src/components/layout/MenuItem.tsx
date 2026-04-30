import { useState, useEffect, useRef } from "react";
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

// ─── Tooltip saat collapsed ───────────────────────────────────────────────────
const CollapsedTooltip = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setTop(rect.top + rect.height / 2);
    }
    setShow(true);
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className="fixed z-999 pointer-events-none"
          style={{ top: top - 14, left: 68 }}
        >
          <div className="flex items-center gap-1">
            {/* Arrow */}
            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-gray-800 dark:border-r-gray-100" />
            <span className="bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap">
              {label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const MenuItemComponent = ({
  item,
  level,
  onNavigate,
  isCollapsed = false,
}: {
  item: MenuItem;
  level: number;
  onNavigate?: () => void;
  isCollapsed?: boolean;
}) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const hasSubmenu = !!item.submenu?.length;
  const isActive = isItemActive(item, location.pathname);

  // Kalau sidebar di-expand ulang, tutup semua submenu kecuali yg active
  useEffect(() => {
    if (hasSubmenu && isActive && !isCollapsed) {
      setIsOpen(true);
    }
    if (isCollapsed) {
      setIsOpen(false);
    }
  }, [hasSubmenu, isActive, isCollapsed]);

  const handleClick = () => {
    if (hasSubmenu) {
      setIsOpen((prev) => !prev);
      return;
    }
    onNavigate?.();
  };

  // ── Collapsed mode: hanya icon level 0 yang ditampilkan ───────────────────
  if (isCollapsed && level === 0) {
    // Jika punya submenu → tooltip simple label saja (tidak expand)
    if (hasSubmenu) {
      return (
        <CollapsedTooltip label={item.name}>
          <button
            onClick={() => {}} // no-op saat collapsed
            className={`
              w-full flex items-center justify-center py-2.5 rounded-md transition-colors
              ${
                isActive
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              }
            `}
          >
            <span className="shrink-0">{item.icon}</span>
          </button>
        </CollapsedTooltip>
      );
    }

    // Single link
    return (
      <CollapsedTooltip label={item.name}>
        <Link
          to={item.href || "#"}
          onClick={onNavigate}
          className={`
            w-full flex items-center justify-center py-2.5 rounded-md transition-colors
            ${
              isActive
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            }
          `}
        >
          <span className="shrink-0">{item.icon}</span>
        </Link>
      </CollapsedTooltip>
    );
  }

  // ── Normal mode ────────────────────────────────────────────────────────────
  const paddingLeft =
    level === 0 ? "px-3" : level === 1 ? "ml-3 px-3" : "ml-6 px-3";

  const baseClass =
    "group flex items-center w-full py-2 text-sm font-medium rounded-md transition-colors";

  const activeClass = isActive
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700";

  // Level 1 group header (submenu dari top-level) — sedikit berbeda styling
  const isGroupHeader = level === 1 && hasSubmenu;

  if (hasSubmenu) {
    return (
      <div>
        <button
          onClick={handleClick}
          className={`
            ${baseClass} ${paddingLeft}
            ${isGroupHeader ? "text-xs uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-transparent dark:hover:bg-transparent mt-3" : activeClass}
          `}
        >
          {item.icon && (
            <span className="mr-3 shrink-0">{item.icon}</span>
          )}
          <span className="flex-1 text-left">{item.name}</span>
          {isOpen ? (
            <ChevronDown size={14} className="shrink-0 opacity-60" />
          ) : (
            <ChevronRight size={14} className="shrink-0 opacity-60" />
          )}
        </button>

        {isOpen && (
          <div className={`mt-0.5 space-y-0.5 ${level === 0 ? "" : ""}`}>
            {item.submenu!.map((sub) => (
              <MenuItemComponent
                key={sub.id}
                item={sub}
                level={level + 1}
                onNavigate={onNavigate}
                isCollapsed={false}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.href || "#"}
      onClick={handleClick}
      className={`${baseClass} ${paddingLeft} ${activeClass}`}
    >
      {item.icon && (
        <span className="mr-3 shrink-0">{item.icon}</span>
      )}
      <span className="truncate">{item.name}</span>
    </Link>
  );
};