#!/bin/bash

# Navigate to the project root directory
cd "$(dirname "$0")/.."

# Check if node is installed
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed. Please install Node.js."
  echo "Visit https://nodejs.org/ for installation instructions."
  exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
  echo "Creating data directory..."
  mkdir -p data
  
  # Create empty data files
  echo "Creating empty data files..."
  echo "[]" > data/users.json
  echo "[]" > data/notes.json
  echo "[]" > data/tags.json
  echo "[]" > data/blacklist.json
fi

# Start gRPC server
echo "Starting gRPC server on port 50051..."
node src/index.js &
GRPC_PID=$!

# Wait for gRPC server to start
sleep 2
echo "gRPC server started with PID: $GRPC_PID"
echo "gRPC server: localhost:50051"

# Function to handle termination
cleanup() {
  echo "Shutting down gRPC server..."
  kill $GRPC_PID
  exit 0
}

# Register the cleanup function for termination signals
trap cleanup SIGINT SIGTERM

# Keep the script running
echo "Press Ctrl+C to stop the server."
wait
