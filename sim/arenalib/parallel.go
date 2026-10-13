package arenalib

import (
	"runtime"
	"sync"
)

// The arena is a few thousand independent sim runs, and a sim run is single threaded. On a
// CI runner with four cores that distinction barely paid; on the host the long searches
// moved to it is most of the wall clock.
//
// Across builds rather than inside one. core.RunRaidSimConcurrent exists and would split a
// single build's iterations over every core, but it changes the random streams and so
// changes the published number - and it splits into three, not NumCPU, whenever IsTest is
// set, which the arena needs for panics to propagate instead of being swallowed. Running
// whole builds side by side leaves every number bit for bit what it was.
//
// GOMAXPROCS rather than NumCPU so `go test -p` and a container CPU limit are both obeyed.
func workers() int {
	if n := runtime.GOMAXPROCS(0); n > 1 {
		return n
	}
	return 1
}

// Applies f to every index, on every core, and returns the results in order.
func parallelMap[T any](n int, f func(i int) T) []T {
	out := make([]T, n)
	if n <= 1 {
		for i := 0; i < n; i++ {
			out[i] = f(i)
		}
		return out
	}

	next := make(chan int, n)
	for i := 0; i < n; i++ {
		next <- i
	}
	close(next)

	var wg sync.WaitGroup
	for w := 0; w < min(workers(), n); w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range next {
				out[i] = f(i)
			}
		}()
	}
	wg.Wait()
	return out
}
