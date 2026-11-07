@echo off
title Weather Dashboard Server
cd /d "c:\Data\Antigravity"
start "" "msedge.exe" "c:\Data\Antigravity\weather-dashboard\index.html"
cd weather-dashboard && python serve.py
pause
