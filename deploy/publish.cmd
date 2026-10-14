@echo off
rem Chay tren may Windows (cmd) moi lan muon cap nhat code len VPS:
rem   deploy\publish.cmd
setlocal
set VPS=root@103.101.163.250
set DOMAIN=https://103-101-163-250.sslip.io
set ROOT=%~dp0..
set OUT=%~dp0out

if exist "%OUT%" rmdir /s /q "%OUT%"

rem 1. Build BE (self-contained: VPS khong can cai .NET)
dotnet publish "%ROOT%\BE\MeetingsBE\MeetingsBE\MeetingsBE.csproj" -c Release -r linux-x64 --self-contained -o "%OUT%"
if errorlevel 1 (echo Build BE loi & exit /b 1)

rem 2. Build FE roi bo vao wwwroot cua BE
pushd "%ROOT%\FE\my-app"
set VITE_PUBLIC_URL=%DOMAIN%
call npm run build
if errorlevel 1 (popd & echo Build FE loi & exit /b 1)
popd
xcopy "%ROOT%\FE\my-app\dist" "%OUT%\wwwroot\" /e /i /q /y >nul

rem 3. Upload vao thu muc tam /opt/meetroom-new (phai chua ton tai thi scp moi chep dung cho)
ssh %VPS% "rm -rf /opt/meetroom-new"
if errorlevel 1 (echo Khong ket noi duoc VPS & exit /b 1)
scp -r "%OUT%" %VPS%:/opt/meetroom-new
if errorlevel 1 (echo Upload loi & exit /b 1)

rem 4. Dung service, thay thu muc cu bang ban moi, chay lai
ssh %VPS% "systemctl stop meetroom && rm -rf /opt/meetroom && mv /opt/meetroom-new /opt/meetroom && chmod +x /opt/meetroom/MeetingsBE && systemctl start meetroom && sleep 3 && systemctl --no-pager status meetroom | head -15"
if errorlevel 1 (echo Khoi dong lai loi, xem: ssh %VPS% "journalctl -u meetroom -n 50 --no-pager" & exit /b 1)

echo Xong! Mo %DOMAIN% (nho Ctrl+F5 de trinh duyet lay ban moi)
endlocal
