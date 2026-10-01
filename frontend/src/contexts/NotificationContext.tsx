import React, { createContext, useContext, useReducer, ReactNode } from 'react'

// Types
export interface Notification {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  timestamp: Date
  read: boolean
}

export interface NotificationState {
  notifications: Notification[]
  unreadCount: number
}

export interface NotificationContextType {
  state: NotificationState
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotifications: () => void
}

// Initial state
const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0
}

// Action types
type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'CLEAR_NOTIFICATIONS' }

// Reducer
const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      const newNotifications = [action.payload, ...state.notifications]
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length
      }
    
    case 'MARK_AS_READ':
      const updatedNotifications = state.notifications.map(n =>
        n.id === action.payload ? { ...n, read: true } : n
      )
      return {
        notifications: updatedNotifications,
        unreadCount: updatedNotifications.filter(n => !n.read).length
      }
    
    case 'MARK_ALL_AS_READ':
      const allReadNotifications = state.notifications.map(n => ({ ...n, read: true }))
      return {
        notifications: allReadNotifications,
        unreadCount: 0
      }
    
    case 'CLEAR_NOTIFICATIONS':
      return {
        notifications: [],
        unreadCount: 0
      }
    
    default:
      return state
  }
}

// Context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// Provider
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState)

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    }
    
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: newNotification
    })
  }

  const markAsRead = (id: string): void => {
    dispatch({
      type: 'MARK_AS_READ',
      payload: id
    })
  }

  const markAllAsRead = (): void => {
    dispatch({ type: 'MARK_ALL_AS_READ' })
  }

  const clearNotifications = (): void => {
    dispatch({ type: 'CLEAR_NOTIFICATIONS' })
  }

  const value: NotificationContextType = {
    state,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

// Hook
export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
