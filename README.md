# Google Keep Clone gRPC API

## Project Overview

This project implements a gRPC version of the Google Keep Clone API. It demonstrates how to model REST endpoints as gRPC services while maintaining identical business logic and error handling.

## Prerequisites

- Node.js (v14 or later) - [Download](https://nodejs.org/)
- npm (comes with Node.js)

## Project Structure

```
/project-root
 ├── proto/             # Protocol Buffer definitions
 ├── src/               # Source code
 ├── scripts/run.sh     # Build and run script
 ├── client/example.js  # Client example
 ├── tests/test.sh      # Automated tests
 └── README.md          # This file
```

## Building and Running

### Quick Start

To build and run the gRPC server with a single command:

```sh
./scripts/run.sh
```

This script will:
1. Check for required dependencies
2. Install npm packages if needed
3. Set up data directories
4. Use dynamic loading of Protocol Buffer definitions
5. Start the gRPC server on port 50051

### Manual Setup

1. **Install dependencies**
   ```sh
   npm install
   ```

2. **Create environment file**
   
   Create a `.env` file in the root directory with the following content:
   ```
   SECRET_KEY=your_secret_key_for_jwt_tokens
   GRPC_PORT=50051
   ```
   
   **IMPORTANT**: You MUST replace `your_secret_key_for_jwt_tokens` with an actual string value (e.g., `my_secure_jwt_secret_123`). The application will not work if you leave the placeholder text as is.

3. **No need to compile Protocol Buffers**
   
   This implementation uses `@grpc/proto-loader` which dynamically loads and parses proto files at runtime.

4. **Start the gRPC server**
   ```sh
   node src/index.js
   ```

   The gRPC server will start at:
   ```
   localhost:50051
   ```

## Testing

### Automated Tests

To run the automated tests that verify the functional equivalence between the REST and gRPC APIs:

```sh
./tests/test.sh
```

**Important Prerequisites for Testing:**
- Make sure you've created a valid `.env` file as described in the setup section above
- The `.env` file MUST have a real value for SECRET_KEY, not the placeholder text

The test script will:
1. Check if the `.env` file exists and has a valid SECRET_KEY (it will create a temporary one for testing if needed)
2. Start the gRPC server if it's not already running (port 50051)
3. Start the REST server if it's not already running (port 3001)
4. Run a series of comparative tests that validate both APIs produce equivalent responses
5. Verify that all CRUD operations work identically in both implementations
6. Shut down both servers if it started them

#### Test Coverage

The automated tests validate functional equivalence for the following operations:

- **Authentication**
  - User registration
  - User login
  - User logout

- **Notes Management**
  - Create note
  - Get all notes
  - Update note
  - Delete note

- **Tags Management**
  - Create tag
  - Get all tags
  - Delete tag

### Manual Testing

**Interactive client**
```sh
node client/example.js
```

This provides a command-line interface to test all gRPC endpoints.

