@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   VirtualMall 虚拟商品商城启动脚本
echo ========================================
echo.
echo 当前目录: %cd%
echo.

if not exist "node_modules" (
    echo [1/2] 正在安装依赖...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo 错误: 依赖安装失败！
        echo 请确保已安装 Node.js (https://nodejs.org/)
        pause
        exit /b 1
    )
    echo.
    echo [√] 依赖安装成功！
) else (
    echo [√] 依赖已存在，跳过安装
)

echo.
echo [2/2] 正在启动服务器...
echo.
node server.js

pause
