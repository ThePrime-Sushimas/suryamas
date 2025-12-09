import { useNavigate } from 'react-router-dom'

export default function FloatingActionButton() {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/employees/create')}
      className="md:hidden fixed bottom-20 right-4 bg-green-600 text-white w-14 h-14 rounded-full shadow-lg hover:bg-green-700 flex items-center justify-center z-20"
      aria-label="Add Employee"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  )
}
