/** Soft pink theme for AP Payments (finance planning UI) */
export const apTheme = {
  page: 'min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/95 to-fuchsia-50/80 dark:from-[#1a1014] dark:via-rose-950/95 dark:to-pink-950/90',
  pagePb: 'pb-12',
  pageHScreen: 'h-screen flex flex-col bg-gradient-to-br from-rose-50 via-pink-50/95 to-fuchsia-50/80 dark:from-[#1a1014] dark:via-rose-950/95 dark:to-pink-950/90',
  decorWrap: 'relative',
  decorBlob1:
    'pointer-events-none absolute -top-28 -right-28 h-80 w-80 rounded-full bg-pink-200/45 blur-3xl dark:bg-pink-500/10',
  decorBlob2:
    'pointer-events-none absolute top-48 -left-24 h-64 w-64 rounded-full bg-rose-200/50 blur-3xl dark:bg-rose-500/10',
  content: 'relative z-10',

  header:
    'bg-white/80 dark:bg-rose-950/75 backdrop-blur-md border-b border-rose-100/90 dark:border-rose-800/70',
  headerSticky: 'sticky top-0 z-10',
  headerIcon:
    'p-2.5 rounded-2xl bg-gradient-to-br from-rose-100 via-pink-100 to-fuchsia-100 text-rose-500 dark:from-rose-900/50 dark:to-pink-900/40 dark:text-pink-300 shadow-sm shadow-rose-100/80',
  title: 'text-xl font-bold text-rose-950 dark:text-rose-50',
  titleSm: 'text-lg font-semibold text-rose-950 dark:text-rose-50',
  subtitle: 'text-sm text-rose-600/75 dark:text-rose-300/70',

  card: 'rounded-2xl border border-rose-100/90 dark:border-rose-800/55 bg-white/90 dark:bg-rose-950/40 shadow-sm shadow-rose-100/50 dark:shadow-none backdrop-blur-sm',
  cardOverflow: 'rounded-2xl border border-rose-100/90 dark:border-rose-800/55 bg-white/90 dark:bg-rose-950/40 shadow-sm shadow-rose-100/50 overflow-hidden backdrop-blur-sm',
  cardInner:
    'rounded-2xl bg-rose-50/55 dark:bg-rose-900/25 border border-rose-100/70 dark:border-rose-800/45',
  cardInnerDashed:
    'rounded-2xl border border-dashed border-rose-200 dark:border-rose-700 hover:bg-rose-50/60 dark:hover:bg-rose-900/25',

  sectionTitle: 'text-sm font-semibold text-rose-950 dark:text-rose-50',
  body: 'text-gray-800 dark:text-rose-100/90',
  muted: 'text-rose-600/70 dark:text-rose-300/60',
  label: 'text-xs text-rose-600/80 dark:text-rose-300/70',

  btnPrimary:
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-white text-sm font-medium hover:from-rose-500 hover:to-pink-600 shadow-sm shadow-rose-200/70 transition-all disabled:opacity-50',
  btnPrimaryLg:
    'inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-white font-medium hover:from-rose-500 hover:to-pink-600 shadow-sm shadow-rose-200/70 disabled:opacity-50',
  btnSecondary:
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-700 text-rose-800 dark:text-rose-100 text-sm font-medium hover:bg-rose-50/80 dark:hover:bg-rose-900/35 transition-colors disabled:opacity-50',
  btnGhost: 'p-2 rounded-2xl hover:bg-rose-100/80 dark:hover:bg-rose-900/40 transition-colors',
  btnIcon: 'p-2 rounded-xl border border-rose-200 dark:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/35',

  input:
    'w-full px-3 py-2.5 rounded-2xl border border-rose-200/90 dark:border-rose-700 bg-white/95 dark:bg-rose-950/50 text-sm text-rose-950 dark:text-rose-50 placeholder:text-rose-300/80',
  inputSearch:
    'w-full pl-9 pr-9 py-2.5 rounded-2xl border border-rose-200/90 dark:border-rose-700 bg-white/95 dark:bg-rose-950/50 text-sm text-rose-950 dark:text-rose-50',
  select:
    'px-3 py-2.5 rounded-2xl border border-rose-200/90 dark:border-rose-700 bg-white/95 dark:bg-rose-950/50 text-sm text-rose-950 dark:text-rose-50',

  tabsWrap: 'flex flex-wrap gap-2 p-1 rounded-2xl bg-rose-100/70 dark:bg-rose-900/45 w-fit',
  tabActive:
    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-rose-800/80 text-rose-700 dark:text-rose-100 shadow-sm shadow-rose-100/50',
  tabInactive:
    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-rose-600/80 dark:text-rose-300/70 hover:text-rose-800 dark:hover:text-rose-100 transition-colors',

  pillActive:
    'px-3 py-1.5 rounded-xl text-xs font-medium bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm',
  pillInactive: 'px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-300/80',
  pillBorderWrap: 'inline-flex rounded-2xl border border-rose-200 dark:border-rose-700 p-0.5 bg-white/50 dark:bg-rose-950/30',

  spinner: 'text-rose-500',
  divide: 'divide-rose-100 dark:divide-rose-800/50',
  divideBorder: 'border-rose-100 dark:border-rose-800/50',
  hoverRow: 'hover:bg-rose-50/70 dark:hover:bg-rose-900/25 transition-colors',

  metricDefault:
    'border-rose-100/90 dark:border-rose-800/55 bg-white/90 dark:bg-rose-950/40 shadow-sm shadow-rose-50/60',
  metricWarn:
    'border-amber-200/90 dark:border-amber-800/50 bg-amber-50/75 dark:bg-amber-900/15',
  metricOk:
    'border-pink-200 dark:border-pink-800/50 bg-pink-50/85 dark:bg-pink-900/20',
  metricMuted:
    'border-rose-100 dark:border-rose-800/50 bg-rose-50/50 dark:bg-rose-900/20',

  badgeReady:
    'inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/35 dark:text-pink-200',
  badgePending:
    'inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',

  groupOverdue:
    'border-amber-200/90 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-900/15',
  groupToday:
    'border-pink-300 dark:border-pink-700 bg-pink-50/90 dark:bg-pink-900/25 ring-1 ring-pink-200/80 dark:ring-pink-800/50',
  groupDefault:
    'border-rose-100 dark:border-rose-800/55 bg-white/85 dark:bg-rose-950/35',
  groupMuted:
    'border-rose-100 dark:border-rose-800/50 bg-rose-50/45 dark:bg-rose-900/20',

  calToday:
    'border-pink-400 dark:border-pink-600 bg-pink-50/95 dark:bg-pink-900/30 ring-1 ring-pink-200 dark:ring-pink-800',
  calOverdue:
    'border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-900/25',
  calPast:
    'border-rose-100 dark:border-rose-800/50 bg-rose-50/40 dark:bg-rose-900/20',
  calFuture:
    'border-rose-100 dark:border-rose-800/55 bg-white/90 dark:bg-rose-950/35 hover:border-pink-200 dark:hover:border-pink-700',

  modal:
    'bg-white/95 dark:bg-rose-950/95 rounded-2xl shadow-xl shadow-rose-200/40 w-full border border-rose-100 dark:border-rose-800 backdrop-blur-sm',
  modalOverlay: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-950/25 backdrop-blur-sm',
  drawerPanel:
    'relative w-full max-w-lg h-full bg-white/98 dark:bg-rose-950/98 shadow-xl shadow-rose-200/30 flex flex-col border-l border-rose-100 dark:border-rose-800',
  drawerOverlay: 'absolute inset-0 bg-rose-950/30 backdrop-blur-sm',

  uploadZone:
    'flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-rose-200 dark:border-rose-700 cursor-pointer hover:border-pink-400 hover:bg-pink-50/60 dark:hover:bg-pink-900/15 transition-colors',

  listCard:
    'w-full text-left p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800 hover:border-pink-300 dark:hover:border-pink-600 hover:shadow-md hover:shadow-rose-100/50 transition-all',
  skeleton:
    'h-20 rounded-2xl bg-white/80 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800 animate-pulse',

  footerBar:
    'fixed bottom-0 left-0 right-0 border-t border-rose-100 dark:border-rose-800 bg-white/90 dark:bg-rose-950/90 backdrop-blur-md p-4',
} as const
