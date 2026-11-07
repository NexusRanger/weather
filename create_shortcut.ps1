$w = New-Object -ComObject WScript.Shell
$sc = $w.CreateShortcut('C:\Users\Phil\Desktop\Weather Dashboard.lnk')
$sc.TargetPath = 'c:\Data\Antigravity\launch.bat'
$sc.WorkingDirectory = 'c:\Data\Antigravity'
$sc.Save()
Write-Host "Shortcut created successfully on Desktop!"
