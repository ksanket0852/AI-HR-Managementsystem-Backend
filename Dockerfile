# Use Node.js 18 Alpine
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache python3 make g++ openssl

# Copy package files and Prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install --no-audit --no-fund

# Generate Prisma client after dependencies are installed
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Verify build output
RUN ls -la dist/

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
