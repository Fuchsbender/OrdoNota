package main

// Ordner-Dialog und Fehlermeldungen mit den Bordmitteln des Systems
// (Linux: zenity/kdialog, Mac: osascript, Windows: PowerShell).

import (
	"errors"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

var (
	errCancel   = errors.New("abgebrochen")
	errNoDialog = errors.New("kein Ordner-Dialog verfügbar")
)

const pickTitle = "OrdoNota – Datenordner wählen (z. B. im Synology-Drive-Ordner)"

func pickFolderNative() (string, error) {
	home, _ := os.UserHomeDir()
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("osascript", "-e", `POSIX path of (choose folder with prompt "`+pickTitle+`")`)
	case "windows":
		ps := `[Console]::OutputEncoding=[Text.Encoding]::UTF8;` +
			`Add-Type -AssemblyName System.Windows.Forms;` +
			`$o=New-Object System.Windows.Forms.Form -Property @{TopMost=$true};` +
			`$d=New-Object System.Windows.Forms.FolderBrowserDialog;` +
			`$d.Description='` + pickTitle + `';$d.ShowNewFolderButton=$true;` +
			`if($d.ShowDialog($o) -eq 'OK'){[Console]::Out.Write($d.SelectedPath)}else{exit 1}`
		cmd = exec.Command("powershell", "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps)
	default:
		if p, err := exec.LookPath("zenity"); err == nil {
			cmd = exec.Command(p, "--file-selection", "--directory", "--title="+pickTitle, "--filename="+home+"/")
		} else if p, err := exec.LookPath("kdialog"); err == nil {
			cmd = exec.Command(p, "--getexistingdirectory", home, "--title", pickTitle)
		} else {
			return "", errNoDialog
		}
	}
	hideConsole(cmd)
	out, err := cmd.Output()
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			return "", errCancel
		}
		return "", errNoDialog
	}
	raw := strings.TrimSpace(string(out))
	if raw == "" {
		return "", errCancel
	}
	if p := strings.TrimRight(raw, `/\`); p != "" && !strings.HasSuffix(p, ":") {
		return p, nil
	}
	return raw, nil // Wurzel wie "/" oder "D:\"
}

// showError zeigt eine Meldung an, auch wenn kein Terminal offen ist.
func showError(msg string) {
	logf("FEHLER: %s", msg)
	os.Stderr.WriteString("OrdoNota: " + msg + "\n")
	switch runtime.GOOS {
	case "windows":
		messageBox("OrdoNota", msg)
	case "darwin":
		esc := strings.ReplaceAll(strings.ReplaceAll(msg, `\`, `\\`), `"`, `\"`)
		exec.Command("osascript", "-e", `display alert "OrdoNota" message "`+esc+`" as critical`).Run()
	default:
		if p, err := exec.LookPath("zenity"); err == nil {
			exec.Command(p, "--error", "--title=OrdoNota", "--text="+msg).Run()
		} else if p, err := exec.LookPath("kdialog"); err == nil {
			exec.Command(p, "--error", msg, "--title", "OrdoNota").Run()
		} else if p, err := exec.LookPath("notify-send"); err == nil {
			exec.Command(p, "OrdoNota", msg).Run()
		}
	}
}
