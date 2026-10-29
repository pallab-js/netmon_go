package collect

import "testing"

func TestRate(t *testing.T) {
	cases := []struct {
		name  string
		prev  uint64
		cur   uint64
		first bool
		dt    float64
		want  uint64
		rate  float64
	}{
		{name: "first sample is zero", prev: 0, cur: 999, first: true, dt: 1, want: 0, rate: 0},
		{name: "normal delta", prev: 1000, cur: 3000, dt: 2, want: 2000, rate: 1000},
		{name: "counter reset counts new value", prev: 5000, cur: 120, dt: 1, want: 120, rate: 120},
		{name: "zero interval does not divide", prev: 100, cur: 200, dt: 0, want: 100, rate: 0},
		{name: "absurd delta is clamped", prev: 0, cur: 1 << 40, dt: 1, want: 1 << 40, rate: maxRate},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			gotDelta, gotRate := rate(c.prev, c.cur, c.first, c.dt)
			if gotDelta != c.want {
				t.Fatalf("delta = %d, want %d", gotDelta, c.want)
			}
			if gotRate != c.rate {
				t.Fatalf("rate = %v, want %v", gotRate, c.rate)
			}
		})
	}
}
