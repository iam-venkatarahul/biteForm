const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://vedhavarshiniy111:NkwsKNXYdpVzHsq9@people.vzfrxax.mongodb.net/LINKEDIN?retryWrites=true&w=majority&appName=People')
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((err) => {
        console.error("Failed to connect!", err);
    });

 // Define Feedback schema
const feedbackSchema = new mongoose.Schema({
    name: String,
    ate: String,
    reason: String,
    tablets: String,
    timestamp: { type: String }
});

// Define Message schema
const messageSchema = new mongoose.Schema({
    from: {
        type: String, // Assuming 'username' is used as a unique identifier
        ref: 'User',
        required: true
    },
    to: {
        type: String, // Assuming 'username' is used as a unique identifier
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: String
    },
    read: {
        type: Boolean,
        default: false // Default value is false (unread)
    },
    delivered:{
        type: Boolean,
        default: false
    }
});

// Define User schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false,
        unique: true
    },
    role: {
        type: String,
        required: true,
        enum: ['admin', 'user']
    },
    password: {
        type: String,
        required: true
    },
    tab: {
        breakfast: [feedbackSchema],
        lunch: [feedbackSchema],
        supper: [feedbackSchema]
    },
    phone: {
        type: Number,
        required: false
    },
    tabStates: {
        breakfast: { disabled: Boolean, greenTab: Boolean, active: Boolean },
        lunch: { disabled: Boolean, greenTab: Boolean, active: Boolean },
        supper: { disabled: Boolean, greenTab: Boolean, active: Boolean }
    },
    resetCode: {
        type: String
    },
    codeExpiryTime: {
        type: String
    },
    wallpaper: String,
    messages: [messageSchema], // Array of messages
    lastLogin: Date,
    lastLogout : Date,
    avatar: String
});

// Create models
const User = mongoose.model('linkedIn', userSchema);
const Message = mongoose.model('Msg', messageSchema);

module.exports = { User, Message };