import React, { useState, useEffect } from 'react'

interface Equipment {
  id: string
  name: string
  description: string
  category: string
  price: number
  location: string
  status: string
  owner: string
  createdAt: string
}

const EquipmentManagement: React.FC = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    // Mock data - would fetch from API
    const mockEquipment: Equipment[] = [
      {
        id: '1',
        name: 'حفار كهربائية',
        description: 'حفار قوي للبناء',
        category: 'construction',
        price: 150,
        location: 'بغداد',
        status: 'available',
        owner: 'مالك 1',
        createdAt: '2024-01-15'
      },
      {
        id: '2',
        name: 'مولد بناء',
        description: 'مولد قوي للمواقع',
        category: 'construction',
        price: 100,
        location: 'البصرة',
        status: 'rented',
        owner: 'مالك 2',
        createdAt: '2024-01-20'
      }
    ]
    setEquipment(mockEquipment)
    setIsLoading(false)
  }, [])

  const categories = ['all', 'construction', 'transportation', 'agriculture', 'industrial']

  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const toggleEquipmentStatus = (equipmentId: string) => {
    setEquipment(equipment.map(item =>
      item.id === equipmentId
        ? { ...item, status: item.status === 'available' ? 'unavailable' : 'available' }
        : item
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
        <h1 className="text-2xl font-semibold text-gray-900">إدارة المعدات</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          إضافة معدات جديدة
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="البحث عن معدات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'جميع الفئات' :
                 category === 'construction' ? 'إنشاءات' :
                 category === 'transportation' ? 'نقل' :
                 category === 'agriculture' ? 'زراعة' :
                 category === 'industrial' ? 'صناعي' : category}
              </option>
            ))}
          </select>
          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="text-sm text-gray-600">الإجمالي:</span>
            <span className="font-semibold">{filteredEquipment.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم المعدات
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الفئة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  السعر/يوم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الموقع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المالك
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEquipment.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.category === 'construction' ? 'bg-yellow-100 text-yellow-800' :
                      item.category === 'transportation' ? 'bg-blue-100 text-blue-800' :
                      item.category === 'agriculture' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.category === 'construction' ? 'إنشاءات' :
                       item.category === 'transportation' ? 'نقل' :
                       item.category === 'agriculture' ? 'زراعة' :
                       item.category === 'industrial' ? 'صناعي' : item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${item.price}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.status === 'available' ? 'bg-green-100 text-green-800' :
                      item.status === 'rented' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status === 'available' ? 'متاحة' :
                       item.status === 'rented' ? 'مؤجرة' : 'غير متاحة'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.owner}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2 space-x-reverse">
                      <button className="text-blue-600 hover:text-blue-900">
                        تعديل
                      </button>
                      <button
                        onClick={() => toggleEquipmentStatus(item.id)}
                        className={`${
                          item.status === 'available' ? 'text-red-600 hover:text-red-900' :
                          'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {item.status === 'available' ? 'تعطيل' : 'تفعيل'}
                      </button>
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

export default EquipmentManagement
