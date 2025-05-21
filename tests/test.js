import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

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

// Test data
const testUser = {
  username: `testuser_${Date.now()}`,
  password: 'password123'
};

// Store test data
let testData = {
  authToken: '',
  userId: '',
  noteId: '',
  tagId: ''
};

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

// Helper function to validate a response
function validateResponse(response, expectedFields) {
  for (const field of expectedFields) {
    if (typeof field === 'string') {
      assert(response[field] !== undefined, `Field ${field} should be present`);
    } else if (typeof field === 'object' && field.name && field.type) {
      assert(response[field.name] !== undefined, `Field ${field.name} should be present`);
      if (field.type === 'array') {
        assert(Array.isArray(response[field.name]), `Field ${field.name} should be an array`);
      } else if (field.type === 'object') {
        assert(typeof response[field.name] === 'object', `Field ${field.name} should be an object`);
      } else if (field.type === 'boolean') {
        assert(typeof response[field.name] === 'boolean', `Field ${field.name} should be a boolean`);
      }
    }
  }
  return true;
}

// Test registration
async function testRegistration() {
  console.log('=== Testing Registration ===');
  
  // gRPC API call
  const response = await callGrpcApi(authClient, 'register', testUser);
  console.log('gRPC Registration Response:', JSON.stringify(response, null, 2));
  
  // Store token and user ID for future requests
  testData.authToken = response.token;
  testData.userId = response.user.id;
  
  // Validate response
  const expectedFields = ['success', 'message', 'token', 'user'];
  assert(validateResponse(response, expectedFields));
  assert(response.success === true, 'Registration should be successful');
  
  console.log('✅ Registration test passed');
}

// Test login
async function testLogin() {
  console.log('\n=== Testing Login ===');
  
  // gRPC API call
  const response = await callGrpcApi(authClient, 'login', testUser);
  console.log('gRPC Login Response:', JSON.stringify(response, null, 2));
  
  // Store token for future requests
  testData.authToken = response.token;
  
  // Validate response
  const expectedFields = ['success', 'message', 'token', 'user'];
  assert(validateResponse(response, expectedFields));
  assert(response.success === true, 'Login should be successful');
  
  console.log('✅ Login test passed');
}

// Test create note
async function testCreateNote() {
  console.log('\n=== Testing Create Note ===');
  
  const noteData = {
    title: 'Test Note',
    content: 'This is a test note',
    tagIds: [],
    userId: testData.userId,
    color: '#f28b82'
  };
  
  // gRPC API call
  const response = await callGrpcApi(noteClient, 'createNote', noteData);
  console.log('gRPC Create Note Response:', JSON.stringify(response, null, 2));
  
  // Store note ID for future requests
  testData.noteId = response.note.id;
  
  // Validate response
  const expectedFields = ['success', 'message', { name: 'note', type: 'object' }];
  assert(validateResponse(response, expectedFields));
  assert(response.success === true, 'Note creation should be successful');
  assert(response.note.title === noteData.title, 'Note title should match');
  assert(response.note.content === noteData.content, 'Note content should match');
  
  console.log('✅ Create Note test passed');
}

// Test get notes
async function testGetNotes() {
  console.log('\n=== Testing Get Notes ===');
  
  // gRPC API call
  const response = await callGrpcApi(noteClient, 'getNotes', { userId: testData.userId });
  console.log('gRPC Get Notes Response:', JSON.stringify(response, null, 2));
  
  // Validate response
  const expectedFields = ['success', 'message', { name: 'notes', type: 'array' }];
  assert(validateResponse(response, expectedFields));
  assert(response.success === true, 'Getting notes should be successful');
  assert(response.notes.length > 0, 'Should return at least one note');
  
  console.log('✅ Get Notes test passed');
}

// Test create tag
async function testCreateTag() {
  console.log('\n=== Testing Create Tag ===');
  
  const tagData = {
    name: 'Test Tag',
    userId: testData.userId
  };
  
  // gRPC API call
  const response = await callGrpcApi(tagClient, 'createTag', tagData);
  console.log('gRPC Create Tag Response:', JSON.stringify(response, null, 2));
  
  // Store tag ID for future requests
  testData.tagId = response.tag.id;
  
  // Validate response
  const expectedFields = ['success', 'message', { name: 'tag', type: 'object' }];
  assert(validateResponse(response, expectedFields));
  assert(response.success === true, 'Tag creation should be successful');
  
  console.log('✅ Create Tag test passed');
}

// Test get tags
async function testGetTags() {
  console.log('\n=== Testing Get Tags ===');
  
  // gRPC API call
  const response = await callGrpcApi(tagClient, 'getTags', { userId: testData.userId });
  console.log('gRPC Get Tags Response:', JSON.stringify(response, null, 2));
  
  // Validate response
  const expectedFields = ['success', 'message', { name: 'tags', type: 'array' }];
  assert(validateResponse(response, expectedFields));
  assert(response.success === true, 'Getting tags should be successful');
  assert(response.tags.length > 0, 'Should return at least one tag');
  
  console.log('✅ Get Tags test passed');
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
    
    console.log('\n✅✅✅ All tests passed! gRPC API is working correctly.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();
