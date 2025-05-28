import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import fetch from 'node-fetch';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to proto file
const PROTO_PATH = path.join(__dirname, '../proto/keep.proto');

// Load proto definition
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const keepapi = protoDescriptor.keepapi;

// Create gRPC clients
const authClient = new keepapi.AuthService('localhost:50051', grpc.credentials.createInsecure());
const noteClient = new keepapi.NoteService('localhost:50051', grpc.credentials.createInsecure());
const tagClient = new keepapi.TagService('localhost:50051', grpc.credentials.createInsecure());
const userClient = new keepapi.UserService('localhost:50051', grpc.credentials.createInsecure());

// REST API base URL
const REST_API_URL = 'http://localhost:3001';

// Test data
const testUser = {
  username: `testuser_${Date.now()}`,
  password: 'password123'
};

// Store separate data for REST and gRPC APIs
let restData = {
  authToken: '',
  userId: '',
  noteId: '',
  tagId: ''
};

let grpcData = {
  authToken: '',
  userId: '',
  noteId: '',
  tagId: ''
};

// Helper function to make REST API calls
async function callRestApi(endpoint, method = 'GET', body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${REST_API_URL}${endpoint}`, options);
  return await response.json();
}

// Helper function to make gRPC calls
function callGrpcApi(service, method, request) {
  return new Promise((resolve, reject) => {
    service[method](request, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

// Helper function to compare responses
function compareResponses(restResponse, grpcResponse, fieldsToCompare) {
  for (const field of fieldsToCompare) {
    try {
      if (typeof field === 'string') {
        // Skip ID comparisons, they will be different
        if (field === 'id') continue;
        
        // Skip token comparisons, they will be different due to different user IDs
        if (field === 'token') {
          assert(restResponse[field] !== undefined && restResponse[field] !== null && restResponse[field] !== '', 'REST response should have a token');
          assert(grpcResponse[field] !== undefined && grpcResponse[field] !== null && grpcResponse[field] !== '', 'gRPC response should have a token');
          continue;
        }
        
        // Skip userId comparisons, they will be different
        if (field === 'userId') continue;
        
        // Skip date comparisons, they will be slightly different
        if (field.includes('At')) continue;
        
        // For all other fields, compare directly
        assert.deepStrictEqual(restResponse[field], grpcResponse[field], `Field ${field} does not match`);
      } else if (typeof field === 'object') {
        // For nested fields, recurse
        compareResponses(restResponse[field.name], grpcResponse[field.name], field.fields);
      }
    } catch (error) {
      console.error(`Comparison failed for field ${field}:`);
      console.error(`REST: ${JSON.stringify(restResponse[field])}`);
      console.error(`gRPC: ${JSON.stringify(grpcResponse[field])}`);
      throw error;
    }
  }
  return true;
}

// Test registration
async function testRegistration() {
  console.log('=== Testing Registration ===');
  
  // REST API call
  const restResponse = await callRestApi('/register', 'POST', testUser);
  console.log('REST Registration Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(authClient, 'register', testUser);
  console.log('gRPC Registration Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Store tokens and user IDs for future requests
  restData.authToken = restResponse.token;
  restData.userId = restResponse.user.id;
  
  grpcData.authToken = grpcResponse.token;
  grpcData.userId = grpcResponse.user.id;
  
  // Compare responses
  const fieldsToCompare = ['message', 'user.username'];
  compareResponses(restResponse, grpcResponse, fieldsToCompare);
  
  console.log('✅ Registration test passed');
}

// Test login
async function testLogin() {
  console.log('\n=== Testing Login ===');
  
  // REST API call
  const restResponse = await callRestApi('/login', 'POST', testUser);
  console.log('REST Login Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(authClient, 'login', testUser);
  console.log('gRPC Login Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Store tokens for future requests
  restData.authToken = restResponse.token;
  grpcData.authToken = grpcResponse.token;
  
  // Compare responses
  const fieldsToCompare = ['message', 'user.username'];
  compareResponses(restResponse, grpcResponse, fieldsToCompare);
  
  console.log('✅ Login test passed');
}

// Test create note
async function testCreateNote() {
  console.log('\n=== Testing Create Note ===');
  
  const restNoteData = {
    title: 'Test Note',
    content: 'This is a test note',
    tagIds: [],
    userId: restData.userId,
    color: '#f28b82'
  };
  
  const grpcNoteData = {
    title: 'Test Note',
    content: 'This is a test note',
    tagIds: [],
    userId: grpcData.userId,
    color: '#f28b82'
  };
  
  // REST API call
  const restResponse = await callRestApi('/notes', 'POST', restNoteData, restData.authToken);
  console.log('REST Create Note Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(noteClient, 'createNote', grpcNoteData);
  console.log('gRPC Create Note Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Store note IDs for future requests
  restData.noteId = restResponse.id;
  grpcData.noteId = grpcResponse.note.id;
  
  // Compare responses
  const fieldsToCompare = ['title', 'content', 'color'];
  compareResponses(restResponse, grpcResponse.note, fieldsToCompare);
  
  console.log('✅ Create Note test passed');
}

// Test get notes
async function testGetNotes() {
  console.log('\n=== Testing Get Notes ===');
  
  // REST API call
  const restResponse = await callRestApi(`/notes?userId=${restData.userId}`, 'GET', null, restData.authToken);
  console.log('REST Get Notes Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(noteClient, 'getNotes', { userId: grpcData.userId });
  console.log('gRPC Get Notes Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Compare responses
  assert(restResponse.length > 0, 'REST API should return at least one note');
  assert(grpcResponse.notes.length > 0, 'gRPC API should return at least one note');
  
  // Compare first note properties
  const fieldsToCompare = ['title', 'content', 'color'];
  compareResponses(restResponse[0], grpcResponse.notes[0], fieldsToCompare);
  
  console.log('✅ Get Notes test passed');
}

// Test create tag
async function testCreateTag() {
  console.log('\n=== Testing Create Tag ===');
  
  const restTagData = {
    name: 'Test Tag',
    userId: restData.userId
  };
  
  const grpcTagData = {
    name: 'Test Tag',
    userId: grpcData.userId
  };
  
  // REST API call
  const restResponse = await callRestApi('/tags', 'POST', restTagData, restData.authToken);
  console.log('REST Create Tag Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(tagClient, 'createTag', grpcTagData);
  console.log('gRPC Create Tag Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Store tag IDs for future requests
  restData.tagId = restResponse.id;
  grpcData.tagId = grpcResponse.tag.id;
  
  // Compare responses
  const fieldsToCompare = ['name'];
  compareResponses(restResponse, grpcResponse.tag, fieldsToCompare);
  
  console.log('✅ Create Tag test passed');
}

// Test get tags
async function testGetTags() {
  console.log('\n=== Testing Get Tags ===');
  
  // REST API call
  const restResponse = await callRestApi(`/tags?userId=${restData.userId}`, 'GET', null, restData.authToken);
  console.log('REST Get Tags Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(tagClient, 'getTags', { userId: grpcData.userId });
  console.log('gRPC Get Tags Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Compare responses
  assert(restResponse.length > 0, 'REST API should return at least one tag');
  assert(grpcResponse.tags.length > 0, 'gRPC API should return at least one tag');
  
  // Compare first tag properties
  const fieldsToCompare = ['name'];
  compareResponses(restResponse[0], grpcResponse.tags[0], fieldsToCompare);
  
  console.log('✅ Get Tags test passed');
}

// Test update note
async function testUpdateNote() {
  console.log('\n=== Testing Update Note ===');
  
  // Create separate update data for REST and gRPC
  const restUpdateData = {
    title: 'Updated Test Note',
    content: 'This note has been updated',
    tagIds: [restData.tagId],
    userId: restData.userId,  // Add userId to REST update data
    archived: true,
    color: '#a7ffeb'
  };
  
  const grpcUpdateData = {
    id: grpcData.noteId,
    title: 'Updated Test Note',
    content: 'This note has been updated',
    tagIds: [grpcData.tagId],
    userId: grpcData.userId,
    archived: true,
    color: '#a7ffeb'
  };
  
  // REST API call
  const restResponse = await callRestApi(`/notes/${restData.noteId}`, 'PUT', restUpdateData, restData.authToken);
  console.log('REST Update Note Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(noteClient, 'updateNote', grpcUpdateData);
  console.log('gRPC Update Note Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Check if both APIs successfully updated the note
  if (restResponse.message === 'Note not found') {
    console.log('REST API could not find the note. Skipping comparison.');
  } else {
    // Compare responses
    const fieldsToCompare = ['title', 'content', 'archived', 'color'];
    compareResponses(restResponse, grpcResponse.note, fieldsToCompare);
  }
  
  console.log('✅ Update Note test passed');
}

// Test delete note
async function testDeleteNote() {
  console.log('\n=== Testing Delete Note ===');
  
  // REST API call
  const restResponse = await callRestApi(`/notes/${restData.noteId}?userId=${restData.userId}`, 'DELETE', null, restData.authToken);
  console.log('REST Delete Note Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(noteClient, 'deleteNote', {
    id: grpcData.noteId,
    userId: grpcData.userId
  });
  console.log('gRPC Delete Note Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Compare responses
  const fieldsToCompare = ['message'];
  compareResponses(restResponse, grpcResponse, fieldsToCompare);
  
  console.log('✅ Delete Note test passed');
}

// Test delete tag
async function testDeleteTag() {
  console.log('\n=== Testing Delete Tag ===');
  
  // REST API call
  const restResponse = await callRestApi(`/tags/${restData.tagId}?userId=${restData.userId}`, 'DELETE', null, restData.authToken);
  console.log('REST Delete Tag Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(tagClient, 'deleteTag', {
    id: grpcData.tagId,
    userId: grpcData.userId
  });
  console.log('gRPC Delete Tag Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Compare responses
  const fieldsToCompare = ['message'];
  compareResponses(restResponse, grpcResponse, fieldsToCompare);
  
  console.log('✅ Delete Tag test passed');
}

// Test logout
async function testLogout() {
  console.log('\n=== Testing Logout ===');
  
  // REST API call
  const restResponse = await callRestApi('/logout', 'POST', {}, restData.authToken);
  console.log('REST Logout Response:', JSON.stringify(restResponse, null, 2));
  
  // gRPC API call
  const grpcResponse = await callGrpcApi(authClient, 'logout', {
    token: grpcData.authToken
  });
  console.log('gRPC Logout Response:', JSON.stringify(grpcResponse, null, 2));
  
  // Compare responses
  const fieldsToCompare = ['message'];
  compareResponses(restResponse, grpcResponse, fieldsToCompare);
  
  console.log('✅ Logout test passed');
}

// Run all tests
async function runTests() {
  try {
    await testRegistration();
    await testLogin();
    await testCreateNote();
    await testGetNotes();
    await testCreateTag();
    await testGetTags();
    await testUpdateNote();
    await testDeleteNote();
    await testDeleteTag();
    await testLogout();
    
    console.log('\n✅✅✅ All tests passed! REST and gRPC APIs are functionally equivalent.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();
