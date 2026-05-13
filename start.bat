@echo off
cd /d "C:\Users\Admin\WorkBuddy\2026-05-12-task-14"
echo 正在安装依赖...
call npm install
echo.
echo 依赖安装完成！正在启动服务器...
echo.
node server.js
pause
