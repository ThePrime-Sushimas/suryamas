import api from '@/lib/axios'

/** R2 object path → short-lived signed URL (bucket: invoices). */
export async function getSignedStorageUrl(filePath: string, bucket = 'invoices'): Promise<string> {
  const { data } = await api.get('/storage/signed-url', {
    params: { path: filePath, bucket },
  })
  return data.data.url as string
}
