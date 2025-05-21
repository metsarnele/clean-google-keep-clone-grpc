#!/bin/bash

# Change to the project root directory
cd "$(dirname "$0")/.."

# Check if gRPC server is running
echo "Checking if gRPC server is running..."

if ! nc -z localhost 50051 &>/dev/null; then
  echo "gRPC server is not running. Starting gRPC server..."
  node src/index.js &
  GRPC_PID=$!
  echo "Started gRPC server with PID: $GRPC_PID"
  # Give the server time to start
  sleep 3
else
  echo "gRPC server is already running."
  GRPC_PID=""
fi

# Run the tests
echo "Running gRPC tests..."
node tests/test.js

# Store the test result
TEST_RESULT=$?

# Clean up server if we started it
if [ -n "$GRPC_PID" ]; then
  echo "Stopping gRPC server (PID: $GRPC_PID)..."
  kill $GRPC_PID
fi

# Exit with the test result
exit $TEST_RESULT

# Exit with the test result
exit $TEST_RESULT
