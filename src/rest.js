import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key_for_testing';

// Configure CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Data file paths
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const TAGS_FILE = path.join(DATA_DIR, 'tags.json');
const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load data
let users = [];
let notes = [];
let tags = [];
let tokenBlacklist = [];

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
function saveData() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
  fs.writeFileSync(TAGS_FILE, JSON.stringify(tags, null, 2));
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(tokenBlacklist, null, 2));
}

// Clean expired tokens from blacklist
function cleanBlacklist() {
  const now = Date.now() / 1000;
  tokenBlacklist = tokenBlacklist.filter(item => item.exp > now);
  saveData();
}

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Check if token is blacklisted
  if (tokenBlacklist.some(item => item.token === token)) {
    return res.status(401).json({ message: 'Token is no longer valid' });
  }
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Run blacklist cleanup periodically
setInterval(cleanBlacklist, 60 * 60 * 1000);

// AUTH ROUTES

// Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  if (users.some(user => user.username === username)) {
    return res.status(400).json({ message: 'Username already exists' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveData();
    
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username },
      SECRET_KEY,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  const user = users.find(u => u.username === username);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }
  
  try {
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username },
      SECRET_KEY,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Logout
app.post('/logout', authenticateToken, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.decode(token);
    
    tokenBlacklist.push({
      token,
      exp: decoded.exp
    });
    
    saveData();
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ message: 'Error logging out' });
  }
});

// NOTES ROUTES

// Get all notes
app.get('/notes', authenticateToken, (req, res) => {
  const { userId, archived, tagId } = req.query;
  
  try {
    let filteredNotes = notes.filter(note => note.userId === userId);
    
    if (archived !== undefined) {
      const isArchived = archived === 'true';
      filteredNotes = filteredNotes.filter(note => note.archived === isArchived);
    }
    
    if (tagId) {
      filteredNotes = filteredNotes.filter(note => note.tagIds.includes(tagId));
    }
    
    res.json(filteredNotes);
  } catch (error) {
    console.error('Error getting notes:', error);
    res.status(500).json({ message: 'Error getting notes' });
  }
});

// Get note by ID
app.get('/notes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  try {
    const note = notes.find(n => n.id === id && n.userId === userId);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    res.json(note);
  } catch (error) {
    console.error('Error getting note:', error);
    res.status(500).json({ message: 'Error getting note' });
  }
});

// Create note
app.post('/notes', authenticateToken, (req, res) => {
  const { title, content, tagIds = [], userId, color = '#f28b82' } = req.body;
  
  if (!title || !content || !userId) {
    return res.status(400).json({ message: 'Title, content, and userId are required' });
  }
  
  try {
    const newNote = {
      id: uuidv4(),
      title,
      content,
      tagIds,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
      color
    };
    
    notes.push(newNote);
    saveData();
    
    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ message: 'Error creating note' });
  }
});

// Update note
app.put('/notes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, content, tagIds, userId, archived, color } = req.body;
  
  try {
    const noteIndex = notes.findIndex(n => n.id === id && n.userId === userId);
    
    if (noteIndex === -1) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    const updatedNote = {
      ...notes[noteIndex],
      title: title !== undefined ? title : notes[noteIndex].title,
      content: content !== undefined ? content : notes[noteIndex].content,
      tagIds: tagIds !== undefined ? tagIds : notes[noteIndex].tagIds,
      archived: archived !== undefined ? archived : notes[noteIndex].archived,
      color: color !== undefined ? color : notes[noteIndex].color,
      updatedAt: new Date().toISOString()
    };
    
    notes[noteIndex] = updatedNote;
    saveData();
    
    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ message: 'Error updating note' });
  }
});

// Delete note
app.delete('/notes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  try {
    const noteIndex = notes.findIndex(n => n.id === id && n.userId === userId);
    
    if (noteIndex === -1) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    notes.splice(noteIndex, 1);
    saveData();
    
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ message: 'Error deleting note' });
  }
});

// TAGS ROUTES

// Get all tags
app.get('/tags', authenticateToken, (req, res) => {
  const { userId } = req.query;
  
  try {
    const userTags = tags.filter(tag => tag.userId === userId);
    res.json(userTags);
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({ message: 'Error getting tags' });
  }
});

// Get tag by ID
app.get('/tags/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  try {
    const tag = tags.find(t => t.id === id && t.userId === userId);
    
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    res.json(tag);
  } catch (error) {
    console.error('Error getting tag:', error);
    res.status(500).json({ message: 'Error getting tag' });
  }
});

// Create tag
app.post('/tags', authenticateToken, (req, res) => {
  const { name, userId } = req.body;
  
  if (!name || !userId) {
    return res.status(400).json({ message: 'Name and userId are required' });
  }
  
  try {
    const newTag = {
      id: uuidv4(),
      name,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    tags.push(newTag);
    saveData();
    
    res.status(201).json(newTag);
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ message: 'Error creating tag' });
  }
});

// Update tag
app.put('/tags/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, userId } = req.body;
  
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }
  
  try {
    const tagIndex = tags.findIndex(t => t.id === id && t.userId === userId);
    
    if (tagIndex === -1) {
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    const updatedTag = {
      ...tags[tagIndex],
      name,
      updatedAt: new Date().toISOString()
    };
    
    tags[tagIndex] = updatedTag;
    saveData();
    
    res.json(updatedTag);
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ message: 'Error updating tag' });
  }
});

// Delete tag
app.delete('/tags/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  try {
    const tagIndex = tags.findIndex(t => t.id === id && t.userId === userId);
    
    if (tagIndex === -1) {
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    // Remove tag from all notes
    notes.forEach(note => {
      if (note.userId === userId && note.tagIds.includes(id)) {
        note.tagIds = note.tagIds.filter(tagId => tagId !== id);
      }
    });
    
    tags.splice(tagIndex, 1);
    saveData();
    
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ message: 'Error deleting tag' });
  }
});

// USER ROUTES

// Get user by ID
app.get('/users/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  try {
    const user = users.find(u => u.id === id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      id: user.id,
      username: user.username
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Error getting user' });
  }
});

// Update user
app.put('/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;
  
  try {
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const updatedUser = { ...users[userIndex] };
    
    if (username) {
      // Check if username is already taken by another user
      if (users.some(u => u.username === username && u.id !== id)) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      updatedUser.username = username;
    }
    
    if (password) {
      updatedUser.password = await bcrypt.hash(password, 10);
    }
    
    updatedUser.updatedAt = new Date().toISOString();
    users[userIndex] = updatedUser;
    saveData();
    
    res.json({
      id: updatedUser.id,
      username: updatedUser.username
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Delete user
app.delete('/users/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  try {
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete all user's notes and tags
    notes = notes.filter(note => note.userId !== id);
    tags = tags.filter(tag => tag.userId !== id);
    
    users.splice(userIndex, 1);
    saveData();
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`REST server running on port ${PORT}`);
});

export default app;
