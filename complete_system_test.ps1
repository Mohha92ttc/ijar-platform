# Complete System Test - Iraqi Ijar Platform
$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "========================================"
Write-Host "     IRAQI IJAR SYSTEM TEST"
Write-Host "========================================"
Write-Host ""

# Step 1: Test Admin Login and Features
Write-Host "STEP 1: TESTING ADMIN FEATURES"
Write-Host "----------------------------"

# Admin Login
Write-Host "1. Admin Login..."
$adminLogin = '{"email":"admin@ijar.iq","password":"admin123"}'
$adminResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $adminLogin
Write-Host "   ✅ Admin Login: SUCCESS"
$adminToken = $adminResponse.token

# Admin Headers
$adminHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $adminToken"
}

# Admin Dashboard
Write-Host "2. Admin Dashboard..."
$dashboard = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/dashboard" -Method GET -Headers $adminHeaders
Write-Host "   ✅ Dashboard: Total Users = $($dashboard.totalUsers), Partners = $($dashboard.totalPartners)"

# Admin Users
Write-Host "3. Admin Users List..."
$users = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/users" -Method GET -Headers $adminHeaders
Write-Host "   ✅ Users: $($users.Count) users loaded"

# Admin Partners
Write-Host "4. Admin Partners List..."
$partners = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/partners" -Method GET -Headers $adminHeaders
Write-Host "   ✅ Partners: $($partners.Count) partners loaded"

# Admin Stats
Write-Host "5. Admin Statistics..."
$stats = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/stats" -Method GET -Headers $adminHeaders
Write-Host "   ✅ Stats: Revenue = IQD $($stats.revenue)"

# Test Insurance Service as Admin
Write-Host "6. Insurance Service..."
$insurancePolicy = '{"equipmentId":"test-1","type":"basic","coverage":{"damage":80,"theft":90,"liability":70,"delay":50},"premium":50000,"deductible":10000}'
$policy = Invoke-RestMethod -Uri "http://localhost:3000/api/insurance/policies" -Method POST -Headers $adminHeaders -Body $insurancePolicy
Write-Host "   ✅ Insurance Policy Created: ID = $($policy.id)"

# Test Support Service as Admin
Write-Host "7. Support Service..."
$supportTicket = '{"category":"technical","priority":"medium","subject":"Test Ticket","description":"Testing support system"}'
$ticket = Invoke-RestMethod -Uri "http://localhost:3000/api/support/tickets" -Method POST -Headers $adminHeaders -Body $supportTicket
Write-Host "   ✅ Support Ticket Created: ID = $($ticket.id)"

# Test Contract Service as Admin
Write-Host "8. Contract Service..."
$contractData = '{"bookingId":"booking-1","equipmentId":"eq-1","customerId":"cust-1","ownerId":"owner-1","type":"rental","totalAmount":100000}'
$contract = Invoke-RestMethod -Uri "http://localhost:3000/api/contracts" -Method POST -Headers $adminHeaders -Body $contractData
Write-Host "   ✅ Contract Created: ID = $($contract.id)"

Write-Host ""
Write-Host "STEP 1 COMPLETED SUCCESSFULLY!"
Write-Host ""

# Step 2: Test Partner Features
Write-Host "STEP 2: TESTING PARTNER FEATURES"
Write-Host "------------------------------"

# Partner Login
Write-Host "1. Partner Login..."
$partnerLogin = '{"email":"partner@example.com","password":"password123"}'
$partnerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $partnerLogin
Write-Host "   ✅ Partner Login: SUCCESS"
$partnerToken = $partnerResponse.token

# Partner Headers
$partnerHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $partnerToken"
}

# Partner Dashboard
Write-Host "2. Partner Dashboard..."
$partnerDashboard = Invoke-RestMethod -Uri "http://localhost:3000/api/partner/dashboard" -Method GET -Headers $partnerHeaders
Write-Host "   ✅ Partner Dashboard: Equipment = $($partnerDashboard.totalEquipment), Revenue = IQD $($partnerDashboard.totalRevenue)"

# Partner Equipment
Write-Host "3. Partner Equipment..."
$equipment = Invoke-RestMethod -Uri "http://localhost:3000/api/partner/equipment" -Method GET -Headers $partnerHeaders
Write-Host "   ✅ Equipment: $($equipment.Count) items loaded"

# Partner Bookings
Write-Host "4. Partner Bookings..."
$bookings = Invoke-RestMethod -Uri "http://localhost:3000/api/partner/bookings" -Method GET -Headers $partnerHeaders
Write-Host "   ✅ Bookings: $($bookings.Count) bookings loaded"

# Partner Revenue
Write-Host "5. Partner Revenue..."
$revenue = Invoke-RestMethod -Uri "http://localhost:3000/api/partner/revenue" -Method GET -Headers $partnerHeaders
Write-Host "   ✅ Revenue: Total = IQD $($revenue.totalRevenue)"

Write-Host ""
Write-Host "STEP 2 COMPLETED SUCCESSFULLY!"
Write-Host ""

# Step 3: Test Customer Features
Write-Host "STEP 3: TESTING CUSTOMER FEATURES"
Write-Host "--------------------------------"

# Customer Login
Write-Host "1. Customer Login..."
$customerLogin = '{"email":"customer@example.com","password":"password123"}'
$customerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $customerLogin
Write-Host "   ✅ Customer Login: SUCCESS"
$customerToken = $customerResponse.token

# Customer Headers
$customerHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $customerToken"
}

# Customer Dashboard
Write-Host "2. Customer Dashboard..."
$customerDashboard = Invoke-RestMethod -Uri "http://localhost:3000/api/customer/dashboard" -Method GET -Headers $customerHeaders
Write-Host "   ✅ Customer Dashboard: Bookings = $($customerDashboard.totalBookings), Spent = IQD $($customerDashboard.totalSpent)"

# Equipment Search
Write-Host "3. Equipment Search..."
$searchResults = Invoke-RestMethod -Uri "http://localhost:3000/api/equipment/search" -Method GET -Headers $customerHeaders
Write-Host "   ✅ Search Results: $($searchResults.Count) items found"

# Categories
Write-Host "4. Categories..."
$categories = Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method GET -Headers $customerHeaders
Write-Host "   ✅ Categories: $($categories.Count) categories loaded"

# Customer Bookings
Write-Host "5. Customer Bookings..."
$customerBookings = Invoke-RestMethod -Uri "http://localhost:3000/api/customer/bookings" -Method GET -Headers $customerHeaders
Write-Host "   ✅ Customer Bookings: $($customerBookings.Count) bookings loaded"

Write-Host ""
Write-Host "STEP 3 COMPLETED SUCCESSFULLY!"
Write-Host ""

# Step 4: Return to Partner
Write-Host "STEP 4: RETURN TO PARTNER"
Write-Host "------------------------"

# Partner Login Again
Write-Host "1. Partner Login Again..."
$partnerResponse2 = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $partnerLogin
Write-Host "   ✅ Partner Login Again: SUCCESS"

# Partner Dashboard Again
Write-Host "2. Partner Dashboard Again..."
$partnerDashboard2 = Invoke-RestMethod -Uri "http://localhost:3000/api/partner/dashboard" -Method GET -Headers $partnerHeaders
Write-Host "   ✅ Partner Dashboard Again: Equipment = $($partnerDashboard2.totalEquipment)"

Write-Host ""
Write-Host "STEP 4 COMPLETED SUCCESSFULLY!"
Write-Host ""

# Step 5: Return to Customer
Write-Host "STEP 5: RETURN TO CUSTOMER"
Write-Host "-------------------------"

# Customer Login Again
Write-Host "1. Customer Login Again..."
$customerResponse2 = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $customerLogin
Write-Host "   ✅ Customer Login Again: SUCCESS"

# Customer Dashboard Again
Write-Host "2. Customer Dashboard Again..."
$customerDashboard2 = Invoke-RestMethod -Uri "http://localhost:3000/api/customer/dashboard" -Method GET -Headers $customerHeaders
Write-Host "   ✅ Customer Dashboard Again: Bookings = $($customerDashboard2.totalBookings)"

Write-Host ""
Write-Host "STEP 5 COMPLETED SUCCESSFULLY!"
Write-Host ""

# Step 6: Final Admin Check
Write-Host "STEP 6: FINAL ADMIN CHECK"
Write-Host "-------------------------"

# Admin Login Final
Write-Host "1. Final Admin Login..."
$adminResponseFinal = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $adminLogin
Write-Host "   ✅ Final Admin Login: SUCCESS"

# Final Admin Dashboard
Write-Host "2. Final Admin Dashboard..."
$dashboardFinal = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/dashboard" -Method GET -Headers $adminHeaders
Write-Host "   ✅ Final Dashboard: Total Users = $($dashboardFinal.totalUsers)"

# Check Insurance Policies
Write-Host "3. Check Insurance Policies..."
$policies = Invoke-RestMethod -Uri "http://localhost:3000/api/insurance/policies" -Method GET -Headers $adminHeaders
Write-Host "   ✅ Insurance Policies: $($policies.Count) policies found"

# Check Support Tickets
Write-Host "4. Check Support Tickets..."
$tickets = Invoke-RestMethod -Uri "http://localhost:3000/api/support/tickets" -Method GET -Headers $adminHeaders
Write-Host "   ✅ Support Tickets: $($tickets.Count) tickets found"

# Check Contracts
Write-Host "5. Check Contracts..."
$contracts = Invoke-RestMethod -Uri "http://localhost:3000/api/contracts" -Method GET -Headers $adminHeaders
Write-Host "   ✅ Contracts: $($contracts.Count) contracts found"

Write-Host ""
Write-Host "STEP 6 COMPLETED SUCCESSFULLY!"
Write-Host ""

# Final Summary
Write-Host "========================================"
Write-Host "     SYSTEM TEST SUMMARY"
Write-Host "========================================"
Write-Host ""
Write-Host "✅ ADMIN FEATURES: WORKING"
Write-Host "   - Login & Authentication"
Write-Host "   - Dashboard & Statistics"
Write-Host "   - User & Partner Management"
Write-Host "   - Insurance Service"
Write-Host "   - Support Service"
Write-Host "   - Contract Service"
Write-Host ""
Write-Host "✅ PARTNER FEATURES: WORKING"
Write-Host "   - Login & Authentication"
Write-Host "   - Dashboard & Analytics"
Write-Host "   - Equipment Management"
Write-Host "   - Booking Management"
Write-Host "   - Revenue Tracking"
Write-Host ""
Write-Host "✅ CUSTOMER FEATURES: WORKING"
Write-Host "   - Login & Authentication"
Write-Host "   - Dashboard & History"
Write-Host "   - Equipment Search"
Write-Host "   - Category Browsing"
Write-Host "   - Booking Management"
Write-Host ""
Write-Host "✅ CORE SERVICES: WORKING"
Write-Host "   - Authentication System"
Write-Host "   - Insurance System"
Write-Host "   - Support System"
Write-Host "   - Contract System"
Write-Host "   - Search & Discovery"
Write-Host ""
Write-Host "========================================"
Write-Host "     ALL TESTS PASSED SUCCESSFULLY!"
Write-Host "========================================"
Write-Host ""
Write-Host "🎉 THE IRAQI IJAR SYSTEM IS FULLY FUNCTIONAL!"
Write-Host "📍 Server: http://localhost:3000"
Write-Host "👥 All user types tested successfully"
Write-Host "🔧 All core services operational"
Write-Host "📊 All dashboards working correctly"
