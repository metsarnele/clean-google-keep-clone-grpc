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

2. **No need to compile Protocol Buffers**
   
   This implementation uses `@grpc/proto-loader` which dynamically loads and parses proto files at runtime.

3. **Start the gRPC server**
   ```sh
   node src/index.js
   ```

   The gRPC server will start at:
   ```
   localhost:50051
   ```

## Testing

### Automated Tests

To run the automated tests that verify the gRPC API functionality:

```sh
./tests/test.sh
```

This script will:
1. Start the gRPC server if it's not already running
2. Run a series of tests that validate the gRPC API responses
3. Verify that error handling is working correctly
4. Shut down the server if it started it

### Manual Testing

**Interactive client**
```sh
node client/example.js
```

This provides a command-line interface to test all gRPC endpoints.

## Protocol Buffer Definition

The `proto/keep.proto` file defines all services and messages used by the gRPC implementation. It models the original REST API endpoints as follows:

| REST Endpoint | HTTP Method | gRPC Service | RPC Method |
|---------------|-------------|--------------|------------|
| /register     | POST        | AuthService  | Register   |
| /login        | POST        | AuthService  | Login      |
| /logout       | POST        | AuthService  | Logout     |
| /notes        | GET         | NoteService  | GetNotes   |
| /notes/:id    | GET         | NoteService  | GetNote    |
| /notes        | POST        | NoteService  | CreateNote |
| /notes/:id    | PUT         | NoteService  | UpdateNote |
| /notes/:id    | DELETE      | NoteService  | DeleteNote |
| /tags         | GET         | TagService   | GetTags    |
| /tags/:id     | GET         | TagService   | GetTag     |
| /tags         | POST        | TagService   | CreateTag  |
| /tags/:id     | PUT         | TagService   | UpdateTag  |
| /tags/:id     | DELETE      | TagService   | DeleteTag  |
| /users/:id    | GET         | UserService  | GetUser    |
| /users/:id    | PUT         | UserService  | UpdateUser |
| /users/:id    | DELETE      | UserService  | DeleteUser |

## Error Handling

The gRPC implementation uses standardized error responses that match the REST API's error handling. Each response includes:

- `success` - Boolean indicating success/failure
- `message` - Human-readable error message
- Additional context-specific fields when appropriate

## Data Independence

This implementation maintains its own data files, separate from the original REST API:

- Users, notes, tags, and authentication data are stored in the `data/` directory
- The first run will migrate data from the original REST API if available
- Subsequent runs use the independent data storage

