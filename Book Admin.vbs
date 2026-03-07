Set WshShell = CreateObject("WScript.Shell")

WshShell.Run "cmd /c cd /d ""E:\BookApp\admin-ui"" && node server.js", 0
WScript.Sleep 1500
WshShell.Run "http://localhost:3001"

Set WshShell = Nothing