import React from 'react'
import { Link } from 'react-router-dom'

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <p className="mt-2 text-lg text-gray-600">الصفحة غير موجودة</p>
        </div>
        
        <div className="space-y-4">
          <p className="text-gray-500">
            عذراً، الصفحة التي تبحث عنها غير موجودة.
          </p>
          
          <Link
            to="/dashboard"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            العودة إلى الرئيسية
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
