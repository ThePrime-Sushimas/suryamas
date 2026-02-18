export const TableSkeleton = ({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-700">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="border px-4 py-2 dark:border-gray-600">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="border px-4 py-2 dark:border-gray-600">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const CardSkeleton = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-1/3" />
      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-2/3" />
      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-1/2" />
    </div>
  )
}

export const FormSkeleton = () => {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}>
          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-24 mb-2" />
          <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}
