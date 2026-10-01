# Test API endpoints
$headers = @{
    "Content-Type" = "application/json"
}

# Test health endpoint
Write-Host "🔍 Testing Health Endpoint..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method GET
Write-Host "✅ Health: $response"

# Test admin login
Write-Host "`n🔐 Testing Admin Login..."
$loginData = @{
    email = "admin@ijar.iq"
    password = "admin123"
} | ConvertTo-Json

try {
    $authResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $loginData
    Write-Host "✅ Admin Login: $($authResponse | ConvertTo-Json -Depth 3)"
    $adminToken = $authResponse.token
} catch {
    Write-Host "❌ Admin Login Failed: $($_.Exception.Message)"
}

# Test admin dashboard
Write-Host "`n📊 Testing Admin Dashboard..."
if ($adminToken) {
    $authHeaders = $headers.Clone()
    $authHeaders["Authorization"] = "Bearer $adminToken"
    
    try {
        $dashboardResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/dashboard" -Method GET -Headers $authHeaders
        Write-Host "✅ Admin Dashboard: $($dashboardResponse | ConvertTo-Json -Depth 3)"
    } catch {
        Write-Host "❌ Admin Dashboard Failed: $($_.Exception.Message)"
    }
}

# Test partner login
Write-Host "`n🏭 Testing Partner Login..."
$partnerData = @{
    email = "partner@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $partnerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $partnerData
    Write-Host "✅ Partner Login: $($partnerResponse | ConvertTo-Json -Depth 3)"
    $partnerToken = $partnerResponse.token
} catch {
    Write-Host "❌ Partner Login Failed: $($_.Exception.Message)"
}

# Test customer login
Write-Host "`n🛍️ Testing Customer Login..."
$customerData = @{
    email = "customer@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $customerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $customerData
    Write-Host "✅ Customer Login: $($customerResponse | ConvertTo-Json -Depth 3)"
    $customerToken = $customerResponse.token
} catch {
    Write-Host "❌ Customer Login Failed: $($_.Exception.Message)"
}

Write-Host "API Testing Complete!"
