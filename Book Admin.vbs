Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d ""F:\BookApp\admin-ui"" && node server.js", 0
Set WshShell = Nothing