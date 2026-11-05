//go:build embedapp

package main

import (
	"embed"
	"io/fs"
)

// Beim Bauen mit build.sh kopiert das Skript die App-Dateien nach webapp/ und baut mit -tags embedapp.
//
//go:embed all:webapp
var embedded embed.FS

func embeddedFiles() fs.FS {
	sub, err := fs.Sub(embedded, "webapp")
	if err != nil {
		return nil
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil
	}
	return sub
}
