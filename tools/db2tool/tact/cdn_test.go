package tact

import (
	"crypto/md5"
	"encoding/binary"
	"testing"
)

func TestParsePSV(t *testing.T) {
	raw := "Region!STRING:0|BuildConfig!HEX:16|VersionsName!String:0\r\n" +
		"## seqn = 4026306\n" +
		"us|6c0df97e8e481a9a41600e373367c200|1.60.1.69913\n" +
		"eu|6c0df97e8e481a9a41600e373367c200|1.60.1.69913\n"
	rows := parsePSV(raw)
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want 2", len(rows))
	}
	if rows[1]["Region"] != "eu" || rows[0]["VersionsName"] != "1.60.1.69913" || rows[0]["BuildConfig"] != "6c0df97e8e481a9a41600e373367c200" {
		t.Errorf("unexpected rows %v", rows)
	}
}

// buildArchiveIndex lays out entries the way the CDN's .index files do: one
// 4 KiB block, a TOC of the block's last key and hash, then the footer.
func buildArchiveIndex(keys [][16]byte) []byte {
	const blockSize = 4096
	block := make([]byte, blockSize)
	p := block
	for i, key := range keys {
		copy(p, key[:])
		binary.BigEndian.PutUint32(p[16:], uint32(100+i))  // size
		binary.BigEndian.PutUint32(p[20:], uint32(i*1000)) // offset
		p = p[24:]
	}
	raw := append(block, keys[len(keys)-1][:]...)
	blockHash := md5.Sum(block)
	raw = append(raw, blockHash[:8]...)
	footer := []byte{0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 4, 4, 4, 16, 8}
	footer = binary.LittleEndian.AppendUint32(footer, uint32(len(keys)))
	footer = append(footer, 0, 0, 0, 0, 0, 0, 0, 0)
	return append(raw, footer...)
}

func TestMergeArchiveIndex(t *testing.T) {
	keys := make([][16]byte, 3)
	for i := range keys {
		keys[i][0] = byte(i + 1)
		keys[i][15] = 0xff
	}
	s := &cdnStore{entries: map[[16]byte]archiveEntry{}}
	if err := s.mergeArchiveIndex(7, buildArchiveIndex(keys)); err != nil {
		t.Fatal(err)
	}
	if len(s.entries) != 3 {
		t.Fatalf("got %d entries, want 3", len(s.entries))
	}
	got := s.entries[keys[2]]
	want := archiveEntry{archive: 7, offset: 2000, size: 102}
	if got != want {
		t.Errorf("entry for key 2 = %+v, want %+v", got, want)
	}
	if _, ok := s.entries[[16]byte{}]; ok {
		t.Errorf("block padding was read as an entry")
	}

	// A truncated file must not parse as a shorter index.
	raw := buildArchiveIndex(keys)
	if err := s.mergeArchiveIndex(0, raw[1:]); err == nil {
		t.Errorf("truncated index parsed without error")
	}
}

func TestEncodedKey(t *testing.T) {
	// Chunk-table BLTE: the key covers only the header.
	header := []byte{'B', 'L', 'T', 'E', 0, 0, 0, 12, 0xF, 0, 0, 1}
	if got, want := encodedKey(append(header, 'N', 1, 2, 3)), md5Hex(header); got != want {
		t.Errorf("chunk-table key = %s, want header md5 %s", got, want)
	}
	// Headerless single chunk: the whole blob.
	single := []byte{'B', 'L', 'T', 'E', 0, 0, 0, 0, 'N', 1, 2, 3}
	if got, want := encodedKey(single), md5Hex(single); got != want {
		t.Errorf("single-chunk key = %s, want whole-blob md5 %s", got, want)
	}
}
