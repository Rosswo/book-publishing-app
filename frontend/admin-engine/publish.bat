@echo off
setlocal

cd /d "%~dp0"

echo ================================
echo        Book Publisher
echo ================================
echo.

if "%~1"=="" (
    echo Drag and drop a DOCX file onto this file.
    echo.
    pause
    exit /b
)

echo Processing:
echo %~1
echo.

node index.js "%~1"

echo.
echo Finished.
pause