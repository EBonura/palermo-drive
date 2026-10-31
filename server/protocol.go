package main

// Palermo Drive relay protocol, version 1. All messages are WebSocket binary frames, little endian.
// (Statistics use a separate plain HTTP endpoint, POST /ping, see stats.go.)
//
// Client to server
//   0x01 INFO   [type][livery u8][nameLen u8][name utf8, at most 64 bytes]   on join and when name or livery change
//   0x02 STATE  [type][STATE 10 bytes]                                       about 8-10 Hz, only when something changed
//   0x03 PING   [type]                                                       every ~10 s of silence
//
// Server to client
//   0x20 WELCOME [type][version u8][yourId u8][maxPlayers u8]
//   0x21 COUNT   [type][playersInRoom u8]                                    when it changes
//   0x22 INFO    [type][id u8][livery u8][nameLen u8][name]                   a player entered your interest radius, or changed
//   0x23 REMOVE  [type][id u8]                                               a player left your interest radius or the room
//   0x24 STATES  [type][n u8] then n times [id u8][STATE 10 bytes]            batched, one frame per receiver per tick
//   0x25 BEAT    [type]                                                       keep-alive when nothing else was sent for a while
//
// STATE (10 bytes): x i16, z i16 (units of 0.1 m from the world origin, Quattro Canti, +x east, +z south),
//   heading u8 (0..255 = 0..2pi), speed i8 (units of 0.5 m/s, signed, along the heading), steer i8 (-127..127 = -0.7..0.7 rad),
//   roll i8 (-127..127 = -0.5..0.5 rad), lean i8 (signed tip amount, -127..127 = -1..1), flags u8 (bit0 nitro, bit1 brake, bit2 handbrake).

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	protoVersion = 1
	maxPlayers   = 32
	maxNameRunes = 16
	maxNameBytes = 64
	maxLivery    = 15
	stateLen     = 10

	cInfo  = 0x01
	cState = 0x02
	cPing  = 0x03

	sWelcome = 0x20
	sCount   = 0x21
	sInfo    = 0x22
	sRemove  = 0x23
	sStates  = 0x24
	sBeat    = 0x25
)

// cleanName strips control, format and layout characters, collapses spaces, limits the length to 16 runes
// and drops runaway combining marks. It returns "" for invalid UTF-8.
func cleanName(b []byte) string {
	if len(b) > maxNameBytes || !utf8.Valid(b) {
		return ""
	}
	out := make([]rune, 0, maxNameRunes)
	prevMark := false
	for _, r := range string(b) {
		switch {
		case unicode.IsSpace(r):
			if len(out) > 0 && out[len(out)-1] != ' ' {
				out = append(out, ' ')
			}
			prevMark = false
		case unicode.IsControl(r), unicode.Is(unicode.Cf, r), unicode.Is(unicode.Co, r), unicode.Is(unicode.Cs, r), r == utf8.RuneError, r == 0x2028, r == 0x2029:
			// dropped
		case unicode.Is(unicode.Mn, r) || unicode.Is(unicode.Me, r):
			if len(out) > 0 && !prevMark {
				out = append(out, r)
				prevMark = true
			}
		default:
			out = append(out, r)
			prevMark = false
		}
		if len(out) >= maxNameRunes {
			break
		}
	}
	return strings.TrimSpace(string(out))
}

// A deliberately tiny block list (slurs only). Substring match on a letters-only, de-leetspeaked copy of the name.
var blocked = []string{"nazi", "hitler", "nigg", "fuck", "cunt", "faggot", "puttana", "negro di merda"}

func isBlocked(name string) bool {
	var sb strings.Builder
	for _, r := range strings.ToLower(name) {
		switch r {
		case '0':
			r = 'o'
		case '1', '!', '|':
			r = 'i'
		case '3':
			r = 'e'
		case '4', '@':
			r = 'a'
		case '5', '$':
			r = 's'
		}
		if unicode.IsLetter(r) {
			sb.WriteRune(r)
		}
	}
	s := sb.String()
	for _, w := range blocked {
		if strings.Contains(s, strings.ReplaceAll(w, " ", "")) {
			return true
		}
	}
	return false
}
