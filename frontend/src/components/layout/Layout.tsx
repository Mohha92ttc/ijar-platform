import React, { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotification } from '../../contexts/NotificationContext'
import { useTheme } from '../../contexts/ThemeContext'
import NotificationBell from '../common/NotificationBell'
import ThemeToggle from '../common/ThemeToggle'
import UserMenu from '../common/UserMenu'

const Layout: React.FC = () => {
  const { state: authState, logout } = useAuth()
  const { state: notificationState } = useNotification()
  const { state: themeState } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navigation = [
    { name: 'لوحة التحكم', href: '/dashboard', icon: '🏠' },
    { name: 'المعدات', href: '/equipment', icon: '🔧' },
    { name: 'الحجوزات', href: '/bookings', icon: '📅' },
    { name: 'المدفوعات', href: '/payments', icon: '💳' },
    { name: 'الملف الشخصي', href: '/profile', icon: '👤' }
  ]

  const adminNavigation = [
    { name: 'لوحة الإدارة', href: '/admin', icon: '⚙️' },
    { name: 'المستخدمين', href: '/admin/users', icon: '👥' },
    { name: 'المعدات', href: '/admin/equipment', icon: '🔧' },
    { name: 'الحجوزات', href: '/admin/bookings', icon: '📅' },
    { name: 'المدفوعات', href: '/admin/payments', icon: '💳' },
    { name: 'التقارير', href: '/admin/reports', icon: '📊' }
  ]

  const currentNavigation = authState.user?.role === 'admin' ? adminNavigation : navigation

  return (
    <div className={`min-h-screen bg-gray-50 ${themeState.isDark ? 'dark' : ''}`}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Mobile Menu Button */}
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <Link to="/dashboard" className="flex items-center mr-8">
                <span className="text-xl font-bold text-blue-600">إيجار</span>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-8 space-x-reverse">
              {currentNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                    location.pathname === item.href
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="ml-2">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Right side items */}
            <div className="flex items-center space-x-4 space-x-reverse">
              <NotificationBell />
              <ThemeToggle />
              <UserMenu onLogout={handleLogout} />
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar for mobile */}
      {sidebarOpen && (
        <div className="md:hidden">
          <div className="fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                >
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                <nav className="mt-5 px-2 space-y-1">
                  {currentNavigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                        location.pathname === item.href
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="ml-3">{item.icon}</span>
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}

export default Layout
