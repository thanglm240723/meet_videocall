# Chay tu thu muc HOP_MEET:  powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1
$ErrorActionPreference = "Stop"
$Vps = "root@103.101.163.250"
$Root = Split-Path $PSScriptRoot -Parent
$Out = Join-Path $Root "deploy\out"

Remove-Item $Out -Recurse -Force -ErrorAction SilentlyContinue
New-Item $Out -ItemType Directory | Out-Null

Write-Host "== Build BE ==" -ForegroundColor Cyan
dotnet publish "$Root\BE\BE\BE.csproj" -c Release -r linux-x64 --self-contained true -o "$Out\be"
if ($LASTEXITCODE) { throw "publish loi" }
dotnet ef migrations bundle --project "$Root\BE\BE\BE.csproj" -r linux-x64 --self-contained -o "$Out\efbundle" --force
if ($LASTEXITCODE) { throw "migrations bundle loi" }
tar -czf "$Out\be.tgz" -C "$Out\be" .

Write-Host "== Build FE ==" -ForegroundColor Cyan
Push-Location "$Root\FE\my-app"
# Khong dung npm ci: no xoa node_modules, loi khi dev server (npm run dev) dang chay
if (-not (Test-Path "node_modules")) { npm install; if ($LASTEXITCODE) { throw "npm install loi" } }
npm run build; if ($LASTEXITCODE) { throw "build FE loi" }
Pop-Location
tar -czf "$Out\fe.tgz" -C "$Root\FE\my-app\dist" .

Write-Host "== Upload ==" -ForegroundColor Cyan
ssh $Vps "rm -rf /tmp/hopmeet-upload && mkdir -p /tmp/hopmeet-upload"
scp "$Out\be.tgz" "$Out\fe.tgz" "$Out\efbundle" "$Root\deploy\remote-install.sh" "${Vps}:/tmp/hopmeet-upload/"

Write-Host "== Cai dat tren VPS ==" -ForegroundColor Cyan
ssh $Vps "sed -i 's/\r$//' /tmp/hopmeet-upload/remote-install.sh && bash /tmp/hopmeet-upload/remote-install.sh"

Write-Host "Xong: https://hopmeet.103-101-163-250.sslip.io" -ForegroundColor Green
