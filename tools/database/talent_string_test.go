package database

import "testing"

func TestMaxedTalentsStringMirrorsTheUICodec(t *testing.T) {
	talents := func(points ...int) []TalentConfig {
		out := make([]TalentConfig, 0, len(points))
		for _, p := range points {
			out = append(out, TalentConfig{MaxPoints: p})
		}
		return out
	}
	cases := []struct {
		name string
		tabs []TalentTabConfig
		want string
	}{
		{"one digit per talent, tree order", []TalentTabConfig{{Talents: talents(3, 5, 1)}, {Talents: talents(2, 2)}}, "351-22"},
		{"an empty middle tree keeps its dash", []TalentTabConfig{{Talents: talents(5)}, {Talents: nil}, {Talents: talents(1)}}, "5--1"},
		{"trailing dashes go", []TalentTabConfig{{Talents: talents(5)}, {Talents: nil}, {Talents: nil}}, "5"},
		{"nothing at all", nil, ""},
	}
	for _, c := range cases {
		if got := MaxedTalentsString(c.tabs); got != c.want {
			t.Errorf("%s: %q, want %q", c.name, got, c.want)
		}
	}
}
