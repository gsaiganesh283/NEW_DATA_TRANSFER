FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy app source
COPY . .

# Create data directory for user storage
RUN mkdir -p /app/data /app/uploads

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
