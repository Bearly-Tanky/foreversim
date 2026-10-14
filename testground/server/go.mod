module testground

go 1.25.0

require (
	github.com/wowsims/forever v0.0.0
	golang.org/x/sys v0.38.0
	google.golang.org/protobuf v1.36.10
)

require golang.org/x/exp v0.0.0-20250408133849-7e4ce0ab07d0 // indirect

replace github.com/wowsims/forever => ../..
