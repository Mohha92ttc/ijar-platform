import React, { useState, useRef, useEffect } from 'react'
import { useNotification } from '../../contexts/NotificationContext'

const NotificationBell: React.FC = () => {
  const { state } = useNotification()
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
        className="relative p-1 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118.14 14.158M6 10.5a2.5 2.5 0 110-5 0 2.5 2.5 0 010 5zm0 9.5a2.5 2.5 0 110-5 0 2.5 2.5 0 010 5z" />
        </svg>
        {state.unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
              الإشعارات ({state.unreadCount} غير مقروء)
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {state.notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  لا توجد إشعارات
                </div>
              ) : (
                state.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 border-b border-gray-100 ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${
                          notification.type === 'success' ? 'bg-green-100' :
                          notification.type === 'error' ? 'bg-red-100' :
                          notification.type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                        }`}>
                          <span className="text-sm font-medium">
                            {notification.type === 'success' ? '✓' :
                             notification.type === 'error' ? '✗' :
                             notification.type === 'warning' ? '!' : 'i'}
                          </span>
                        </div>
                      </div>
                      <div className="mr-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.timestamp).toLocaleString('ar-IQ')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
