import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const ThemeToggle: React.FC = () => {
  const { state, toggleDarkMode } = useTheme()

  return (
    <button
      onClick={toggleDarkMode}
      className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
      title={state.isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
    >
      {state.isDark ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012.707 12.707 9.003 9.003 0 00-12.707 0 9.003 9.003 0 00-12.707-12.707A3 3 0 0116.172 5.172l4 4c0 .143.04.281.08.418.08.717 0 1.415-.236 2.08-.587 2.586zm0-4.414A3 3 0 0116.172 2.828L12.343 8H4.657l-3.829 3.828A3 3 0 011.172 6.828l4-4z" />
        </svg>
      )}
    </button>
  )
}

export default ThemeToggle
