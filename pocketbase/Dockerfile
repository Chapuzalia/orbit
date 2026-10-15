FROM alpine:3.22
ARG PB_VERSION=0.40.5
ARG TARGETARCH=amd64
RUN apk add --no-cache ca-certificates tzdata wget unzip \
    && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pocketbase.zip \
    && mkdir -p /app \
    && unzip -q /tmp/pocketbase.zip pocketbase -d /app \
    && rm /tmp/pocketbase.zip
WORKDIR /app
COPY pb_migrations /app/pb_migrations
COPY pb_hooks /app/pb_hooks
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["/app/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8080", "--dir=/app/pb_data", "--migrationsDir=/app/pb_migrations", "--hooksDir=/app/pb_hooks", "--automigrate=0"]
