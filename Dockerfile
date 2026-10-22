FROM php:8.3-apache
RUN docker-php-ext-install pdo_mysql
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY public /var/www/html/public
COPY src /var/www/html/src
RUN printf 'expose_php=Off\nupload_max_filesize=8M\npost_max_size=8M\ndisplay_errors=Off\n' > /usr/local/etc/php/conf.d/app.ini
