/**
 * tailwind-theme.ts
 *
 * Centralized design tokens and reusable component classes based on the
 * Bank Reconciliation - Tailwind CSS Refactoring Guide.
 */

export const tailwindTheme = {
  // Spacing System (Design Tokens)
  spacing: {
    xs: 'gap-1',      // 4px
    sm: 'gap-2',      // 8px
    md: 'gap-3',      // 12px
    base: 'gap-4',    // 16px
    lg: 'gap-6',      // 24px
    xl: 'gap-8',      // 32px
    
    // Section spacing
    section: 'mb-8 lg:mb-10',
    itemGap: 'gap-4',
    itemVertical: 'space-y-4',
    
    // Padding Standards
    cardPadding: 'p-4 sm:p-6',
    buttonPadding: 'px-4 py-2.5',
    badgePadding: 'px-2.5 py-1',
    modalPadding: 'p-6 sm:p-8',
  },

  // Typography Scale
  typography: {
    display: 'text-3xl font-bold leading-tight',
    heading: 'text-xl font-semibold leading-snug',
    subheading: 'text-base font-semibold',
    body: 'text-sm leading-relaxed',
    label: 'text-xs font-semibold uppercase tracking-wide',
    caption: 'text-xs text-gray-500',
  },

  // Color Palette - Semantic & Consistent
  colors: {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/10',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-400',
      icon: 'text-green-600 dark:text-green-500',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-400',
      icon: 'text-amber-600 dark:text-amber-500',
    },
    danger: {
      bg: 'bg-red-50 dark:bg-red-900/10',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-400',
      icon: 'text-red-600 dark:text-red-500',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-400',
      icon: 'text-blue-600 dark:text-blue-500',
    },
    accent: {
      bg: 'bg-purple-50 dark:bg-purple-900/10',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-700 dark:text-purple-400',
      icon: 'text-purple-600 dark:text-purple-500',
    },
    primary: {
      bg: 'bg-blue-600 dark:bg-blue-700',
      bgHover: 'hover:bg-blue-700 dark:hover:bg-blue-600',
      text: 'text-white',
    },
    secondary: {
      bg: 'bg-gray-100 dark:bg-gray-700',
      bgHover: 'hover:bg-gray-200 dark:hover:bg-gray-600',
      text: 'text-gray-700 dark:text-gray-200',
    },
  },

  // Component Patterns
  components: {
    // Status Badges
    statusBadge: {
      matched: {
        container: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30',
        text: 'text-xs font-bold text-green-700 dark:text-green-400',
        icon: 'w-3 h-3 text-green-600 dark:text-green-500',
      },
      unreconciled: {
        container: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30',
        text: 'text-xs font-bold text-orange-700 dark:text-orange-400',
        icon: 'w-3 h-3 text-orange-600 dark:text-orange-500',
      },
      discrepancy: {
        container: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30',
        text: 'text-xs font-bold text-red-700 dark:text-red-400',
        icon: 'w-3 h-3 text-red-600 dark:text-red-500',
      },
      pending: {
        container: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30',
        text: 'text-xs font-bold text-amber-700 dark:text-amber-400',
        icon: 'w-3 h-3 text-amber-600 dark:text-amber-500',
      },
    },

    // Buttons
    primaryButton: `
      inline-flex items-center justify-center gap-2
      px-4 py-2.5
      bg-blue-600 hover:bg-blue-700 active:scale-95
      text-white text-sm font-semibold
      rounded-lg
      transition-all duration-150
      disabled:opacity-50 disabled:cursor-not-allowed
      shadow-sm hover:shadow-md
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
    `,
    secondaryButton: `
      inline-flex items-center justify-center gap-2
      px-4 py-2.5
      bg-gray-100 dark:bg-gray-700
      hover:bg-gray-200 dark:hover:bg-gray-600
      text-gray-700 dark:text-gray-200
      text-sm font-semibold
      rounded-lg
      transition-colors duration-150
      disabled:opacity-50 disabled:cursor-not-allowed
      focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600
    `,

    // Cards
    card: `
      bg-white dark:bg-gray-800
      rounded-lg
      border border-gray-200 dark:border-gray-700
      shadow-sm hover:shadow-md
      transition-shadow
    `,

    // Inputs
    input: `
      w-full
      px-3 py-2
      border border-gray-300 dark:border-gray-600
      rounded-lg
      bg-white dark:bg-gray-700
      text-gray-900 dark:text-white
      placeholder-gray-500 dark:placeholder-gray-400
      transition-colors
      focus:outline-none
      focus:ring-2 focus:ring-blue-500 focus:border-blue-500
      focus:dark:ring-blue-400 focus:dark:border-blue-400
      disabled:bg-gray-100 dark:disabled:bg-gray-600
      disabled:cursor-not-allowed
    `,
  },

  // Layout Patterns
  layout: {
    pageContainer: `
      w-full max-w-7xl mx-auto
      px-4 sm:px-6 lg:px-8
      py-6 lg:py-8
    `,
    sectionHeader: `
      flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4
      pb-4 border-b border-gray-200 dark:border-gray-700
    `,
    twoColumn: `
      grid grid-cols-1 lg:grid-cols-4 gap-6
      lg:grid-cols-[1fr_300px]
    `,
    tableWrapper: `
      overflow-x-auto -mx-4 sm:mx-0
    `,
    table: `
      min-w-full
      text-sm
      border-collapse
    `,
  },
};
