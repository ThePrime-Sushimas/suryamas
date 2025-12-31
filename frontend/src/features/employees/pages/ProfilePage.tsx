import { useEffect, useState, useCallback, useMemo } from 'react'
import { useEmployeeStore } from '@/features/employees'
import { useToast } from '@/contexts/ToastContext'
import { User, Mail, CreditCard, Briefcase, Settings } from 'lucide-react'

type FormData = {
  email: string
  mobile_phone: string
  citizen_id_address: string
  bank_name: string
  bank_account: string
  bank_account_holder: string
  birth_place: string
  birth_date: string
  nik: string
  gender: string
  religion: string
  marital_status: string
}

type TabId = 'personal' | 'contact' | 'employment' | 'banking' | 'system'

const TABS = [
  { id: 'personal' as TabId, label: 'Personal Info', icon: User },
  { id: 'contact' as TabId, label: 'Contact', icon: Mail },
  { id: 'employment' as TabId, label: 'Employment', icon: Briefcase },
  { id: 'banking' as TabId, label: 'Banking', icon: CreditCard },
  { id: 'system' as TabId, label: 'System', icon: Settings },
]

const GENDER_OPTIONS = ['Male', 'Female']
const RELIGION_OPTIONS = ['Islam', 'Christian', 'Catholic', 'Hindu', 'Buddha', 'Other']
const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widow']

export default function ProfilePage() {
  const { profile, fetchProfile, updateProfile, uploadProfilePicture, isLoading } = useEmployeeStore()
  const { success, error: toastError } = useToast()
  
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('personal')
  const [formData, setFormData] = useState<FormData>({
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

  // Init profile
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Sync form data with profile
  const initialFormData = useMemo(() => {
    if (!profile) return {
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
    }
    
    return {
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
    }
  }, [profile])

  useEffect(() => {
    setFormData(initialFormData)
  }, [initialFormData])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const updates: Record<string, unknown> = { ...formData }
      if (!updates.gender) delete updates.gender
      if (!updates.religion) delete updates.religion
      if (!updates.marital_status) delete updates.marital_status
      
      await updateProfile(updates)
      success('Profile updated successfully')
      setIsEditing(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile'
      toastError(message)
    }
  }, [formData, updateProfile, success, toastError])

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await uploadProfilePicture(file)
      await fetchProfile()
      success('Profile picture updated successfully')
    } catch (err: unknown) {
      const message = err instanceof Error && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'error' in err.response.data ? String(err.response.data.error) : err instanceof Error ? err.message : 'Failed to upload photo'
      toastError(message)
    }
  }, [uploadProfilePicture, fetchProfile, success, toastError])

  const handleCancel = useCallback(() => {
    if (isLoading) return // Prevent cancel during loading
    setIsEditing(false)
    setFormData(initialFormData)
  }, [isLoading, initialFormData])

  const profileInitial = useMemo(() => 
    profile?.full_name?.charAt(0).toUpperCase() || '?'
  , [profile])

  if (isLoading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Profile not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-blue-600 to-blue-700 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                {profile.profile_picture ? (
                  <img 
                    src={profile.profile_picture} 
                    alt="Profile" 
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg" 
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-blue-600 text-2xl font-bold shadow-lg">
                    {profileInitial}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{profile.full_name}</h1>
                  <p className="text-blue-100 mt-1">{profile.job_position}</p>
                  <label className="inline-block mt-2 text-sm text-white hover:text-blue-100 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isLoading}
                    />
                    📷 Change photo
                  </label>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-white text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <nav className="flex overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {activeTab === 'personal' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">NIK</label>
                      <input
                        type="text"
                        value={formData.nik}
                        onChange={(e) => setFormData(prev => ({ ...prev, nik: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Birth Date</label>
                      <input
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Birth Place</label>
                      <input
                        type="text"
                        value={formData.birth_place}
                        onChange={(e) => setFormData(prev => ({ ...prev, birth_place: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select</option>
                        {GENDER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Religion</label>
                      <select
                        value={formData.religion}
                        onChange={(e) => setFormData(prev => ({ ...prev, religion: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select</option>
                        {RELIGION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                      <select
                        value={formData.marital_status}
                        onChange={(e) => setFormData(prev => ({ ...prev, marital_status: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select</option>
                        {MARITAL_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'contact' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone</label>
                      <input
                        type="text"
                        value={formData.mobile_phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, mobile_phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address (KTP)</label>
                      <textarea
                        value={formData.citizen_id_address}
                        onChange={(e) => setFormData(prev => ({ ...prev, citizen_id_address: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'banking' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
                      <input
                        type="text"
                        value={formData.bank_account}
                        onChange={(e) => setFormData(prev => ({ ...prev, bank_account: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account Holder</label>
                      <input
                        type="text"
                        value={formData.bank_account_holder}
                        onChange={(e) => setFormData(prev => ({ ...prev, bank_account_holder: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {activeTab === 'personal' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="Employee ID" value={profile.employee_id} />
                    <InfoItem label="NIK" value={profile.nik} />
                    <InfoItem label="Birth Date" value={profile.birth_date ? new Date(profile.birth_date).toLocaleDateString('id-ID') : null} />
                    <InfoItem label="Birth Place" value={profile.birth_place} />
                    <InfoItem label="Age" value={profile.age} />
                    <InfoItem label="Gender" value={profile.gender} />
                    <InfoItem label="Religion" value={profile.religion} />
                    <InfoItem label="Marital Status" value={profile.marital_status} />
                  </div>
                )}

                {activeTab === 'contact' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="Email" value={profile.email} />
                    <InfoItem label="Mobile Phone" value={profile.mobile_phone} />
                    <div className="md:col-span-2">
                      <InfoItem label="Address (KTP)" value={profile.citizen_id_address} />
                    </div>
                  </div>
                )}

                {activeTab === 'employment' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="Job Position" value={profile.job_position} />
                    <InfoItem label="Branch" value={profile.branch_name} />
                    <InfoItem label="Brand Name" value={profile.brand_name} />
                    <InfoItem label="Status" value={profile.status_employee} />
                    <InfoItem label="PTKP Status" value={profile.ptkp_status} />
                    <InfoItem label="Join Date" value={new Date(profile.join_date).toLocaleDateString('id-ID')} />
                    <div className="md:col-span-2">
                      <InfoItem 
                        label="Years of Service" 
                        value={profile.years_of_service ? `${profile.years_of_service.years}y ${profile.years_of_service.months}m ${profile.years_of_service.days}d` : null} 
                      />
                    </div>
                    <InfoItem label="Resign Date" value={profile.resign_date ? new Date(profile.resign_date).toLocaleDateString('id-ID') : null} />
                    <InfoItem label="Contract Sign Date" value={profile.sign_date ? new Date(profile.sign_date).toLocaleDateString('id-ID') : null} />
                    <InfoItem label="Contract End Date" value={profile.end_date ? new Date(profile.end_date).toLocaleDateString('id-ID') : null} />
                  </div>
                )}

                {activeTab === 'banking' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="Bank Name" value={profile.bank_name} />
                    <InfoItem label="Bank Account" value={profile.bank_account} />
                    <div className="md:col-span-2">
                      <InfoItem label="Bank Account Holder" value={profile.bank_account_holder} />
                    </div>
                  </div>
                )}

                {activeTab === 'system' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="Created At" value={new Date(profile.created_at).toLocaleString('id-ID')} />
                    <InfoItem label="Updated At" value={new Date(profile.updated_at).toLocaleString('id-ID')} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="font-medium text-gray-900">{value || '-'}</p>
    </div>
  )
}
