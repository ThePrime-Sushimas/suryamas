import { useEffect, useMemo, useState } from 'react'
import { Bell, Save, Info } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePositions } from '../api/settings.api'
import {
  useNotificationRulesCatalog,
  useSaveNotificationRules,
  type NotificationRuleCatalogItem,
  type NotificationRuleDraft,
} from '@/features/notifications/api/notifications.api'

type DraftMap = Record<string, { position_id: string | null; is_active: boolean }>

function buildDraftFromCatalog(catalog: NotificationRuleCatalogItem[]): DraftMap {
  const map: DraftMap = {}
  for (const item of catalog) {
    map[item.event_key] = {
      position_id: item.rule?.position_id ?? null,
      is_active: item.rule?.is_active ?? false,
    }
  }
  return map
}

export default function NotificationRoutingPage() {
  const toast = useToast()
  const { data: catalog = [], isLoading } = useNotificationRulesCatalog()
  const positions = usePositions()
  const saveRules = useSaveNotificationRules()
  const [draft, setDraft] = useState<DraftMap>({})

  const catalogSnapshot = useMemo(
    () =>
      catalog
        .map(
          (c) =>
            `${c.event_key}:${c.rule?.position_id ?? ''}:${c.rule?.is_active ?? false}`
        )
        .join('|'),
    [catalog]
  )

  useEffect(() => {
    if (catalog.length > 0) {
      setDraft(buildDraftFromCatalog(catalog))
    }
  }, [catalogSnapshot, catalog])

  const positionOptions = positions.data ?? []

  const handleSave = async () => {
    const rules: NotificationRuleDraft[] = catalog.map((item) => {
      const d = draft[item.event_key] ?? { position_id: null, is_active: false }
      return {
        event_key: item.event_key,
        position_id: d.position_id,
        is_active: d.is_active && d.position_id != null,
      }
    })
    try {
      const saved = await saveRules.mutateAsync(rules)
      setDraft(buildDraftFromCatalog(saved))
      toast.success('Aturan notifikasi disimpan')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyimpan aturan notifikasi'))
    }
  }

  const updateDraft = (eventKey: string, patch: Partial<DraftMap[string]>) => {
    setDraft((prev) => {
      const current = prev[eventKey] ?? { position_id: null, is_active: false }
      return {
        ...prev,
        [eventKey]: { ...current, ...patch },
      }
    })
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-amber-500 rounded-2xl shadow-sm">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Routing Notifikasi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tentukan posisi/jabatan penerima untuk setiap event bisnis. Semua karyawan dengan posisi
            tersebut akan menerima notifikasi in-app.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveRules.isPending || isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors shrink-0"
        >
          <Save className="w-4 h-4" />
          Simpan
        </button>
      </div>

      <div className="flex gap-2 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-sm text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Aktifkan toggle setelah memilih posisi. Event seperti penolakan PR/PI juga mengirim ke
          pembuat dokumen secara otomatis (di luar aturan posisi).
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {catalog.map((item) => {
            const d = draft[item.event_key] ?? { position_id: null, is_active: false }
            const canActivate = d.position_id != null
            return (
              <div
                key={item.event_key}
                className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.label}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {item.description}
                    </p>
                    <code className="text-[10px] text-gray-400 mt-1 block">{item.event_key}</code>
                  </div>
                  <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                    <span className="text-xs text-gray-500">Aktif</span>
                    <input
                      type="checkbox"
                      checked={d.is_active && canActivate}
                      disabled={!canActivate}
                      onChange={(e) =>
                        updateDraft(item.event_key, { is_active: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                  </label>
                </div>

                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Posisi penerima
                </label>
                <select
                  value={d.position_id ?? ''}
                  onChange={(e) => {
                    const position_id = e.target.value || null
                    updateDraft(item.event_key, {
                      position_id,
                      is_active: position_id ? d.is_active : false,
                    })
                  }}
                  className="w-full h-10 px-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">— Pilih posisi —</option>
                  {positionOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.department_name} · {p.position_name}
                    </option>
                  ))}
                </select>

                <p className="text-[11px] text-gray-400 mt-2 line-clamp-2">
                  Preview: {item.default_message_template}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
