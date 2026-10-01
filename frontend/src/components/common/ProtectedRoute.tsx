import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'customer' | 'owner' | 'admin'
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole 
}) => {
  const { state } = useAuth()

  // Check if user is authenticated
  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Check role requirements
  if (requiredRole && state.user?.role !== requiredRole) {
    // Redirect based on user role
    switch (state.user?.role) {
      case 'admin':
        return <Navigate to="/admin" replace />
      case 'owner':
      case 'customer':
        return <Navigate to="/dashboard" replace />
      default:
        return <Navigate to="/login" replace />
    }
  }

  return <>{children}</>
}

export default ProtectedRoute
