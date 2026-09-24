FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf security-headers.conf /etc/nginx/
COPY index.html 404.html 50x.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/

# cs2.laine.lol's listing UI (cs2-site/) and the .zip builds are both bind-mounted
# at runtime (see docker-compose.yml), so nothing cs2-related is baked in here.

EXPOSE 80
