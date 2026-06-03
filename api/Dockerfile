# syntax=docker/dockerfile:1.7

# --- Stage 1: build the static binary ---
FROM golang:1.22-alpine AS builder

WORKDIR /src

# Cache modules separately from source so deps don't redownload on every code change.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO disabled → pure-Go binary that can run on distroless/static.
# -s -w strips debug symbols, shrinking the image by ~30%.
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /out/dmc-api ./

# --- Stage 2: runtime ---
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /out/dmc-api /dmc-api

EXPOSE 8080
USER nonroot:nonroot

ENTRYPOINT ["/dmc-api"]
