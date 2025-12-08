import { useEffect, useState } from 'react'
import { useEmployeeStore } from '../../stores/employeeStore'

export default function ProfilePage() {
  const { profile, fetchProfile, updateProfile, isLoading } = useEmployeeStore()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    mobile_phone: '',
    bank_name: '',
    bank_account: '',
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    if (profile) {
      setFormData({
        email: profile.email || '',
        mobile_phone: profile.mobile_phone || '',
        bank_name: profile.bank_name || '',
        bank_account: profile.bank_account || '',
      })
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateProfile(formData)
    setIsEditing(false)
  }

  if (isLoading && !profile) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!profile) {
    return <div className="text-center py-8">Profile not found</div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">My Profile</h1>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mobile Phone</label>
              <input
                type="text"
                value={formData.mobile_phone}
                onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bank Name</label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bank Account</label>
              <input
                type="text"
                value={formData.bank_account}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Employee ID</p>
                <p className="font-medium">{profile.employee_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">{profile.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Job Position</p>
                <p className="font-medium">{profile.job_position}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Branch</p>
                <p className="font-medium">{profile.branch_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{profile.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Mobile Phone</p>
                <p className="font-medium">{profile.mobile_phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bank Name</p>
                <p className="font-medium">{profile.bank_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bank Account</p>
                <p className="font-medium">{profile.bank_account || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium">{profile.status_employee}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Join Date</p>
                <p className="font-medium">{profile.join_date}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
