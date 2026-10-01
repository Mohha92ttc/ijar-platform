# Simple API Test
$headers = @{
    "Content-Type" = "application/json"
}

# Test health
Write-Host "Testing Health..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method GET
Write-Host "Health OK"

# Test admin login
Write-Host "Testing Admin Login..."
$loginData = '{"email":"admin@ijar.iq","password":"admin123"}'
$authResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Headers $headers -Body $loginData
Write-Host "Admin Login Success"
$adminToken = $authResponse.token

# Test admin dashboard
Write-Host "Testing Admin Dashboard..."
$authHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $adminToken"
}
$dashboardResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/dashboard" -Method GET -Headers $authHeaders
Write-Host "Admin Dashboard Success"

Write-Host "All tests completed successfully!"
