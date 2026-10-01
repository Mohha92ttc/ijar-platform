import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'

// Types
export interface ThemeState {
  isDark: boolean
  primaryColor: string
  fontSize: 'small' | 'medium' | 'large'
}

export interface ThemeContextType {
  state: ThemeState
  toggleDarkMode: () => void
  setPrimaryColor: (color: string) => void
  setFontSize: (size: 'small' | 'medium' | 'large') => void
}

// Initial state
const initialState: ThemeState = {
  isDark: false,
  primaryColor: '#3B82F6',
  fontSize: 'medium'
}

// Action types
type ThemeAction =
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'SET_PRIMARY_COLOR'; payload: string }
  | { type: 'SET_FONT_SIZE'; payload: 'small' | 'medium' | 'large' }

// Reducer
const themeReducer = (state: ThemeState, action: ThemeAction): ThemeState => {
  switch (action.type) {
    case 'TOGGLE_DARK_MODE':
      return { ...state, isDark: !state.isDark }
    
    case 'SET_PRIMARY_COLOR':
      return { ...state, primaryColor: action.payload }
    
    case 'SET_FONT_SIZE':
      return { ...state, fontSize: action.payload }
    
    default:
      return state
  }
}

// Context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Provider
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(themeReducer, initialState)

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      try {
        const theme = JSON.parse(savedTheme)
        if (theme.isDark !== undefined) {
          dispatch({ type: 'TOGGLE_DARK_MODE' })
        }
        if (theme.primaryColor) {
          dispatch({ type: 'SET_PRIMARY_COLOR', payload: theme.primaryColor })
        }
        if (theme.fontSize) {
          dispatch({ type: 'SET_FONT_SIZE', payload: theme.fontSize })
        }
      } catch (error) {
        console.error('Failed to load theme:', error)
      }
    }
  }, [])

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('theme', JSON.stringify(state))
    
    // Apply theme to document
    if (state.isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // Apply primary color
    document.documentElement.style.setProperty('--primary-color', state.primaryColor)
    
    // Apply font size
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px'
    }
    document.documentElement.style.setProperty('--font-size', fontSizeMap[state.fontSize])
  }, [state])

  const toggleDarkMode = (): void => {
    dispatch({ type: 'TOGGLE_DARK_MODE' })
  }

  const setPrimaryColor = (color: string): void => {
    dispatch({ type: 'SET_PRIMARY_COLOR', payload: color })
  }

  const setFontSize = (size: 'small' | 'medium' | 'large'): void => {
    dispatch({ type: 'SET_FONT_SIZE', payload: size })
  }

  const value: ThemeContextType = {
    state,
    toggleDarkMode,
    setPrimaryColor,
    setFontSize
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// Hook
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
