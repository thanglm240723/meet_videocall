# Chạy trên máy Windows mỗi lần muốn cập nhật code lên VPS:
#   powershell -ExecutionPolicy Bypass -File deploy\publish.ps1
$ErrorActionPreference = "Stop"
$VPS    = "root@103.101.163.250"
$DOMAIN = "https://103-101-163-250.sslip.io"
$Root   = Split-Path $PSScriptRoot -Parent
$Out    = Join-Path $PSScriptRoot "out"

if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }

# 1. Build BE (self-contained: VPS không cần cài .NET)
dotnet publish "$Root\BE\MeetingsBE\MeetingsBE\MeetingsBE.csproj" -c Release -r linux-x64 --self-contained -o $Out
if ($LASTEXITCODE -ne 0) { throw "Build BE lỗi" }

# 2. Build FE rồi bỏ vào wwwroot của BE
Push-Location "$Root\FE\my-app"
$env:VITE_PUBLIC_URL = $DOMAIN
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Build FE lỗi" }
Pop-Location
Copy-Item "$Root\FE\my-app\dist" "$Out\wwwroot" -Recurse

# 3. Upload + khởi động lại
ssh $VPS "systemctl stop meetroom; rm -rf /opt/meetroom/*"
scp -r "$Out\*" "${VPS}:/opt/meetroom/"
ssh $VPS "chmod +x /opt/meetroom/MeetingsBE && systemctl start meetroom && sleep 3 && systemctl --no-pager status meetroom | head -15"

Write-Host "Xong! Mở $DOMAIN"
