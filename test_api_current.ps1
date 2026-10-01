# Test Current API Status
$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "Testing API Services..."

# Test Health
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method GET
    Write-Host "✅ Health Check: $($health.status)"
} catch {
    Write-Host "❌ Health Check: FAILED"
}

# Test Admin Login
try {
    $loginData = '{"email":"admin@ijar.iq","password":"admin123"}'
    $adminResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $loginData
    Write-Host "✅ Admin Login: SUCCESS"
    Write-Host "   Token: $($adminResponse.token.Substring(0,20))..."
    $adminToken = $adminResponse.token
    
    # Test Admin Dashboard
    $adminHeaders = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $adminToken"
    }
    
    $dashboard = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/dashboard" -Method GET -Headers $adminHeaders
    Write-Host "✅ Admin Dashboard: $($dashboard.totalUsers) users, $($dashboard.totalPartners) partners"
    
    # Test Admin Users
    $users = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/users" -Method GET -Headers $adminHeaders
    Write-Host "✅ Admin Users: $($users.Count) users loaded"
    
} catch {
    Write-Host "❌ Admin Login: FAILED"
}

# Test Partner Login
try {
    $partnerLogin = '{"email":"partner@example.com","password":"password123"}'
    $partnerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $partnerLogin
    Write-Host "✅ Partner Login: SUCCESS"
    Write-Host "   Token: $($partnerResponse.token.Substring(0,20))..."
    $partnerToken = $partnerResponse.token
    
    $partnerHeaders = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $partnerToken"
    }
    
    $partnerDashboard = Invoke-RestMethod -Uri "http://localhost:3000/api/partner/dashboard" -Method GET -Headers $partnerHeaders
    Write-Host "✅ Partner Dashboard: $($partnerDashboard.totalEquipment) equipment"
    
    $equipment = Invoke-RestMethod -Uri "http://localhost:3000/api/partner/equipment" -Method GET -Headers $partnerHeaders
    Write-Host "✅ Partner Equipment: $($equipment.Count) items"
    
} catch {
    Write-Host "❌ Partner Login: FAILED"
}

# Test Customer Login
try {
    $customerLogin = '{"email":"customer@example.com","password":"password123"}'
    $customerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $customerLogin
    Write-Host "✅ Customer Login: SUCCESS"
    Write-Host "   Token: $($customerResponse.token.Substring(0,20))..."
    $customerToken = $customerResponse.token
    
    $customerHeaders = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $customerToken"
    }
    
    $customerDashboard = Invoke-RestMethod -Uri "http://localhost:3000/api/customer/dashboard" -Method GET -Headers $customerHeaders
    Write-Host "✅ Customer Dashboard: $($customerDashboard.totalBookings) bookings"
    
    $searchResults = Invoke-RestMethod -Uri "http://localhost:3000/api/equipment/search" -Method GET -Headers $customerHeaders
    Write-Host "✅ Equipment Search: $($searchResults.Count) items found"
    
} catch {
    Write-Host "❌ Customer Login: FAILED"
}

# Test Services
try {
    $adminHeaders = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $adminToken"
    }
    
    # Insurance
    $insurancePolicy = '{"equipmentId":"test-1","type":"basic","coverage":{"damage":80,"theft":90},"premium":50000}'
    $policy = Invoke-RestMethod -Uri "http://localhost:3000/api/insurance/policies" -Method POST -Headers $adminHeaders -Body $insurancePolicy
    Write-Host "✅ Insurance Policy: Created ID $($policy.id)"
    
    $policies = Invoke-RestMethod -Uri "http://localhost:3000/api/insurance/policies" -Method GET -Headers $adminHeaders
    Write-Host "✅ Insurance Policies: $($policies.Count) policies"
    
    # Support
    $supportTicket = '{"category":"technical","priority":"medium","subject":"Test","description":"Testing"}'
    $ticket = Invoke-RestMethod -Uri "http://localhost:3000/api/support/tickets" -Method POST -Headers $customerHeaders -Body $supportTicket
    Write-Host "✅ Support Ticket: Created ID $($ticket.id)"
    
    $tickets = Invoke-RestMethod -Uri "http://localhost:3000/api/support/tickets" -Method GET -Headers $adminHeaders
    Write-Host "✅ Support Tickets: $($tickets.Count) tickets"
    
    # Contract
    $contractData = '{"bookingId":"booking-1","equipmentId":"eq-1","type":"rental","totalAmount":100000}'
    $contract = Invoke-RestMethod -Uri "http://localhost:3000/api/contracts" -Method POST -Headers $adminHeaders -Body $contractData
    Write-Host "✅ Contract: Created ID $($contract.id)"
    
    $contracts = Invoke-RestMethod -Uri "http://localhost:3000/api/contracts" -Method GET -Headers $adminHeaders
    Write-Host "✅ Contracts: $($contracts.Count) contracts"
    
} catch {
    Write-Host "❌ Services Test: FAILED"
}

Write-Host ""
Write-Host "API Status Check Complete!"
