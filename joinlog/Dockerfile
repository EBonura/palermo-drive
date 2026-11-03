FROM rust:1-alpine AS build
RUN apk add --no-cache musl-dev
WORKDIR /s
COPY Cargo.toml Cargo.lock ./
COPY src src
RUN cargo build --release --locked

FROM scratch
COPY --from=build /s/target/release/joinlog /joinlog
USER 10001
ENTRYPOINT ["/joinlog"]
