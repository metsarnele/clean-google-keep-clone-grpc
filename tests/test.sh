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

# Check if REST server is running
echo "Checking if REST server is running..."
if ! nc -z localhost 3001 &>/dev/null; then
  echo "REST server is not running. Starting REST server..."
  node src/rest.js &
  REST_PID=$!
  echo "Started REST server with PID: $REST_PID"
  # Give the server time to start
  sleep 3
else
  echo "REST server is already running."
  REST_PID=""
fi

# Run the tests
echo "Running comparative tests between REST and gRPC APIs..."
node tests/test.js

# Store the test result
TEST_RESULT=$?

# Clean up servers if we started them
if [ -n "$GRPC_PID" ]; then
  echo "Stopping gRPC server (PID: $GRPC_PID)..."
  kill $GRPC_PID
fi

if [ -n "$REST_PID" ]; then
  echo "Stopping REST server (PID: $REST_PID)..."
  kill $REST_PID
fi

# Exit with the test result
exit $TEST_RESULT

# Exit with the test result
exit $TEST_RESULT
