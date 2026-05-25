@echo off
setlocal
cd /d "%~dp0..\.."
for /f "delims=" %%i in ('git rev-parse --show-toplevel 2^>nul') do set "ROOT=%%i"
if not defined ROOT set "ROOT=%CD%"
cd /d "%ROOT%"
node "%~dp0background-scan.cjs" %*
exit /b %ERRORLEVEL%
