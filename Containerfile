# ─────────────────────────────────────────
#  Stellar Dashboard — Containerfile
#  Rootless Podman on AlmaLinux 9
# ─────────────────────────────────────────
FROM node:20-alpine

# Install build tools needed for better-sqlite3
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files first (better layer caching)
COPY backend/package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy backend source
COPY backend/ ./

# Force nodemailer to patched version
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.dependencies.nodemailer='8.0.5';fs.writeFileSync('package.json',JSON.stringify(p,null,2));" && npm install nodemailer@8.0.5

# Copy frontend (served as static files by Express)
COPY frontend/ ./frontend/

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose the app port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
