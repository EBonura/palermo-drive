# Build: docker build -t relay .   (deploy.sh does this with Cloud Build, or locally with BUILD=local)
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /relay .

# distroless static: no shell, no package manager, runs as non-root. The image is about 6 MB.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /relay /relay
ENV GOMEMLIMIT=400MiB
EXPOSE 8080
ENTRYPOINT ["/relay"]
