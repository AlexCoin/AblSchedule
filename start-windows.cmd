@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then reopen this file.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24){console.error('Node.js 24 or newer is required');process.exit(1)}"
if errorlevel 1 goto failed
call npm.cmd ci
if errorlevel 1 goto failed
if not exist .env.local (
  node -e "const fs=require('node:fs'),crypto=require('node:crypto');fs.writeFileSync('.env.local','APP_URL=http://localhost:3000\nDEMO_MODE=true\nDATABASE_PATH=data/demo.sqlite\nSESSION_SECRET='+crypto.randomBytes(32).toString('hex')+'\n',{flag:'wx'})"
  if errorlevel 1 goto failed
)
node --env-file=.env.local -e "process.exit(process.env.DEMO_MODE==='true'&&!process.env.DATABASE_URL?0:1)"
if errorlevel 1 goto launch
call npm.cmd run demo:seed
if errorlevel 1 goto failed
:launch
echo.
echo Open http://localhost:3000 in your browser after Ready appears.
echo Keep this window open. Press Ctrl+C to stop the application.
call npm.cmd run dev
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Startup failed. Send the error text from this window.
pause
exit /b 1
