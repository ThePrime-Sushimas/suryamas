import { useEffect, useState } from 'react'
import { useEmployeeStore } from '../../stores/employeeStore'

export default function ProfilePage() {
  const { profile, fetchProfile, updateProfile, uploadProfilePicture, isLoading } = useEmployeeStore()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const [formData, setFormData] = useState<{
    email: string
    mobile_phone: string
    citizen_id_address: string
    bank_name: string
    bank_account: string
    bank_account_holder: string
    birth_place: string
    birth_date: string
    nik: string
    gender: 'Male' | 'Female' | ''
    religion: 'Islam' | 'Christian' | 'Catholic' | 'Hindu' | 'Buddha' | 'Other' | ''
    marital_status: 'Single' | 'Married' | 'Divorced' | 'Widow' | ''
  }>({
    email: '',
    mobile_phone: '',
    citizen_id_address: '',
    bank_name: '',
    bank_account: '',
    bank_account_holder: '',
    birth_place: '',
    birth_date: '',
    nik: '',
    gender: '',
    religion: '',
    marital_status: '',
  })

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'contact', label: 'Contact' },
    { id: 'employment', label: 'Employment' },
    { id: 'banking', label: 'Banking' },
    { id: 'system', label: 'System' },
  ]

  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    if (profile) {
      setFormData({
        email: profile.email || '',
        mobile_phone: profile.mobile_phone || '',
        citizen_id_address: profile.citizen_id_address || '',
        bank_name: profile.bank_name || '',
        bank_account: profile.bank_account || '',
        bank_account_holder: profile.bank_account_holder || '',
        birth_place: profile.birth_place || '',
        birth_date: profile.birth_date || '',
        nik: profile.nik || '',
        gender: profile.gender || '',
        religion: profile.religion || '',
        marital_status: profile.marital_status || '',
      })
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const updates: any = { ...formData }
    if (updates.gender === '') delete updates.gender
    if (updates.religion === '') delete updates.religion
    if (updates.marital_status === '') delete updates.marital_status
    await updateProfile(updates)
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
          <div className="flex items-center gap-4">
            {profile.profile_picture ? (
              <img src={profile.profile_picture} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xl font-bold">
                {profile.full_name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{profile.full_name}</h1>
              <label className="text-sm text-blue-600 hover:underline cursor-pointer">
                Change photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files?.[0]) {
                      try {
                        await uploadProfilePicture(e.target.files[0])
                        await fetchProfile()
                        alert('Profile picture updated successfully!')
                      } catch (error: any) {
                        alert(`Failed to upload: ${error.response?.data?.error || error.message}`)
                      }
                    }
                  }}
                />
              </label>
            </div>
          </div>
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-medium mb-4">Personal Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">NIK</label>
                  <input
                    type="text"
                    value={formData.nik}
                    onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Birth Date</label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Birth Place</label>
                  <input
                    type="text"
                    value={formData.birth_place}
                    onChange={(e) => setFormData({ ...formData, birth_place: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as '' | 'Male' | 'Female' })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Religion</label>
                  <select
                    value={formData.religion}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value as '' | 'Islam' | 'Christian' | 'Catholic' | 'Hindu' | 'Buddha' | 'Other' })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select</option>
                    <option value="Islam">Islam</option>
                    <option value="Christian">Christian</option>
                    <option value="Catholic">Catholic</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Marital Status</label>
                  <select
                    value={formData.marital_status}
                    onChange={(e) => setFormData({ ...formData, marital_status: e.target.value as '' | 'Single' | 'Married' | 'Divorced' | 'Widow' })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widow">Widow</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-medium mb-4">Contact</h3>
              <div className="grid grid-cols-2 gap-4">
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
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Address (KTP)</label>
                  <textarea
                    value={formData.citizen_id_address}
                    onChange={(e) => setFormData({ ...formData, citizen_id_address: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-medium mb-4">Banking</h3>
              <div className="grid grid-cols-2 gap-4">
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
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Bank Account Holder</label>
                  <input
                    type="text"
                    value={formData.bank_account_holder}
                    onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
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
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex space-x-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {activeTab === 'personal' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Employee ID</p>
                  <p className="font-medium">{profile.employee_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">NIK</p>
                  <p className="font-medium">{profile.nik || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Birth Date</p>
                  <p className="font-medium">{profile.birth_date ? new Date(profile.birth_date).toLocaleDateString('id-ID') : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Birth Place</p>
                  <p className="font-medium">{profile.birth_place || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Age</p>
                  <p className="font-medium">{profile.age || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-medium">{profile.gender || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Religion</p>
                  <p className="font-medium">{profile.religion || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Marital Status</p>
                  <p className="font-medium">{profile.marital_status || '-'}</p>
                </div>
                {/* <div>
                  <p className="text-sm text-gray-500">Profile Picture</p>
                  {profile.profile_picture ? (
                    <img src={profile.profile_picture} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <p className="font-medium">No picture</p>
                  )}
                </div> */}
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{profile.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Mobile Phone</p>
                  <p className="font-medium">{profile.mobile_phone || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Address (KTP)</p>
                  <p className="font-medium">{profile.citizen_id_address || '-'}</p>
                </div>
              </div>
            )}

            {activeTab === 'employment' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Job Position</p>
                  <p className="font-medium">{profile.job_position}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branch</p>
                  <p className="font-medium">{profile.branch_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Parent Branch</p>
                  <p className="font-medium">{profile.parent_branch_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">{profile.status_employee}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">PTKP Status</p>
                  <p className="font-medium">{profile.ptkp_status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Join Date</p>
                  <p className="font-medium">{new Date(profile.join_date).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Years of Service</p>
                  <p className="font-medium">
                    {profile.years_of_service ? `${profile.years_of_service.years} years ${profile.years_of_service.months} months ${profile.years_of_service.days} days` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Resign Date</p>
                  <p className="font-medium">{profile.resign_date ? new Date(profile.resign_date).toLocaleDateString('id-ID') : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contract Sign Date</p>
                  <p className="font-medium">{profile.sign_date ? new Date(profile.sign_date).toLocaleDateString('id-ID') : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contract End Date</p>
                  <p className="font-medium">{profile.end_date ? new Date(profile.end_date).toLocaleDateString('id-ID') : '-'}</p>
                </div>
              </div>
            )}

            {activeTab === 'banking' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Bank Name</p>
                  <p className="font-medium">{profile.bank_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Bank Account</p>
                  <p className="font-medium">{profile.bank_account || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Bank Account Holder</p>
                  <p className="font-medium">{profile.bank_account_holder || '-'}</p>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Created At</p>
                  <p className="font-medium">{new Date(profile.created_at).toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Updated At</p>
                  <p className="font-medium">{new Date(profile.updated_at).toLocaleString('id-ID')}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
