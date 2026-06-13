/**
 * AP Payments theme
 * Light: cream base + visible soft pink accents (not washed out, not neon)
 * Dark: standard app (neutral/blue like other modules)
 */
export const apTheme = {
  page:
    'min-h-screen bg-gradient-to-br from-rose-50/70 via-[#faf4f0] to-pink-50/55 dark:bg-gray-900 dark:bg-none',
  pagePb: 'pb-12',
  pageHScreen:
    'h-screen flex flex-col bg-gradient-to-br from-rose-50/70 via-[#faf4f0] to-pink-50/55 dark:bg-gray-900 dark:bg-none',
  decorWrap: 'relative',
  decorBlob1:
    'pointer-events-none absolute -top-28 -right-28 h-80 w-80 rounded-full bg-pink-200/35 blur-3xl dark:hidden',
  decorBlob2:
    'pointer-events-none absolute top-48 -left-24 h-64 w-64 rounded-full bg-rose-200/30 blur-3xl dark:hidden',
  content: 'relative z-10',

  /** Permukaan utama — warm pink-cream, bukan putih (#fff) */
  surface: 'bg-[#fef8f6] dark:bg-gray-800',
  surfaceMuted: 'bg-[#fdf0f4] dark:bg-gray-800/60',
  surfaceAccent: 'bg-rose-100/55 dark:bg-gray-900/40',

  header:
    'bg-[#fff9f7]/94 dark:bg-gray-800 backdrop-blur-md border-b border-rose-200/80 dark:border-gray-700',
  headerSticky: 'sticky top-0 z-10',
  headerIcon:
    'p-2.5 rounded-2xl bg-gradient-to-br from-rose-100 via-pink-50 to-rose-50 text-rose-500 shadow-sm shadow-rose-200/50 dark:bg-blue-900/40 dark:from-transparent dark:via-transparent dark:to-transparent dark:text-blue-400 dark:shadow-none',
  title: 'text-xl font-bold text-rose-950 dark:text-white',
  titleSm: 'text-lg font-semibold text-rose-950 dark:text-white',
  subtitle: 'text-sm text-rose-700/75 dark:text-gray-400',

  card:
    'rounded-2xl border-2 border-rose-300/90 dark:border-gray-600 bg-[#fef8f6] dark:bg-gray-800 shadow-md shadow-rose-200/40 dark:shadow-lg dark:shadow-black/20',
  cardOverflow:
    'rounded-2xl border-2 border-rose-300/90 dark:border-gray-600 bg-[#fef8f6] dark:bg-gray-800 shadow-md shadow-rose-200/40 dark:shadow-lg dark:shadow-black/20 overflow-hidden',
  /** Area grid kalender — satu tingkat lebih gelap dari kartu, masih soft */
  cardInset:
    'rounded-xl border border-rose-200 bg-[#fceef3]/80 dark:bg-gray-900/40 dark:border-gray-600 p-3 sm:p-4',
  cardInner:
    'rounded-2xl bg-rose-50/55 dark:bg-gray-900/50 border border-rose-100/90 dark:border-gray-700',
  cardInnerDashed:
    'rounded-2xl border border-dashed border-rose-300/70 dark:border-gray-600 hover:bg-rose-50/70 dark:hover:bg-gray-700/30',

  sectionTitle: 'text-sm font-semibold text-rose-950 dark:text-white',
  body: 'text-rose-950/85 dark:text-gray-200',
  muted: 'text-rose-700/65 dark:text-gray-400',
  label: 'text-xs text-rose-600/80 dark:text-gray-400',

  btnPrimary:
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-white text-sm font-medium hover:from-rose-500 hover:to-pink-600 shadow-sm shadow-rose-200/50 transition-all disabled:opacity-50 dark:bg-blue-600 dark:from-blue-600 dark:to-blue-600 dark:hover:bg-blue-700 dark:shadow-none',
  btnPrimaryLg:
    'inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-white font-medium hover:from-rose-500 hover:to-pink-600 shadow-sm shadow-rose-200/50 disabled:opacity-50 dark:bg-blue-600 dark:from-blue-600 dark:to-blue-600 dark:hover:bg-blue-700 dark:shadow-none',
  btnSecondary:
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-gray-600 text-rose-800 dark:text-gray-200 text-sm font-medium hover:bg-rose-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50',
  btnGhost: 'p-2 rounded-2xl hover:bg-rose-100/80 dark:hover:bg-gray-700 transition-colors',
  btnIcon:
    'p-2 rounded-xl border border-rose-200 dark:border-gray-600 hover:bg-rose-50 dark:hover:bg-gray-700',

  input:
    'w-full px-3 py-2.5 rounded-2xl border border-rose-200/90 dark:border-gray-600 bg-[#fff9f7] dark:bg-gray-700 text-sm text-rose-950 dark:text-white placeholder:text-rose-300/90 dark:placeholder:text-gray-500',
  inputSearch:
    'w-full pl-9 pr-9 py-2.5 rounded-2xl border border-rose-200/90 dark:border-gray-600 bg-[#fff9f7] dark:bg-gray-700 text-sm text-rose-950 dark:text-white',
  select:
    'px-3 py-2.5 rounded-2xl border border-rose-200/90 dark:border-gray-600 bg-[#fff9f7] dark:bg-gray-700 text-sm text-rose-950 dark:text-white',

  tabsWrap: 'flex flex-wrap gap-2 p-1 rounded-2xl bg-rose-100/65 dark:bg-gray-800/80 w-fit',
  tabActive:
    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#fff9f7] dark:bg-gray-700 text-rose-700 dark:text-white shadow-sm shadow-rose-100/50 dark:shadow-none ring-1 ring-rose-200/80',
  tabInactive:
    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-rose-600/75 dark:text-gray-400 hover:text-rose-800 dark:hover:text-white transition-colors',

  pillActive:
    'px-3 py-1.5 rounded-xl text-xs font-medium bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-sm dark:bg-gray-900 dark:from-gray-900 dark:to-gray-900 dark:text-white',
  pillInactive: 'px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600/80 dark:text-gray-400',
  pillBorderWrap:
    'inline-flex rounded-2xl border border-rose-200 dark:border-gray-600 p-0.5 bg-rose-50/50 dark:bg-transparent',

  spinner: 'text-rose-500 dark:text-blue-600',
  divide: 'divide-rose-100 dark:divide-gray-700',
  divideBorder: 'border-rose-200 dark:border-gray-600',
  hoverRow: 'hover:bg-rose-50/80 dark:hover:bg-gray-700/30 transition-colors',

  metricDefault:
    'border-2 border-rose-300/90 dark:border-gray-600 bg-[#fef8f6] dark:bg-gray-800 shadow-md shadow-rose-200/35 dark:shadow-none',
  metricWarn:
    'border-2 border-amber-300 dark:border-amber-700 bg-amber-50/75 dark:bg-amber-900/20 shadow-sm',
  metricOk:
    'border-2 border-rose-300 dark:border-emerald-700 bg-rose-100/45 dark:bg-emerald-900/20 shadow-sm',
  metricMuted:
    'border-2 border-rose-200 dark:border-gray-600 bg-[#fdf0f4] dark:bg-gray-800/50 shadow-sm',

  badgeReady:
    'inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-pink-100 text-pink-700 border border-pink-200/80 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-transparent',
  badgePending:
    'inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-rose-100 text-rose-700 border border-rose-200/80 dark:bg-blue-900/30 dark:text-blue-300 dark:border-transparent',

  groupOverdue:
    'border-amber-200 dark:border-amber-700 bg-amber-50/65 dark:bg-amber-900/20',
  groupToday:
    'border-rose-300/90 dark:border-blue-700 bg-rose-50/80 dark:bg-blue-900/20 ring-1 ring-rose-200 dark:ring-blue-800',
  groupDefault: 'border-2 border-rose-200 dark:border-gray-600 bg-[#fef8f6] dark:bg-gray-800',
  groupMuted: 'border-2 border-rose-200/90 dark:border-gray-600 bg-[#fdf0f4] dark:bg-gray-800/50',

  groupTitleOverdue: 'text-amber-800 dark:text-amber-200',
  groupTitleToday: 'text-rose-800 dark:text-blue-200',
  groupTitleDefault: 'text-rose-950 dark:text-white',

  calToday:
    'border-2 border-rose-400 dark:border-blue-500 bg-rose-100/70 dark:bg-blue-900/30 ring-1 ring-rose-300/60 dark:ring-blue-700',
  calOverdue:
    'border-2 border-amber-400/90 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-900/30',
  calPast:
    'border-2 border-rose-200 dark:border-gray-600 bg-[#faf0f4] dark:bg-gray-800/60',
  calFuture:
    'border-2 border-rose-300 dark:border-gray-600 bg-[#fdf2f6] dark:bg-gray-800 hover:border-rose-400 hover:bg-rose-50/80 dark:hover:border-gray-500',
  calOutsideMonth:
    'border-2 border-rose-100/60 dark:border-gray-700/50 bg-rose-50/20 dark:bg-gray-900/20',
  calDayLabelToday: 'text-rose-700 dark:text-blue-300',
  calDayLabel: 'text-rose-600/70 dark:text-gray-500',
  calDayNumToday: 'text-rose-800 dark:text-blue-200',
  calDayNum: 'text-rose-950 dark:text-white',

  modal:
    'bg-[#fff9f7] dark:bg-gray-800 rounded-2xl shadow-xl shadow-rose-200/35 dark:shadow-none w-full border border-rose-200/85 dark:border-gray-700',
  modalOverlay:
    'fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-900/12 dark:bg-black/50 backdrop-blur-sm',
  drawerPanel:
    'relative w-full max-w-lg h-full bg-[#fff9f7] dark:bg-gray-800 shadow-xl shadow-rose-200/25 dark:shadow-none flex flex-col border-l border-rose-200/85 dark:border-gray-700',
  drawerOverlay: 'absolute inset-0 bg-rose-900/10 dark:bg-black/40 backdrop-blur-sm',

  uploadZone:
    'flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-rose-300/80 dark:border-gray-600 cursor-pointer hover:border-rose-400 hover:bg-rose-50/70 dark:hover:border-blue-400 dark:hover:bg-blue-900/10 transition-colors',

  listCard:
    'w-full text-left p-4 sm:p-5 rounded-2xl bg-[#fff9f7] dark:bg-gray-800 border border-rose-200/85 dark:border-gray-700 hover:border-rose-300 dark:hover:border-blue-600 hover:shadow-md hover:shadow-rose-100/45 dark:hover:shadow-sm transition-all',
  skeleton:
    'h-20 rounded-2xl bg-rose-50/60 dark:bg-gray-800 border border-rose-100 dark:border-gray-700 animate-pulse',

  footerBar:
    'fixed bottom-0 left-0 right-0 border-t border-rose-200/85 dark:border-gray-700 bg-[#fff9f7]/95 dark:bg-gray-800 backdrop-blur-md p-4',

  link: 'text-rose-600 dark:text-blue-400 hover:underline',
  btnApprove:
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-white text-sm font-medium hover:from-rose-500 hover:to-pink-600 shadow-sm shadow-rose-200/40 dark:bg-indigo-600 dark:from-indigo-600 dark:to-indigo-600 dark:hover:bg-indigo-700 dark:shadow-none',
  btnPay:
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-white text-sm font-medium hover:from-rose-500 hover:to-pink-600 shadow-sm disabled:opacity-50 dark:bg-emerald-600 dark:from-emerald-600 dark:to-emerald-600 dark:hover:bg-emerald-700 dark:shadow-none',
  listTabActive:
    'px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-sm shadow-rose-200/40 dark:bg-blue-600 dark:from-blue-600 dark:to-blue-600',
  listTabInactive:
    'px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap text-rose-600/80 dark:text-gray-400 hover:bg-rose-100/70 dark:hover:bg-gray-700',
} as const
