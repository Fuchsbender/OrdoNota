//go:build !embedapp

package main

import "io/fs"

// Ohne -tags embedapp: App-Dateien nur aus dem Programmordner.
func embeddedFiles() fs.FS { return nil }
