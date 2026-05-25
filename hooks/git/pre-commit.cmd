@echo off
REM Git pre-commit hook for Windows cmd (Git for Windows also accepts pre-commit without extension)
setlocal
cd /d "%~dp0..\.."
for /f "delims=" %%i in ('git rev-parse --show-toplevel 2^>nul') do set "ROOT=%%i"
if not defined ROOT set "ROOT=%CD%"
cd /d "%ROOT%"
node "%~dp0pre-commit.cjs" %*
exit /b %ERRORLEVEL%
