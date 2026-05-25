# Stage 1: Build the React bundle
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Custom nginx configuration (optional, defaults are fine for simple routing)
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
