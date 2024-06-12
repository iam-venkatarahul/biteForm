const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://vedhavarshiniy111:NkwsKNXYdpVzHsq9@people.vzfrxax.mongodb.net/project?retryWrites=true&w=majority&appName=People')
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((err) => {
        console.error("Failed to connect!", err);
    });

    
const feedbackSchema = new mongoose.Schema({
    name: String,
    ate: String,
    reason: String,
    tablets: String,
    timestamp: { type: String}
});

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
    phone:{
        type: Number,
        required: false
    },
    tabStates: {
        breakfast: { disabled: Boolean, greenTab: Boolean, active: Boolean },
        lunch: { disabled: Boolean, greenTab: Boolean, active: Boolean },
        supper: { disabled: Boolean, greenTab: Boolean, active: Boolean }
    },
    resetCode:{
        type:String
    },
    codeExpiryTime: {
        type:String
    },
    wallpaper: String
});

const User = mongoose.model('User', userSchema);

// Schema for messages
const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    timestamp: { type: Date, default: Date.now }
});

// Model for messages
const Message = mongoose.model('Message', messageSchema);


module.exports = { User, Message };
