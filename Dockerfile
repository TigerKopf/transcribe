# Stage 1: Build the Angular application
FROM node:10.16.0 as build

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production environment
FROM node:10.16.0

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY --from=build /app/dist ./dist
COPY server.js .
COPY parser.js .

RUN mkdir ./keys && openssl genrsa -out ./keys/client-key.pem 2048 && openssl req -new -key ./keys/client-key.pem -out ./keys/client.csr -subj "/C=US/ST=CA/L=San Francisco/O=SF/OU=IT/CN=localhost" && openssl x509 -req -in ./keys/client.csr -signkey ./keys/client-key.pem -out ./keys/client-cert.pem

EXPOSE 8080

CMD ["node", "server.js"]
