import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Store user session
let currentUser = null;
let authToken = null;

// Helper function to prompt user
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Helper function to display menu
const displayMenu = () => {
  console.log('\n===== Google Keep gRPC Client =====');
  if (currentUser) {
    console.log(`Logged in as: ${currentUser.username} (${currentUser.id})`);
  }
  console.log('\n1. Register');
  console.log('2. Login');
  console.log('3. Logout');
  console.log('4. Get Notes');
  console.log('5. Get Note');
  console.log('6. Create Note');
  console.log('7. Update Note');
  console.log('8. Delete Note');
  console.log('9. Get Tags');
  console.log('10. Create Tag');
  console.log('11. Update Tag');
  console.log('12. Delete Tag');
  console.log('13. Get User');
  console.log('14. Update User');
  console.log('15. Delete User');
  console.log('0. Exit');
  return prompt('\nSelect an option: ');
};

// Register user
const register = async () => {
  const username = await prompt('Username: ');
  const password = await prompt('Password: ');

  return new Promise((resolve, reject) => {
    authClient.register({ username, password }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      if (response.success) {
        currentUser = response.user;
        authToken = response.token;
      }
      resolve(response);
    });
  });
};

// Login user
const login = async () => {
  const username = await prompt('Username: ');
  const password = await prompt('Password: ');

  return new Promise((resolve, reject) => {
    authClient.login({ username, password }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      if (response.success) {
        currentUser = response.user;
        authToken = response.token;
      }
      resolve(response);
    });
  });
};

// Logout user
const logout = async () => {
  if (!authToken) {
    return { success: false, message: 'Not logged in' };
  }

  return new Promise((resolve, reject) => {
    authClient.logout({ token: authToken }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      if (response.success) {
        currentUser = null;
        authToken = null;
      }
      resolve(response);
    });
  });
};

// Get notes
const getNotes = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const archivedInput = await prompt('Show archived notes? (y/n): ');
  const archived = archivedInput.toLowerCase() === 'y';
  const tagId = await prompt('Filter by tag ID (leave empty for all): ');

  return new Promise((resolve, reject) => {
    noteClient.getNotes({
      userId: currentUser.id,
      archived,
      tagId: tagId || undefined
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Get note
const getNote = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const id = await prompt('Note ID: ');

  return new Promise((resolve, reject) => {
    noteClient.getNote({
      id,
      userId: currentUser.id
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Create note
const createNote = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const title = await prompt('Title: ');
  const content = await prompt('Content: ');
  const tagIdsInput = await prompt('Tag IDs (comma separated): ');
  const tagIds = tagIdsInput ? tagIdsInput.split(',').map(id => id.trim()) : [];
  const color = await prompt('Color (hex, default #ffffff): ');

  return new Promise((resolve, reject) => {
    noteClient.createNote({
      title,
      content,
      tagIds,
      userId: currentUser.id,
      color: color || '#ffffff'
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Update note
const updateNote = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const id = await prompt('Note ID: ');
  const title = await prompt('New title (leave empty to keep current): ');
  const content = await prompt('New content (leave empty to keep current): ');
  const tagIdsInput = await prompt('New tag IDs (comma separated, leave empty to keep current): ');
  const tagIds = tagIdsInput ? tagIdsInput.split(',').map(id => id.trim()) : undefined;
  const archivedInput = await prompt('Archive note? (y/n/empty to keep current): ');
  const archived = archivedInput ? archivedInput.toLowerCase() === 'y' : undefined;
  const color = await prompt('New color (hex, leave empty to keep current): ');

  return new Promise((resolve, reject) => {
    noteClient.updateNote({
      id,
      title: title || undefined,
      content: content || undefined,
      tagIds,
      userId: currentUser.id,
      archived,
      color: color || undefined
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Delete note
const deleteNote = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const id = await prompt('Note ID: ');

  return new Promise((resolve, reject) => {
    noteClient.deleteNote({
      id,
      userId: currentUser.id
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Get tags
const getTags = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  return new Promise((resolve, reject) => {
    tagClient.getTags({
      userId: currentUser.id
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Create tag
const createTag = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const name = await prompt('Tag name: ');

  return new Promise((resolve, reject) => {
    tagClient.createTag({
      name,
      userId: currentUser.id
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Update tag
const updateTag = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const id = await prompt('Tag ID: ');
  const name = await prompt('New tag name: ');

  return new Promise((resolve, reject) => {
    tagClient.updateTag({
      id,
      name,
      userId: currentUser.id
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Delete tag
const deleteTag = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const id = await prompt('Tag ID: ');

  return new Promise((resolve, reject) => {
    tagClient.deleteTag({
      id,
      userId: currentUser.id
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Get user
const getUser = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  return new Promise((resolve, reject) => {
    userClient.getUser({
      id: currentUser.id
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
};

// Update user
const updateUser = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const username = await prompt('New username (leave empty to keep current): ');
  const password = await prompt('New password (leave empty to keep current): ');

  return new Promise((resolve, reject) => {
    userClient.updateUser({
      id: currentUser.id,
      username: username || undefined,
      password: password || undefined
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      if (response.success && username) {
        currentUser.username = username;
      }
      resolve(response);
    });
  });
};

// Delete user
const deleteUser = async () => {
  if (!currentUser) {
    return { success: false, message: 'Not logged in' };
  }

  const confirm = await prompt('Are you sure you want to delete your account? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    return { success: false, message: 'Operation cancelled' };
  }

  return new Promise((resolve, reject) => {
    userClient.deleteUser({
      id: currentUser.id
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      if (response.success) {
        currentUser = null;
        authToken = null;
      }
      resolve(response);
    });
  });
};

// Main function
const main = async () => {
  console.log('Welcome to Google Keep gRPC Client');

  while (true) {
    try {
      const option = await displayMenu();
      let response;

      switch (option) {
        case '1':
          response = await register();
          break;
        case '2':
          response = await login();
          break;
        case '3':
          response = await logout();
          break;
        case '4':
          response = await getNotes();
          break;
        case '5':
          response = await getNote();
          break;
        case '6':
          response = await createNote();
          break;
        case '7':
          response = await updateNote();
          break;
        case '8':
          response = await deleteNote();
          break;
        case '9':
          response = await getTags();
          break;
        case '10':
          response = await createTag();
          break;
        case '11':
          response = await updateTag();
          break;
        case '12':
          response = await deleteTag();
          break;
        case '13':
          response = await getUser();
          break;
        case '14':
          response = await updateUser();
          break;
        case '15':
          response = await deleteUser();
          break;
        case '0':
          console.log('Goodbye!');
          rl.close();
          return;
        default:
          console.log('Invalid option');
          continue;
      }

      console.log('\nResponse:');
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
};

// Start the client
main().catch(console.error);
