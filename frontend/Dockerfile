# ---------- Stage 1: Build (no build step needed for vanilla assets, but
# kept as a separate stage to allow future asset pipelines / minification) ----------
FROM node:20-alpine AS build

WORKDIR /app
COPY . .

# Placeholder for future build tooling (e.g. minifiers/bundlers).
# Currently just validates the static assets exist.
RUN test -f index.html && test -d css && test -d js

# ---------- Stage 2: Serve with Nginx ----------
FROM nginx:1.27-alpine AS final

RUN addgroup -S webapp && adduser -S webapp -G webapp

COPY --from=build /app/index.html /usr/share/nginx/html/index.html
COPY --from=build /app/css /usr/share/nginx/html/css
COPY --from=build /app/js /usr/share/nginx/html/js
COPY nginx.conf /etc/nginx/nginx.conf

RUN chown -R webapp:webapp /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx \
    && touch /var/run/nginx.pid \
    && chown -R webapp:webapp /var/run/nginx.pid

USER webapp

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
