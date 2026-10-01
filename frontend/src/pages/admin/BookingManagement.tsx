import React, { useState, useEffect } from 'react'

interface Booking {
  id: string
  equipmentName: string
  renterName: string
  ownerName: string
  startDate: string
  endDate: string
  totalPrice: number
  status: string
  paymentStatus: string
  createdAt: string
}

const BookingManagement: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')

  useEffect(() => {
    // Mock data - would fetch from API
    const mockBookings: Booking[] = [
      {
        id: '1',
        equipmentName: 'حفار كهربائية',
        renterName: 'محمد أحمد',
        ownerName: 'أحمد علي',
        startDate: '2024-02-01',
        endDate: '2024-02-05',
        totalPrice: 600,
        status: 'active',
        paymentStatus: 'paid',
        createdAt: '2024-01-25'
      },
      {
        id: '2',
        equipmentName: 'مولد بناء',
        renterName: 'فاطمة محمد',
        ownerName: 'علي حسن',
        startDate: '2024-02-10',
        endDate: '2024-02-15',
        totalPrice: 500,
        status: 'completed',
        paymentStatus: 'paid',
        createdAt: '2024-02-05'
      }
    ]
    setBookings(mockBookings)
    setIsLoading(false)
  }, [])

  const statuses = ['all', 'pending', 'active', 'completed', 'cancelled']

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.renterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || booking.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const updateBookingStatus = (bookingId: string, newStatus: string) => {
    setBookings(bookings.map(booking =>
      booking.id === bookingId
        ? { ...booking, status: newStatus }
        : booking
    ))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">إدارة الحجوزات</h1>
        <div className="flex space-x-2 space-x-reverse">
          <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
            تصدير Excel
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            تقرير شهري
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input
            type="text"
            placeholder="البحث عن حجز..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statuses.map(status => (
              <option key={status} value={status}>
                {status === 'all' ? 'جميع الحالات' :
                 status === 'pending' ? 'في الانتظار' :
                 status === 'active' ? 'نشط' :
                 status === 'completed' ? 'مكتمل' :
                 status === 'cancelled' ? 'ملغي' : status}
              </option>
            ))}
          </select>
          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="text-sm text-gray-600">إجمالي الحجوزات:</span>
            <span className="font-semibold">{filteredBookings.length}</span>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="text-sm text-gray-600">إجمالي الإيرادات:</span>
            <span className="font-semibold text-green-600">
              ${filteredBookings.reduce((sum, booking) => sum + booking.totalPrice, 0)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المعدات
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المستأجر
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المالك
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الفترة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجمالي
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الدفع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {booking.equipmentName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {booking.renterName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {booking.ownerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <div>{booking.startDate}</div>
                      <div className="text-gray-400">إلى</div>
                      <div>{booking.endDate}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${booking.totalPrice}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      booking.status === 'active' ? 'bg-green-100 text-green-800' :
                      booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {booking.status === 'active' ? 'نشط' :
                       booking.status === 'completed' ? 'مكتمل' :
                       booking.status === 'pending' ? 'في الانتظار' :
                       booking.status === 'cancelled' ? 'ملغي' : booking.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                      booking.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {booking.paymentStatus === 'paid' ? 'مدفوع' :
                       booking.paymentStatus === 'pending' ? 'في الانتظار' :
                       'غير مدفوع'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2 space-x-reverse">
                      <button className="text-blue-600 hover:text-blue-900">
                        عرض التفاصيل
                      </button>
                      {booking.status === 'pending' && (
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'active')}
                          className="text-green-600 hover:text-green-900"
                        >
                          قبول
                        </button>
                      )}
                      {booking.status === 'active' && (
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'completed')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          إكمال
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default BookingManagement
