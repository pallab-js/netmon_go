# Ubuntu 24.04+ ships webkit2gtk-4.1 only, so the tag is mandatory on every build.
TAGS := webkit2_41
WAILS := go run github.com/wailsapp/wails/v2/cmd/wails@v2.17.0

.PHONY: dev build run test tidy clean

dev:
	$(WAILS) dev -tags $(TAGS)

build:
	$(WAILS) build -tags $(TAGS)

run: build
	./build/bin/netscope

test:
	go test ./...

tidy:
	go mod tidy

clean:
	rm -rf build/bin
