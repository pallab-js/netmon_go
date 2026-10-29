# Ubuntu 24.04+ ships webkit2gtk-4.1 only, so the tag is mandatory on every build.
TAGS := webkit2_41

.PHONY: dev build run test tidy clean

dev:
	wails dev -tags $(TAGS)

build:
	wails build -tags $(TAGS)

run: build
	./build/bin/netscope

test:
	go test ./...

tidy:
	go mod tidy

clean:
	rm -rf build/bin
