@echo off
rem Register daily 10:00 task "BirthdaySMS" (runs late if the PC was off at 10:00)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Location).Path; $a=New-ScheduledTaskAction -Execute ('\"'+$d+'\run_daily.bat\"') -WorkingDirectory $d; $t=New-ScheduledTaskTrigger -Daily -At 10:00; $s=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; Register-ScheduledTask -TaskName 'BirthdaySMS' -Action $a -Trigger $t -Settings $s -Description 'Customer birthday SMS (Aligo)' -Force | Out-Null; Write-Host 'Registered: BirthdaySMS daily 10:00'"
pause
