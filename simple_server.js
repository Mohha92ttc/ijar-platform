const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Simple server without complex compilation
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Basic routes for testing
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Ijar API is running',
    timestamp: new Date().toISOString()
  });
});

// Mock auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Mock authentication
  if (email === 'admin@ijar.iq' && password === 'admin123') {
    res.json({
      success: true,
      token: 'mock-admin-token',
      user: {
        id: 'admin-1',
        email: 'admin@ijar.iq',
        name: 'Admin User',
        role: 'admin'
      }
    });
  } else if (email === 'partner@example.com' && password === 'password123') {
    res.json({
      success: true,
      token: 'mock-partner-token',
      user: {
        id: 'partner-1',
        email: 'partner@example.com',
        name: 'Partner User',
        role: 'owner'
      }
    });
  } else if (email === 'customer@example.com' && password === 'password123') {
    res.json({
      success: true,
      token: 'mock-customer-token',
      user: {
        id: 'customer-1',
        email: 'customer@example.com',
        name: 'Customer User',
        role: 'customer'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Mock admin endpoints
app.get('/api/admin/dashboard', (req, res) => {
  res.json({
    totalUsers: 150,
    totalPartners: 25,
    totalEquipment: 500,
    totalBookings: 1200,
    totalRevenue: 50000000,
    growthRate: 15.5
  });
});

app.get('/api/admin/users', (req, res) => {
  res.json([
    { id: '1', name: 'Admin User', email: 'admin@ijar.iq', role: 'admin' },
    { id: '2', name: 'Partner User', email: 'partner@example.com', role: 'owner' },
    { id: '3', name: 'Customer User', email: 'customer@example.com', role: 'customer' }
  ]);
});

app.get('/api/admin/partners', (req, res) => {
  res.json([
    { id: '1', name: 'Partner 1', email: 'partner1@example.com', equipmentCount: 10 },
    { id: '2', name: 'Partner 2', email: 'partner2@example.com', equipmentCount: 15 }
  ]);
});

app.get('/api/admin/stats', (req, res) => {
  res.json({
    users: 150,
    partners: 25,
    equipment: 500,
    bookings: 1200,
    revenue: 50000000
  });
});

// Mock partner endpoints
app.get('/api/partner/dashboard', (req, res) => {
  res.json({
    totalEquipment: 10,
    activeBookings: 5,
    totalRevenue: 1000000,
    averageRating: 4.5
  });
});

app.get('/api/partner/equipment', (req, res) => {
  res.json([
    { id: '1', name: 'Excavator', category: 'معدات بناء', price: 50000, status: 'available' },
    { id: '2', name: 'Generator', category: 'مولدات', price: 25000, status: 'rented' }
  ]);
});

app.get('/api/partner/bookings', (req, res) => {
  res.json([
    { id: '1', equipmentName: 'Excavator', customerName: 'Customer 1', status: 'confirmed', totalAmount: 100000 },
    { id: '2', equipmentName: 'Generator', customerName: 'Customer 2', status: 'pending', totalAmount: 50000 }
  ]);
});

app.get('/api/partner/revenue', (req, res) => {
  res.json({
    totalRevenue: 1000000,
    monthlyRevenue: 100000,
    pendingRevenue: 25000
  });
});

// Mock customer endpoints
app.get('/api/customer/dashboard', (req, res) => {
  res.json({
    totalBookings: 5,
    activeBookings: 2,
    totalSpent: 200000,
    favoriteCategories: ['معدات بناء', 'مولدات']
  });
});

app.get('/api/equipment/search', (req, res) => {
  res.json([
    { id: '1', name: 'Excavator', category: 'معدات بناء', price: 50000, rating: 4.5, image: 'https://via.placeholder.com/300x200' },
    { id: '2', name: 'Generator', category: 'مولدات', price: 25000, rating: 4.2, image: 'https://via.placeholder.com/300x200' },
    { id: '3', name: 'Crane', category: 'معدات ثقيلة', price: 75000, rating: 4.8, image: 'https://via.placeholder.com/300x200' }
  ]);
});

app.get('/api/categories', (req, res) => {
  res.json([
    { id: '1', name: 'معدات بناء', description: 'معدات البناء والإنشاءات' },
    { id: '2', name: 'مولدات', description: 'مولدات الكهرباء ومعدات الطاقة' },
    { id: '3', name: 'معدات ثقيلة', description: 'معدات ثقيلة وآليات صناعية' }
  ]);
});

app.get('/api/customer/bookings', (req, res) => {
  res.json([
    { id: '1', equipmentName: 'Excavator', partnerName: 'Partner 1', status: 'confirmed', totalAmount: 100000 },
    { id: '2', equipmentName: 'Generator', partnerName: 'Partner 2', status: 'completed', totalAmount: 50000 }
  ]);
});

// Mock insurance endpoints
app.post('/api/insurance/policies', (req, res) => {
  res.json({
    id: 'policy-1',
    status: 'active',
    coverage: { damage: 80, theft: 90, liability: 70, delay: 50 },
    premium: 50000
  });
});

app.get('/api/insurance/policies', (req, res) => {
  res.json([
    { id: 'policy-1', type: 'basic', premium: 50000, status: 'active' },
    { id: 'policy-2', type: 'premium', premium: 75000, status: 'active' }
  ]);
});

// Mock support endpoints
app.post('/api/support/tickets', (req, res) => {
  res.json({
    id: 'ticket-1',
    status: 'open',
    category: 'technical',
    priority: 'medium'
  });
});

app.get('/api/support/tickets', (req, res) => {
  res.json([
    { id: 'ticket-1', subject: 'مشكلة في البحث', status: 'open', priority: 'medium' },
    { id: 'ticket-2', subject: 'استفسار عن الدفع', status: 'resolved', priority: 'low' }
  ]);
});

// Mock contract endpoints
app.post('/api/contracts', (req, res) => {
  res.json({
    id: 'contract-1',
    status: 'active',
    type: 'rental',
    totalAmount: 100000
  });
});

app.get('/api/contracts', (req, res) => {
  res.json([
    { id: 'contract-1', type: 'rental', status: 'active', totalAmount: 100000 },
    { id: 'contract-2', type: 'rental', status: 'completed', totalAmount: 75000 }
  ]);
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Simple Ijar Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/`);
  console.log(`🌐 Frontend available at http://localhost:${PORT}`);
  console.log('');
  console.log('👤 Test Users:');
  console.log('   Admin: admin@ijar.iq / admin123');
  console.log('   Partner: partner@example.com / password123');
  console.log('   Customer: customer@example.com / password123');
  console.log('');
});
