package tact

import (
	"encoding/binary"
	"math/bits"
)

// salsa20XOR applies the Salsa20/20 keystream for a 128-bit key and 64-bit
// nonce to in, starting at block counter 0, and returns the result. It is the
// cipher BLTE 'E' chunks use ('S' type). Salsa20 is symmetric, so the same
// call encrypts and decrypts.
func salsa20XOR(key [16]byte, nonce [8]byte, in []byte) []byte {
	// "expand 16-byte k": the 128-bit key is repeated, with tau interleaved.
	const tau0, tau1, tau2, tau3 = 0x61707865, 0x3120646e, 0x79622d36, 0x6b206574
	var state [16]uint32
	state[0] = tau0
	state[5] = tau1
	state[10] = tau2
	state[15] = tau3
	for i := range 4 {
		k := binary.LittleEndian.Uint32(key[4*i:])
		state[1+i] = k
		state[11+i] = k
	}
	state[6] = binary.LittleEndian.Uint32(nonce[0:])
	state[7] = binary.LittleEndian.Uint32(nonce[4:])

	out := make([]byte, len(in))
	var block [64]byte
	for pos := 0; pos < len(in); pos += 64 {
		salsa20Block(&block, &state)
		state[8]++
		if state[8] == 0 {
			state[9]++
		}
		n := min(64, len(in)-pos)
		for i := range n {
			out[pos+i] = in[pos+i] ^ block[i]
		}
	}
	return out
}

func salsa20Block(out *[64]byte, in *[16]uint32) {
	x := *in
	for range 10 {
		// column round
		x[4] ^= bits.RotateLeft32(x[0]+x[12], 7)
		x[8] ^= bits.RotateLeft32(x[4]+x[0], 9)
		x[12] ^= bits.RotateLeft32(x[8]+x[4], 13)
		x[0] ^= bits.RotateLeft32(x[12]+x[8], 18)
		x[9] ^= bits.RotateLeft32(x[5]+x[1], 7)
		x[13] ^= bits.RotateLeft32(x[9]+x[5], 9)
		x[1] ^= bits.RotateLeft32(x[13]+x[9], 13)
		x[5] ^= bits.RotateLeft32(x[1]+x[13], 18)
		x[14] ^= bits.RotateLeft32(x[10]+x[6], 7)
		x[2] ^= bits.RotateLeft32(x[14]+x[10], 9)
		x[6] ^= bits.RotateLeft32(x[2]+x[14], 13)
		x[10] ^= bits.RotateLeft32(x[6]+x[2], 18)
		x[3] ^= bits.RotateLeft32(x[15]+x[11], 7)
		x[7] ^= bits.RotateLeft32(x[3]+x[15], 9)
		x[11] ^= bits.RotateLeft32(x[7]+x[3], 13)
		x[15] ^= bits.RotateLeft32(x[11]+x[7], 18)
		// row round
		x[1] ^= bits.RotateLeft32(x[0]+x[3], 7)
		x[2] ^= bits.RotateLeft32(x[1]+x[0], 9)
		x[3] ^= bits.RotateLeft32(x[2]+x[1], 13)
		x[0] ^= bits.RotateLeft32(x[3]+x[2], 18)
		x[6] ^= bits.RotateLeft32(x[5]+x[4], 7)
		x[7] ^= bits.RotateLeft32(x[6]+x[5], 9)
		x[4] ^= bits.RotateLeft32(x[7]+x[6], 13)
		x[5] ^= bits.RotateLeft32(x[4]+x[7], 18)
		x[11] ^= bits.RotateLeft32(x[10]+x[9], 7)
		x[8] ^= bits.RotateLeft32(x[11]+x[10], 9)
		x[9] ^= bits.RotateLeft32(x[8]+x[11], 13)
		x[10] ^= bits.RotateLeft32(x[9]+x[8], 18)
		x[12] ^= bits.RotateLeft32(x[15]+x[14], 7)
		x[13] ^= bits.RotateLeft32(x[12]+x[15], 9)
		x[14] ^= bits.RotateLeft32(x[13]+x[12], 13)
		x[15] ^= bits.RotateLeft32(x[14]+x[13], 18)
	}
	for i := range x {
		binary.LittleEndian.PutUint32(out[4*i:], x[i]+in[i])
	}
}
