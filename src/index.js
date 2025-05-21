import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to proto file
const PROTO_PATH = path.join(__dirname, '../proto/keep.proto');

// Data paths
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const TAGS_FILE = path.join(DATA_DIR, 'tags.json');
const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');

// Load data from files
let users = [];
let notes = [];
let tags = [];
let tokenBlacklist = [];

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load data from files or initialize empty arrays
try {
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  }
  if (fs.existsSync(NOTES_FILE)) {
    notes = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
  }
  if (fs.existsSync(TAGS_FILE)) {
    tags = JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8'));
  }
  if (fs.existsSync(BLACKLIST_FILE)) {
    tokenBlacklist = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
  }
} catch (error) {
  console.error('Error loading data:', error);
}

// Save data to files
const saveData = () => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
    fs.writeFileSync(TAGS_FILE, JSON.stringify(tags, null, 2));
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(tokenBlacklist, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
};

// Clean expired tokens from blacklist
const cleanBlacklist = () => {
  const now = new Date();
  tokenBlacklist = tokenBlacklist.filter(item => {
    const tokenExp = new Date(item.expiresAt);
    return tokenExp > now;
  });
  saveData();
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    // Check if token is blacklisted
    const isBlacklisted = tokenBlacklist.some(item => item.token === token);
    if (isBlacklisted) {
      return { valid: false, message: 'Token has been revoked' };
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    return { valid: true, user: decoded };
  } catch (error) {
    return { valid: false, message: 'Invalid token' };
  }
};

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

// Auth Service Implementation
const authService = {
  register: (call, callback) => {
    const { username, password } = call.request;

    // Check if username already exists
    if (users.some(user => user.username === username)) {
      return callback(null, {
        success: false,
        message: 'Username already exists'
      });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        return callback(null, {
          success: false,
          message: 'Error creating user'
        });
      }

      // Create new user
      const newUser = {
        id: uuidv4(),
        username,
        password: hashedPassword
      };

      // Add user to users array
      users.push(newUser);
      saveData();

      // Generate JWT token
      const token = jwt.sign(
        { id: newUser.id, username: newUser.username },
        process.env.SECRET_KEY,
        { expiresIn: '24h' }
      );

      // Return success response
      callback(null, {
        success: true,
        message: 'User registered successfully',
        token,
        user: {
          id: newUser.id,
          username: newUser.username
        }
      });
    });
  },

  login: (call, callback) => {
    const { username, password } = call.request;

    // Find user by username
    const user = users.find(user => user.username === username);

    // Check if user exists
    if (!user) {
      return callback(null, {
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Compare passwords
    bcrypt.compare(password, user.password, (err, result) => {
      if (err || !result) {
        return callback(null, {
          success: false,
          message: 'Invalid username or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.SECRET_KEY,
        { expiresIn: '24h' }
      );

      // Return success response
      callback(null, {
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username
        }
      });
    });
  },

  logout: (call, callback) => {
    const { token } = call.request;

    try {
      // Decode token to get expiration
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return callback(null, {
          success: false,
          message: 'Invalid token'
        });
      }

      // Add token to blacklist
      const expiresAt = new Date(decoded.exp * 1000).toISOString();
      tokenBlacklist.push({ token, expiresAt });
      saveData();

      // Return success response
      callback(null, {
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      callback(null, {
        success: false,
        message: 'Error during logout'
      });
    }
  }
};

// Note Service Implementation
const noteService = {
  getNotes: (call, callback) => {
    const { userId, archived, tagId } = call.request;

    // Filter notes by userId and archived status
    let filteredNotes = notes.filter(note => note.userId === userId);
    
    // Filter by archived status if specified
    if (archived !== undefined) {
      filteredNotes = filteredNotes.filter(note => note.archived === archived);
    }
    
    // Filter by tagId if specified
    if (tagId) {
      filteredNotes = filteredNotes.filter(note => 
        note.tagIds && note.tagIds.includes(tagId)
      );
    }

    // Return filtered notes
    callback(null, {
      success: true,
      message: 'Notes retrieved successfully',
      notes: filteredNotes
    });
  },

  getNote: (call, callback) => {
    const { id, userId } = call.request;

    // Find note by id and userId
    const note = notes.find(note => note.id === id && note.userId === userId);

    // Check if note exists
    if (!note) {
      return callback(null, {
        success: false,
        message: 'Note not found'
      });
    }

    // Return note
    callback(null, {
      success: true,
      message: 'Note retrieved successfully',
      note
    });
  },

  createNote: (call, callback) => {
    const { title, content, tagIds, userId, color } = call.request;

    // Create new note
    const newNote = {
      id: uuidv4(),
      title: title || '',
      content: content || '',
      tagIds: tagIds || [],
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
      color: color || '#ffffff'
    };

    // Add note to notes array
    notes.push(newNote);
    saveData();

    // Return success response
    callback(null, {
      success: true,
      message: 'Note created successfully',
      note: newNote
    });
  },

  updateNote: (call, callback) => {
    const { id, title, content, tagIds, userId, archived, color } = call.request;

    // Find note index
    const noteIndex = notes.findIndex(note => note.id === id && note.userId === userId);

    // Check if note exists
    if (noteIndex === -1) {
      return callback(null, {
        success: false,
        message: 'Note not found'
      });
    }

    // Update note
    const updatedNote = {
      ...notes[noteIndex],
      title: title !== undefined ? title : notes[noteIndex].title,
      content: content !== undefined ? content : notes[noteIndex].content,
      tagIds: tagIds !== undefined ? tagIds : notes[noteIndex].tagIds,
      archived: archived !== undefined ? archived : notes[noteIndex].archived,
      color: color !== undefined ? color : notes[noteIndex].color,
      updatedAt: new Date().toISOString()
    };

    // Replace note in notes array
    notes[noteIndex] = updatedNote;
    saveData();

    // Return success response
    callback(null, {
      success: true,
      message: 'Note updated successfully',
      note: updatedNote
    });
  },

  deleteNote: (call, callback) => {
    const { id, userId } = call.request;

    // Find note index
    const noteIndex = notes.findIndex(note => note.id === id && note.userId === userId);

    // Check if note exists
    if (noteIndex === -1) {
      return callback(null, {
        success: false,
        message: 'Note not found'
      });
    }

    // Remove note from notes array
    notes.splice(noteIndex, 1);
    saveData();

    // Return success response
    callback(null, {
      success: true,
      message: 'Note deleted successfully'
    });
  }
};

// Tag Service Implementation
const tagService = {
  getTags: (call, callback) => {
    const { userId } = call.request;

    // Filter tags by userId
    const filteredTags = tags.filter(tag => tag.userId === userId);

    // Return filtered tags
    callback(null, {
      success: true,
      message: 'Tags retrieved successfully',
      tags: filteredTags
    });
  },

  getTag: (call, callback) => {
    const { id, userId } = call.request;

    // Find tag by id and userId
    const tag = tags.find(tag => tag.id === id && tag.userId === userId);

    // Check if tag exists
    if (!tag) {
      return callback(null, {
        success: false,
        message: 'Tag not found'
      });
    }

    // Return tag
    callback(null, {
      success: true,
      message: 'Tag retrieved successfully',
      tag
    });
  },

  createTag: (call, callback) => {
    const { name, userId } = call.request;

    // Create new tag
    const newTag = {
      id: uuidv4(),
      name,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add tag to tags array
    tags.push(newTag);
    saveData();

    // Return success response
    callback(null, {
      success: true,
      message: 'Tag created successfully',
      tag: newTag
    });
  },

  updateTag: (call, callback) => {
    const { id, name, userId } = call.request;

    // Find tag index
    const tagIndex = tags.findIndex(tag => tag.id === id && tag.userId === userId);

    // Check if tag exists
    if (tagIndex === -1) {
      return callback(null, {
        success: false,
        message: 'Tag not found'
      });
    }

    // Update tag
    const updatedTag = {
      ...tags[tagIndex],
      name: name !== undefined ? name : tags[tagIndex].name,
      updatedAt: new Date().toISOString()
    };

    // Replace tag in tags array
    tags[tagIndex] = updatedTag;
    saveData();

    // Return success response
    callback(null, {
      success: true,
      message: 'Tag updated successfully',
      tag: updatedTag
    });
  },

  deleteTag: (call, callback) => {
    const { id, userId } = call.request;

    // Find tag index
    const tagIndex = tags.findIndex(tag => tag.id === id && tag.userId === userId);

    // Check if tag exists
    if (tagIndex === -1) {
      return callback(null, {
        success: false,
        message: 'Tag not found'
      });
    }

    // Remove tag from tags array
    tags.splice(tagIndex, 1);

    // Remove tag from all notes
    notes.forEach(note => {
      if (note.tagIds && note.tagIds.includes(id)) {
        note.tagIds = note.tagIds.filter(tagId => tagId !== id);
      }
    });

    saveData();

    // Return success response
    callback(null, {
      success: true,
      message: 'Tag deleted successfully'
    });
  }
};

// User Service Implementation
const userService = {
  getUser: (call, callback) => {
    const { id } = call.request;

    // Find user by id
    const user = users.find(user => user.id === id);

    // Check if user exists
    if (!user) {
      return callback(null, {
        success: false,
        message: 'User not found'
      });
    }

    // Return user without password
    callback(null, {
      success: true,
      message: 'User retrieved successfully',
      user: {
        id: user.id,
        username: user.username
      }
    });
  },

  updateUser: (call, callback) => {
    const { id, username, password } = call.request;

    // Find user index
    const userIndex = users.findIndex(user => user.id === id);

    // Check if user exists
    if (userIndex === -1) {
      return callback(null, {
        success: false,
        message: 'User not found'
      });
    }

    // Check if username is already taken
    if (username && username !== users[userIndex].username &&
        users.some(user => user.username === username)) {
      return callback(null, {
        success: false,
        message: 'Username already exists'
      });
    }

    // Update user
    const updateUser = async () => {
      const updatedUser = { ...users[userIndex] };

      // Update username if provided
      if (username) {
        updatedUser.username = username;
      }

      // Update password if provided
      if (password) {
        try {
          updatedUser.password = await bcrypt.hash(password, 10);
        } catch (error) {
          return callback(null, {
            success: false,
            message: 'Error updating password'
          });
        }
      }

      // Replace user in users array
      users[userIndex] = updatedUser;
      saveData();

      // Return success response
      callback(null, {
        success: true,
        message: 'User updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username
        }
      });
    };

    updateUser();
  },

  deleteUser: (call, callback) => {
    const { id } = call.request;

    // Find user index
    const userIndex = users.findIndex(user => user.id === id);

    // Check if user exists
    if (userIndex === -1) {
      return callback(null, {
        success: false,
        message: 'User not found'
      });
    }

    // Remove user from users array
    users.splice(userIndex, 1);

    // Remove all notes and tags belonging to the user
    notes = notes.filter(note => note.userId !== id);
    tags = tags.filter(tag => tag.userId !== id);

    saveData();

    // Return success response
    callback(null, {
      success: true,
      message: 'User deleted successfully'
    });
  }
};

// Create gRPC server
const server = new grpc.Server();

// Add services to server
server.addService(keepapi.AuthService.service, authService);
server.addService(keepapi.NoteService.service, noteService);
server.addService(keepapi.TagService.service, tagService);
server.addService(keepapi.UserService.service, userService);

// Start server
const PORT = process.env.GRPC_PORT || 50051;
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind server:', err);
    return;
  }
  
  console.log(`gRPC server running at http://0.0.0.0:${port}`);
  server.start();
  
  // Run blacklist cleanup periodically (every hour)
  setInterval(cleanBlacklist, 60 * 60 * 1000);
});
