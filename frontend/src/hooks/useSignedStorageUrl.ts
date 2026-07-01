import { useState, useEffect } from 'react'
import api from '@/lib/axios'

/**
 * Fetch a signed storage URL for a private file path.
 * Returns the resolved URL, or null while loading / on error / when disabled.
 * Pass-through when path is already an absolute http(s) URL.
 */
export function useSignedStorageUrl(
  path: string | null | undefined,
  bucket: string,
  enabled = true,
): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !path) {
      setUrl(null)
      return
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
      setUrl(path)
      return
    }

    let cancelled = false
    api
      .get('/storage/signed-url', { params: { path, bucket } })
      .then((res) => {
        if (!cancelled) setUrl(res.data?.data?.url ?? null)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [path, bucket, enabled])

  return url
}
