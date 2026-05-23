import api from '@/lib/axios'

export const userService = {
  async getAll() {
    const { data } = await api.get('/users')
    return data.data
  },

  async getById(userId: string) {
    const { data } = await api.get(`/users/${userId}`)
    return data.data
  },
}
