import axios, { AxiosError } from 'axios'
import { type DomainError } from './types'

export function normalizeError(err: unknown): DomainError {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<any>
    const status = e.response?.status ?? 0
    const backendMessage = e.response?.data?.error || e.message

    if (status === 0) {
      return { code: 'NETWORK_ERROR', message: 'Koneksi jaringan bermasalah', details: e.message }
    }
    if (status === 404) {
      return { code: 'NOT_FOUND', message: 'Data tidak ditemukan', details: backendMessage }
    }
    if (status === 400) {
      return { code: 'VALIDATION_ERROR', message: backendMessage || 'Data tidak valid', details: e.response?.data }
    }
    if (status === 409) {
      return { code: 'CONFLICT', message: backendMessage || 'Data sudah ada', details: e.response?.data }
    }
    if (status >= 500) {
      return { code: 'SERVER_ERROR', message: 'Terjadi masalah di server', details: backendMessage }
    }
    return { code: 'HTTP_ERROR', message: backendMessage || 'Permintaan gagal', details: e.response?.data }
  }

  return { code: 'UNKNOWN', message: 'Terjadi kesalahan tak terduga', details: String(err) }
}
