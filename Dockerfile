# Stage 1: Build the Angular application
WORKDIR /app
ENV NODE_OPTIONS=--openssl-legacy-provider

# Copy package configuration and install all dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the application source code
COPY . .

# Generate the production build of the application
RUN npm run build -- --configuration production


# Stage 2: Setup the production environment and run the server
FROM node:18-alpine
ENV NODE_OPTIONS=--openssl-legacy-provider
WORKDIR /app

# Copy package configuration and install only production dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev

# Copy the built application from the build stage
COPY --from=build /app/dist ./dist

# Copy the server script
COPY server.js .

# The server requires SSL certificates, let's generate them
# Note: These are self-signed certificates for development/testing.
# For a real production environment, you should use certificates from a trusted CA.
RUN npm run generate

# Expose the port the server will run on
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
