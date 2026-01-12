import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ChevronDown, Eye, Edit, Trash2, Plus, MoreVertical } from 'lucide-react'
import type { ChartOfAccountTreeNode } from '../types/chart-of-account.types'
import { AccountTypeBadge } from './AccountTypeBadge'
import { buildAccountDisplayName } from '../utils/format'

interface ActionDropdownProps {
  node: ChartOfAccountTreeNode
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddChild?: (parentId: string) => void
  canEdit: boolean
  canDelete: boolean
  isOpen: boolean
  onToggle: () => void
}

const ActionDropdown = ({ 
  node, 
  onView, 
  onEdit, 
  onDelete, 
  onAddChild, 
  canEdit, 
  canDelete, 
  isOpen, 
  onToggle 
}: ActionDropdownProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.right - 192 + window.scrollX // 192px = w-48
      })
    }
  }, [isOpen])

  const dropdown = isOpen ? (
    <div 
      className="fixed w-48 bg-white rounded-md shadow-lg border z-50"
      style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
    >
      <div className="py-1">
        <button
          onClick={() => {
            onView(node.id)
            onToggle()
          }}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <Eye className="w-4 h-4" />
          View Details
        </button>
        {canEdit && (
          <button
            onClick={() => {
              onEdit(node.id)
              onToggle()
            }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        )}
        {onAddChild && node.is_header && (
          <button
            onClick={() => {
              onAddChild(node.id)
              onToggle()
            }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <Plus className="w-4 h-4" />
            Add Child Account
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => {
              onDelete(node.id)
              onToggle()
            }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {dropdown && createPortal(dropdown, document.body)}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={onToggle}
        />
      )}
    </>
  )
}

interface ChartOfAccountTreeProps {
  tree: ChartOfAccountTreeNode[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddChild?: (parentId: string) => void
  canEdit?: boolean
  canDelete?: boolean
}

interface TreeNodeProps {
  node: ChartOfAccountTreeNode
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddChild?: (parentId: string) => void
  canEdit?: boolean
  canDelete?: boolean
  level?: number
}

const TreeNode = ({ 
  node, 
  onView, 
  onEdit, 
  onDelete, 
  onAddChild, 
  canEdit = true, 
  canDelete = true,
  level = 0 
}: TreeNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [openDropdown, setOpenDropdown] = useState(false)
  const hasChildren = node.children && node.children.length > 0

  const handleToggleDropdown = useCallback(() => {
    setOpenDropdown(prev => !prev)
  }, [])

  return (
    <div>
      <div 
        className="group flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg"
        style={{ paddingLeft: `${level * 20 + 12}px` }}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="shrink-0 w-4 h-4 flex items-center justify-center"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
        </button>

        {/* Account Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className={`text-sm ${node.is_header ? 'font-bold' : ''} ${!node.is_postable ? 'italic' : ''}`}>
              {buildAccountDisplayName(node.account_code, node.account_name)}
            </div>
            <AccountTypeBadge type={node.account_type} />
            {node.account_subtype && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {node.account_subtype}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            {node.is_header && (
              <span className="text-xs text-blue-600 font-medium">Header</span>
            )}
            {node.is_postable && (
              <span className="text-xs text-green-600 font-medium">Postable</span>
            )}
            <span className="text-xs text-gray-500">{node.currency_code}</span>
            <span className={`text-xs font-medium ${
              node.is_active ? 'text-green-600' : 'text-red-600'
            }`}>
              {node.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <ActionDropdown 
          node={node}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          canEdit={canEdit}
          canDelete={canDelete}
          isOpen={openDropdown}
          onToggle={handleToggleDropdown}
        />
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children?.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              canEdit={canEdit}
              canDelete={canDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const ChartOfAccountTree = ({ 
  tree, 
  onView, 
  onEdit, 
  onDelete, 
  onAddChild, 
  canEdit = true, 
  canDelete = true 
}: ChartOfAccountTreeProps) => {
  if (tree.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
        No accounts found
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        {tree.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}
      </div>
    </div>
  )
}