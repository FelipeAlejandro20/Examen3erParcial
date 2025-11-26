FROM nginx:alpine

# Borramos la config por defecto (opcional pero recomendable)
RUN rm /etc/nginx/conf.d/default.conf

# Copiamos nuestra config
COPY nginx.conf /etc/nginx/conf.d/default.conf
