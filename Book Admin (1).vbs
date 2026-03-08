' Book Admin Launcher
' Dynamically detects its own location — works on any drive (E:, F:, etc.)

Dim WshShell, scriptDir, bookAppRoot, adminUiPath

Set WshShell = CreateObject("WScript.Shell")

' Get the folder this VBS file lives in (the BookApp root)
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
' Remove trailing backslash
bookAppRoot = Left(scriptDir, Len(scriptDir) - 1)
adminUiPath = bookAppRoot & "\admin-ui"

' Start Node server (hidden window)
WshShell.Run "cmd /c cd /d """ & adminUiPath & """ && node server.js", 0

' Wait for server to start (includes git pull time on startup)
WScript.Sleep 4000

' Open admin panel in default browser
WshShell.Run "http://localhost:3001"

Set WshShell = Nothing