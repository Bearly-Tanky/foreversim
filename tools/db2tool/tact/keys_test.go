package tact

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

// ECRYPT Salsa20/20 test vector, 128-bit key, set 1 vector 0: key 80 00 .. 00,
// nonce all zero, first 64 keystream bytes.
func TestSalsa20KnownVector(t *testing.T) {
	var key [16]byte
	key[0] = 0x80
	var nonce [8]byte
	got := salsa20XOR(key, nonce, make([]byte, 64))
	want, _ := hex.DecodeString("4DFA5E481DA23EA09A31022050859936DA52FCEE218005164F267CB65F5CFD7F2B4F97E0FF16924A52DF269515110A07F9E460BC65EF95DA58F740B7D1DBB0AA")
	if !bytes.Equal(got, want) {
		t.Fatalf("keystream mismatch:\n got %X\nwant %X", got, want)
	}
}

// An encrypted BLTE chunk wrapping a plain 'N' chunk decodes to the payload
// when the key is known, and to zeros when it is not.
func TestBLTEEncryptedChunk(t *testing.T) {
	payload := []byte("hello encrypted world, this is chunk data")
	key := [16]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
	const keyName = uint64(0xDA0E7785727A0A65)
	iv := []byte{0xAA, 0xBB, 0xCC, 0xDD}

	// Build the inner chunk ('N' + payload), encrypt it for chunk index 1.
	inner := append([]byte{'N'}, payload...)
	var nonce [8]byte
	copy(nonce[:], iv)
	nonce[0] ^= 1 // chunk index 1 folded into the IV
	enc := salsa20XOR(key, nonce, inner)

	chunk := []byte{8}
	chunk = binary.LittleEndian.AppendUint64(chunk, keyName)
	chunk = append(chunk, byte(len(iv)))
	chunk = append(chunk, iv...)
	chunk = append(chunk, 'S')
	chunk = append(chunk, enc...)

	out := make([]byte, len(payload))
	keys := NewKeyStore()
	if err := handleDataBlock('E', chunk, out, 1, keys); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(out, make([]byte, len(payload))) {
		t.Fatalf("keyless decode should zero-fill, got %q", out)
	}
	if m := keys.Missing(); len(m) != 1 || m[0] != keyName {
		t.Fatalf("missing keys = %v, want [%X]", m, keyName)
	}

	keys.Add(keyName, key)
	if err := handleDataBlock('E', chunk, out, 1, keys); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(out, payload) {
		t.Fatalf("decrypted %q, want %q", out, payload)
	}
}

func TestLoadKeyFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "keys.txt")
	os.WriteFile(path, []byte("# comment\nFA505078126ACB3E BDC51862ABED79B2DE48C8E7E66C6200\nbad line\n0DA4670DB36FB2A9 00112233445566778899AABBCCDDEEFF some description\n"), 0o644)
	keys := NewKeyStore()
	n, err := keys.LoadKeyFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 || keys.Len() != 2 {
		t.Fatalf("loaded %d keys (store %d), want 2", n, keys.Len())
	}
	if !keys.Has(0xFA505078126ACB3E) || !keys.Has(0x0DA4670DB36FB2A9) {
		t.Fatal("expected both well-formed keys to load")
	}
}
