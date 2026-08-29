@echo off
chcp 936 >nul
title Mihomo 图标一键同步工具

echo =======================================================
echo          Mihomo 图标一键同步工具 (Base64 离线内联)
echo =======================================================
echo.

where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    py sync-icons.py
    goto check
)

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python sync-icons.py
    goto check
)

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    node sync-icons.js
    goto check
)

if exist "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" (
    "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" sync-icons.py
    goto check
)

if exist "D:\Software\01_Tools\NodeJS\node.exe" (
    "D:\Software\01_Tools\NodeJS\node.exe" sync-icons.js
    goto check
)

echo [错误] 未能在系统中找到 Python 或 Node.js 环境！
goto end

:check
if %ERRORLEVEL% equ 0 (
    echo =======================================================
    echo [成功] 图标已成功内嵌到 scripts/mihomo-clash-party.js！
    echo 接下来您只需要执行 git commit 和 git push 即可推送到 GitHub。
    echo =======================================================
) else (
    echo =======================================================
    echo [失败] 同步过程中发生错误。
    echo =======================================================
)

:end
echo.
pause
