package main

// #cgo CPPFLAGS: -I/usr/local/include/node
// #cgo LDFLAGS: -L/usr/local/lib
import "C"

import "github.com/Agoric/agoric-sdk/packages/cosmic-swingset/lib/daemon"

func main() {
	daemon.Run()
}
