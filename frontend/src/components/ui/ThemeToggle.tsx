import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        p-2 rounded-xl transition-all duration-300 group relative overflow-hidden
        ${
          isDarkMode
            ? "bg-gray-800 text-amber-400 hover:bg-gray-700 shadow-[0_0_15px_rgba(251,191,36,0.1)]"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 shadow-sm"
        }
      `}
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="relative z-10">
        {isDarkMode ? (
          <Sun
            size={20}
            className="animate-in zoom-in spin-in-90 duration-500"
          />
        ) : (
          <Moon
            size={20}
            className="animate-in zoom-in spin-in-minus-90 duration-500"
          />
        )}
      </div>

      {/* Subtle glow effect on hover for dark mode */}
      {isDarkMode && (
        <div className="absolute inset-0 bg-amber-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}
