import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface UserMenuProps {
  onLogout: () => void
}

const UserMenu: React.FC<UserMenuProps> = ({ onLogout }) => {
  const { state } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <span className="sr-only">فتح القائمة</span>
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
          {state.user?.name?.charAt(0) || 'U'}
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
              <div className="font-medium">{state.user?.name}</div>
              <div className="text-gray-500">{state.user?.email}</div>
              <div className="text-xs text-gray-400">
                {state.user?.role === 'admin' ? 'مدير' :
                 state.user?.role === 'owner' ? 'مالك' : 'عميل'}
              </div>
            </div>
            
            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false)
                  window.location.href = '/profile'
                }}
                className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                الملف الشخصي
              </button>
              
              <button
                onClick={() => {
                  setIsOpen(false)
                  window.location.href = '/settings'
                }}
                className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                الإعدادات
              </button>
              
              <hr className="my-1" />
              
              <button
                onClick={() => {
                  setIsOpen(false)
                  onLogout()
                }}
                className="block w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu
