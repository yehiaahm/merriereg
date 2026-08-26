@echo off
cd /d "%~dp0"

title MERRIER Streetwear Store

echo =========================================================
echo       MERRIER STREETWEAR - STARTING COMPLETE STORE
echo =========================================================
echo.

if not exist "node_modules" (
    echo [1/4] Installing project packages...
    call npm install
) else (
    echo [1/4] Packages ready.
)

if not exist ".env" (
    echo [2/4] Initializing environment config...
    copy ".env.example" ".env" >nul
) else (
    echo [2/4] Environment config ready.
)

echo [3/4] Starting database and syncing tables...
call npm run db:local
call npx prisma migrate deploy
call npx prisma generate
call npm run db:seed

echo.
echo [4/4] Starting Fullstack Store: Frontend + Backend + Database
echo.
echo =========================================================
echo   The website is opening in your browser right now!
echo   Store:  http://localhost:3000
echo   Admin:  http://localhost:3000/admin/login
echo =========================================================
echo.

start "" "http://localhost:3000"

call npm run dev

pause
