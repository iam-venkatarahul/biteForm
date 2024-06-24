const express = require('express');
const path = require('path');
const hbs = require('hbs');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const {User,Message} = require('./mongodb');  // Updated import based on module.exports
const moment = require('moment-timezone');
const multer = require('multer'); // Import multer for file upload
const fs = require('fs');
const methodOverride = require('method-override')
const cron = require('node-cron');
// index.js

const { transporter, sendEmail } = require('./emailScheduler'); // Adjust the path as needed


dotenv.config();

const formLink = "https://form-i3hj.onrender.com/";

// Schedule email sending
cron.schedule('14 9,13,19 * * *', async () => { // Runs at 9 AM, 12 PM, and 7 PM IST
    const now = moment().tz('Asia/Kolkata');
    const users = await User.find({ role: { $ne: 'admin' } });

    users.forEach(user => {
        let subject, text, html;

        if (now.hours() === 9) {
            subject = "Breakfast Tab Submission Now Open!";
            text = `Hello ${user.name},\n\nWe're excited to announce that the Breakfast Tab is now active.`;
            html = `<p>Hello ${user.name},</p><p>We're excited to announce that the Breakfast Tab is now active. Please click the link below to submit the form:</p><p><a href="${formLink}">Submit Form Now</a></p><p>Thank you!</p><p>Best regards,<br>The SubmitMate Team</p>`;
        } else if (now.hours() === 13) {
            subject = "Lunch Tab Submission Now Open!";
            text = `Hello ${user.name},\n\nWe're excited to announce that the Lunch Tab is now active. Please click the link below to submit the form:\n${formLink}\n\nThank you!\n\nBest regards,\nThe SubmitMate Team`;
            html = `<p>Hello ${user.name},</p><p>We're excited to announce that the Lunch Tab is now active. Please click the link below to submit the form:</p><p><a href="${formLink}">Submit Form Now</a></p><p>Thank you!</p><p>Best regards,<br>The SubmitMate Team</p>`;
        } else if (now.hours() === 19) {
            subject = "Supper Tab Submission Now Open!";
            text = `Hello ${user.name},\n\nWe're excited to announce that the Supper Tab is now active. Please click the link below to submit the form:\n${formLink}\n\nThank you!\n\nBest regards,\nThe SubmitMate Team`;
            html = `<p>Hello ${user.name},</p><p>We're excited to announce that the Supper Tab is now active. Please click the link below to submit the form:</p><p><a href="${formLink}">Submit Form Now</a></p><p>Thank you!</p><p>Best regards,<br>The SubmitMate Team</p>`;
        }

        // Send email with appropriate content (html or text)
        sendEmail("vedayetchina@gmail.com", subject, text,html);
    });
});

// Schedule email reminders
cron.schedule('45 11,15,21 * * *', async () => { // Runs at 11:45 AM, 3:45 PM, and 9:45 PM IST
    const now = moment().tz('Asia/Kolkata');
    const users = await User.find({ role: { $ne: 'admin' } });

    for (const user of users) {
        const hasSubmittedBreakfast = user.tab.breakfast.some(form => moment(form.timestamp).isSame(now, 'day'));
        const hasSubmittedLunch = user.tab.lunch.some(form => moment(form.timestamp).isSame(now, 'day'));
        const hasSubmittedSupper = user.tab.supper.some(form => moment(form.timestamp).isSame(now, 'day'));

        if (!hasSubmittedBreakfast && now.hours() === 9 && now.minutes() === 45) {
            sendEmail(user.email, 'Reminder: Fill the breakfast form', `Hello ${user.name}\n\nDon't forget to fill the breakfast form for today!\n\nBest regards,\nThe SubmitMate Team`);
        }
        if (!hasSubmittedLunch && now.hours() === 15 && now.minutes() === 45) {
            sendEmail(user.email, 'Reminder: Fill the lunch form', `Hello ${user.name}\n\nDon't forget to fill the lunch form for today!\n\nBest regards,\nThe SubmitMate Team`);
        }
        if (!hasSubmittedSupper && now.hours() === 21 && now.minutes() === 45) {
            sendEmail(user.email, 'Reminder: Fill the supper form', `Hello ${user.name}\n\nDon't forget to fill the supper form for today!\n\nBest regards,\nThe SubmitMate Team`);
        }
    }
});

// Log message to indicate the application is running
console.log('Node.js application running with cron jobs...');
const app = express();
const templatePath = path.join(__dirname, '../templates');
const uploadPath = path.join(__dirname, '../uploads');

app.use('/uploads', express.static(uploadPath)); 
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
    store: MongoStore.create({
        mongoUrl: 'mongodb+srv://vedhavarshiniy111:NkwsKNXYdpVzHsq9@people.vzfrxax.mongodb.net/project?retryWrites=true&w=majority&appName=People',
        collectionName: 'sessions'
      }),
    secret: 'jekskajdjsksksks',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.set('view engine', 'hbs');
app.set('views', templatePath);

app.get('/forgotPassword',(req,res)=>{
    res.render('forgotPassword')
})

app.post('/forgot-password', async (req, res) => {
    try {
        const  username  = req.body.username;
        const user = await User.findOne({ name: username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
            return res.status(200).json({ email: user.email }); // Send email data as JSON
        
    }
    catch(err)
    {
        res.status(500).json({error: "Internal server error"})
    }
})
//const clipboardy = require('clipboardy');

app.post('/sendResetCode/:name', async (req, res) => {
    try {
      const { name } = req.params;
      const { email } = req.body; // Retrieve email from the request body
  
      // Find the user by name or create a new user if they don't exist
      let user = await User.findOneAndUpdate(
        { name },
        {},
        { upsert: true, new: true }
      );
  
      const resetCode = await generateResetCode(); // Implement your own random code generation logic
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 5); // Expiry time 5 minutes from now
  
      // Update user document with new reset code and expiry time
      user.resetCode = resetCode;
      user.codeExpiryTime = expiryTime;
      await user.save(); // Save the updated user document to the database
  
      // Send reset code/token to the provided email
      sendEmail(email, "Password Reset Request for Your SubmitMate Account", `Hello ${name}, \n\nIt looks like you requested a password reset for your SubmitMate account. To reset your password, use the following code: \n\n${resetCode} \n\nThis code will expire in 5 minutes for security reasons. If you did not request a password reset, please ignore this email. If you need further assistance, contact our support team at vedhavarshini.y111@gmail.com.\n\nStay safe,\nThe SubmitMate Team`);
  
      res.status(200).json({ message: 'Reset code sent successfully' });
    } catch (error) {
      console.error('Error sending reset code:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
async function generateResetCode() {
    // Generate a random 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
}


// Verify Reset Code Route
app.post('/verifyResetCode', async (req, res) => {
    try {
        const { username, resetCode } = req.body;
        const user = await User.findOne({ name: username });
        //console.log(user)
        //console.log(new Date())
        const userCodeExpiryTime = new Date(user.codeExpiryTime); // Convert user's expiry time to a Date object
        if (user && user.resetCode === resetCode && userCodeExpiryTime > new Date()) {
            res.status(200).json({ message: 'Reset code verified successfully' });
        } else {
            res.status(400).json({ message: 'Invalid or expired reset code' });
        }
    } catch (error) {
        console.error('Error verifying reset code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/resetPassword', (req, res) => {
    const username = req.query.username;
    res.render('resetPassword', { username }); // Assuming EJS template, passing username to template
  });


app.post('/resetPassword',async(req,res)=>{
    try{
    const name = req.body.username;
    const newpassword = req.body.password;

    const user = await User.findOne({name})
    if(!user){
        return res.status(400).json({error: "User not found"});
    }
    const hashedPassword = await bcrypt.hash(newpassword,10)
    user.password = hashedPassword;
    user.resetCode=undefined
    user.codeExpiryTime=undefined
    await user.save();
    sendEmail(user.email,"Your SubmitMate Password Has Been Successfully Reset",`Hello ${user.name}, \n\nWe wanted to let you know that your password for your SubmitMate account associated with the email: ${user.email} has been successfully reset. You can now log in with your new password.\n\nIf you did not reset your password, please contact our support team immediately at vedhavarshini.y111@gmail.com to secure your account.\n\nThank you for using SubmitMate!\n\nBest regards,\nThe SubmitMate Team`)
    res.status(200).json({message: "Password updated successfully!"});

    }
    catch(error){
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
})

// Route to get user profile data (for simplicity, using a fixed user)
app.get('/user/:name', async (req, res) => {
    const uname = req.session.userName;
    if (!uname) {
        return res.redirect('/signin');
    }
    const name = req.params.name;
    const user = await User.findOne({ name });
    if (!user) {
      return res.status(404).send('User not found');
    }
    res.send(user);
  });
  
  // Route to update phone number
  app.post('/updatePhone/:name', async (req, res) => {
    const { phone } = req.body;
    const name = req.params.name;
  
    try {
      const user = await User.findOneAndUpdate({ name }, { phone }, { new: true, upsert: true });
      console.log(user)
      await user.save()
      res.status(200).send('Phone number updated successfully');
      sendEmail(user.email,"Your Phone Number Has Been Successfully Updated",`Hello ${user.name},\n\nWe wanted to let you know that your phone number for your SubmitMate account has been successfully updated to ${user.phone}.\n\nIf you did not reset your password, please contact our support team immediately at vedhavarshini.y111@gmail.com to secure your account.\n\nThank you for using SubmitMate!\n\nBest regards,\nThe SubmitMate Team`)
    } catch (error) {
      console.error('Error updating phone number:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  // Route to update password
  app.post('/updatePassword/:name', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const name = req.params.name;
    console.log(name)
  
    try {
      const user = await User.findOne({ name });
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).send('Incorrect current password');
      }
  
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();
  
      
      sendEmail(user.email,"Your SubmitMate Password Has Been Successfully Updated",`Hello ${user.name}! \n\nWe wanted to let you know that the password for your SubmitMate account associated with the email:  ${user.email} has been successfully updated.\n\nIf you did not reset your password, please contact our support team immediately at vedhavarshini.y111@gmail.com to secure your account.\n\nThank you for using SubmitMate!\n\nBest regards,\nThe SubmitMate Team`)
      res.status(200).render('signin', { message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).send('Internal Server Error');
    }
  });


app.get("/", (req, res) => {
    res.render("home");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post('/signup', async (req, res) => {
    const { name, email, password, rep_password: repPassword, role } = req.body;

    // Check if passwords match
    if (password !== repPassword) {
        return res.render('signup', { error: 'Passwords do not match' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if username already exists
    const checkName = await User.findOne({ name });
    if (checkName) {
        return res.render('signup', { error: 'Username taken' });
    }

    // Check if email already exists
    const checkEmail = await User.findOne({ email });
    if (checkEmail) {
        return res.render('signup', { error: 'Email already registered' });
    }
    if(role==="admin")
        {
            res.render('signup',{error:"You cannot be an admin!"})
        }
    else{
        // Create the user
        await User.create({ name, email, password: hashedPassword, role , tab: { breakfast: [], lunch: [], supper: [] }});
        sendEmail("vedhavarshini.y111@gmail.com","New user registration",`A new user with name ${name} and email ${email} is registered!`)
        sendEmail(email,"Registration successful",`Hello ${name},\nThank you for registering for this account. \n\nWe are excited to have you join our community. \nYour registration has been successfully completed, and you can now enjoy all the features and benefits we offer.🎉🎉\n\nBest regards,\nThe SubmitMate Team`)

        // Render success message
        res.render('signup', { success: 'Account created successfully!' });
    }
});


app.get("/signin", (req, res) => {
    res.render("signin");
});

app.post('/signin', async (req, res) => {
    try {
        const { name, password, role } = req.body;
        const user = await User.findOne({ name });

        if (!user ) {
            return res.render('signin', { error: 'Incorrect details' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.render('signin', { error: 'Incorrect details' });
        }

        req.session.userName = user.name; // Store the username in the session

        // Redirect based on the role
        if (role === 'user') {
            return res.redirect('/user');
        } else if (role === 'admin') {
            return res.redirect('/admin');
        } else {
            return res.status(400).send('Invalid role');
        }
    } catch (error) {
        console.error('Error signing in:', error);
        return res.status(500).send('Internal server error');
    }
});



// Add these imports at the top
const { ObjectId } = require('mongoose').Types; // Import ObjectId for MongoDB queries

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server);


// Middleware to check if a user is authenticated
const isAuthenticated = (req, res, next) => {
        const name = req.session.userName;
    if (!name) {
        return res.redirect('/signin');
    }
    next();
};
// Register a Handlebars helper for URL encoding
hbs.registerHelper('urlEncode', function(value) {
    return encodeURIComponent(value);
});

// Route to get user page
app.get('/user', isAuthenticated, async (req, res) => {
    const name = req.session.userName;
    if (!name) {
        return res.redirect('/signin');
    }
    try {
        const user = await User.findOne({ name });
        if (!user) {
            return res.status(404).send('User not found');
        }

        const storedTabStates = req.session.tabStates || {};
        const noCustomWallpaper = !user.wallpaper;

        res.render('user', {
            name: user.name,
            feedbackSchema: user.tab,
            storedTabStates: storedTabStates,
            noCustomWallpaper: noCustomWallpaper
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Socket.IO integration
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join', (username) => {
        socket.join(username);
        console.log(`${username} joined room`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    socket.on('sendMessage', async ({ sender, recipient, content }) => {
        try {
            const message = await Message.create({ sender, recipient, content });

            io.to(recipient).emit('receiveMessage', message);
            io.to(sender).emit('messageSent', message);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    });
});

// Route to render the admin chat page
app.get('/adminChat/:name', isAuthenticated, async (req, res) => {
    const name = req.params.name;
    try {
        const user = await User.findOne({ name });
        if (!user || user.role !== 'admin') {
            return res.status(404).send('Admin not found');
        }

        const users = await User.find({ role: 'user' });
        res.render('adminChat', { users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route for sending messages from the admin to a user
app.post('/send-message/:recipient', isAuthenticated, async (req, res) => {
    try {
        const sender = req.session.userName; // Use session to determine the sender (admin)
        const recipient = req.params.recipient;
        const { content } = req.body;

        const message = await Message.create({ sender, recipient, content });

        io.to(recipient).emit('receiveMessage', message);

        res.status(201).json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route for fetching messages for a particular user or the admin
app.get('/messages/:recipient', isAuthenticated, async (req, res) => {
    try {
        const recipient = req.params.recipient;
        const sender = req.session.userName;

        const messages = await Message.find({
            $or: [
                { sender: recipient, recipient: sender },
                { sender: sender, recipient: recipient }
            ]
        });

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Endpoint to fetch user data from the session
app.get('/userdata', async (req, res) => {
    const name = req.session.userName;

    try {
        const user = await User.findOne({ name });

        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ error: 'User data not found in session' });
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/updateTabStates', async (req, res) => {
    const { name, tabStates } = req.body;

    try {
        const user = await User.findOne({ name });

        if (user) {
            user.tabStates = tabStates;
            await user.save();
            res.status(200).send('Tab states updated successfully');
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error('Error updating tab states:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/user', async (req, res) => {
    try {
        const { name, ate, reason, tablets, tab } = req.body;

        // Validate the tab value
        const validTabs = ['breakfast', 'lunch', 'supper'];
        if (!validTabs.includes(tab)) {
            return res.status(400).send(`Invalid tab value: ${tab}`);
        }

        // Fetch user's profile from the database
        const user = await User.findOne({ name });

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Initialize tab structure if not already present
        if (!user.tab) {
            user.tab = { breakfast: [], lunch: [], supper: [] };
        }

        // Initialize specific tab array if not already present
        if (!user.tab[tab]) {
            user.tab[tab] = [];
        }

        // Check if the user has already submitted the form for the given tab
        const today = new Date().setHours(0, 0, 0, 0);
        const hasSubmittedFormToday = user.tab[tab].some(form => {
            return new Date(form.timestamp).setHours(0, 0, 0, 0) === today;
        });

        if (hasSubmittedFormToday) {
            return res.render('user', { name: user.name, userData: JSON.stringify(user), success: `Form already submitted for ${tab}` });
        }

        console.log(JSON.stringify(user));

        // Retrieve email from user's profile
        const userEmail = user.email;

        // Construct the feedback entry
        const newFormEntry = {
            name,
            email: userEmail, // Use the retrieved email
            ate,
            reason,
            tablets,
            timestamp: moment().tz('Asia/Kolkata').format() // Store the timestamp in IST
        };
        console.log(newFormEntry);

        // Push the new form entry to the appropriate tab array in the user's profile
        user.tab[tab].push(newFormEntry);
        await user.save();

        sendEmail(user.email, "Submission status", `Hello ${user.name},\n\nYour form for ${tab} is successfully submitted!\n\nThank you for taking time to fill out this form\n\nHave a great day:)\n\nBest regards,\nThe SubmitMate Team`);
        return res.render('user', { name, userData: JSON.stringify(user), feedbackForms: user.tab[tab], success: 'Form submitted successfully!' });
    } catch (error) {
        console.error('Error submitting form:', error);
        return res.status(500).send('Internal Server Error');
    }
});

const { GridFsStorage } = require('multer-gridfs-storage');
const mongoURI="mongodb+srv://vedhavarshiniy111:NkwsKNXYdpVzHsq9@people.vzfrxax.mongodb.net/project?retryWrites=true&w=majority&appName=People";
// Connect to MongoDB
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('MongoDB Grid fs connected');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process on connection failure
  });
  
// Initialize GridFS
let gfs;

mongoose.connection.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'wallpapers'
  });
});

const storage = new GridFsStorage({
    url: mongoURI,
    file: async (req, file) => {
      const username = req.params.name;
      const fileExtension = path.extname(file.originalname);
      const filename = `${username}_wallpaper${fileExtension}`;
  
      try {
        // Check if a file with the same filename exists in GridFS
        const existingFiles = await gfs.find({ filename: new RegExp(`^${username}_wallpaper`) }).toArray();
        if(existingFiles){
        for (const existingFile of existingFiles) {
            await gfs.delete(existingFile._id);
        }}
      } catch (error) {
        console.error('Error deleting existing files:', error);
      }
      console.log(filename);
      return {
        filename: filename,
        
        bucketName: 'wallpapers' // Store wallpapers in a separate collection
      };
    }
  });
  
  const upload = multer({ storage });
// POST endpoint to handle wallpaper upload
app.post('/update-wallpaper/:name', upload.single('wallpaper'), async (req, res) => {
    try {
      const username = req.params.name;
      const fileExtension = path.extname(req.file.originalname);
      const filename = `${username}_wallpaper${fileExtension}`;
      const wallpaperPath = `/wallpapers/${filename}`; // Path accessible from the frontend
    // Update the wallpaper path for the user in the database
    const updatedUser = await User.findOneAndUpdate(
        { name: username },
        { wallpaper: wallpaperPath },
        { new: true }
    );
    await updatedUser.save();

   // console.log(updatedUser)
      if (!updatedUser) {
        return res.status(404).send('User not found');
      }
  
      // Send response with username and fileExtension
      res.json({ username, fileExtension });
    } catch (error) {
      console.error('Error uploading wallpaper:', error);
      return res.status(500).send('Internal Server Error');
    }
  });
  app.get('/wallpaper/:username', async (req, res) => {
    const username = req.params.username;
  
    try {
      const user = await User.findOne({ name: username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check if user.wallpaper is valid
    if (!user.wallpaper) {
        return res.status(404).json({ error: 'Wallpaper not found' });
      }

      const filename = `${username}_wallpaper${path.extname(user.wallpaper)}`;
      const files = await gfs.find({ filename }).toArray();
      if (!files || files.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }
  
      const file = files[0];
      const downloadStream = gfs.openDownloadStream(file._id);
  
      res.set('Content-Type', file.contentType);
      downloadStream.pipe(res);
    
    } catch (error) {
      console.error('Error fetching wallpaper:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

// Endpoint to handle wallpaper deletion
app.post('/delete-wallpaper/:username', async (req, res) => {
    const username = req.params.username;
  
    try {
      // Find user in database
      const user = await User.findOne({ name: username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check if user.wallpaper is valid
    if (!user.wallpaper) {
        return res.status(404).json({ error: 'Wallpaper not found' });
      }
      
      // Construct filename from user data
      const filename = `${username}_wallpaper${path.extname(user.wallpaper)}`;
      console.log(filename)
      // Check if file exists in GridFS
      const file = await gfs.find({ filename }).toArray();
      if (!file || file.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }
  
      // Delete the file from GridFS
      for (const fileObj of file) {
        await gfs.delete(fileObj._id);
      }
  
      // Remove wallpaper path from the user in the database
      user.wallpaper = null;
      await user.save();
  
      res.json({ success: true, username });
    } catch (error) {
      console.error('Error deleting wallpaper:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

// Register Handlebars helper function to format date
hbs.registerHelper('formatDate', function (timestamp) {
    return moment(timestamp).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
});

// Register Handlebars helper function for equality check
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

app.get('/admin', async (req, res) => {
    const name = req.session.userName;
    if (!name) {
        return res.redirect('/signin');
    }
    try {
        // Fetch all non-admin users
        const users = await User.find({ role: { $ne: 'admin' } });

        // Collect all unique dates from the entries
        const allDates = new Set();
        users.forEach(user => {
            ['breakfast', 'lunch', 'supper'].forEach(meal => {
                user.tab[meal].forEach(entry => {
                    allDates.add(moment(entry.timestamp).format('YYYY-MM-DD'));
                });
            });
        });

        // Sort dates in descending order
        const sortedDates = Array.from(allDates).sort((a, b) => new Date(b) - new Date(a));

        // Ensure each date has an entry for each user
        const groupedUsers = {};
        sortedDates.forEach(date => {
            groupedUsers[date] = users.map(user => {
                const getEntriesForMeal = meal => {
                    const entries = user.tab[meal].filter(entry => moment(entry.timestamp).format('YYYY-MM-DD') === date);
                    return entries.length ? entries : [{ name: '', ate: '', reason: '', tablets: '', timestamp: '' }];
                };

                return {
                    name: user.name,
                    wallpaper: user.wallpaper,
                    tab: {
                        breakfast: getEntriesForMeal('breakfast'),
                        lunch: getEntriesForMeal('lunch'),
                        supper: getEntriesForMeal('supper'),
                    },
                };
            });
        });

        res.render('admin', { admin:name,groupedUsers });
    } catch (error) {
        console.error('Error fetching non-admin users:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get("/userChat",(req,res)=>{
    const name = req.session.userName;
    if (!name) {
        return res.redirect('/signin');
    }
    res.render('userChat')
})


app.get("/profile/:name", async (req, res) => {
    const uname = req.session.userName;
    if (!uname) {
        return res.redirect('/signin');
    }
    const name = req.params.name;
    if (!name) {
        return res.status(400).send('User name is required');
    }
    try {
        // Fetch the particular user by name
        const user = await User.findOne({ name });
        if (!user) {
            return res.status(404).send('User not found');
        }
    
        // Pass user data to the profile template
        res.render('profile', { user });
    } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).send('Internal Server Error');
    }
});

// User route
app.get('/dataUser/:name', async (req, res) => {
    const uname = req.session.userName;
    if (!uname) {
        return res.redirect('/signin');
    }
    const name = req.params.name; // Assuming the user's name is passed as a query parameter
    if (!name) {
        return res.status(400).send('User name is required');
    }
    try {
        // Fetch the particular user by name
        const user = await User.findOne({ name });

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Collect all unique dates from the entries
        const allDates = new Set();
        ['breakfast', 'lunch', 'supper'].forEach(meal => {
            user.tab[meal].forEach(entry => {
                allDates.add(moment(entry.timestamp).format('YYYY-MM-DD'));
            });
        });

        // Sort dates in descending order
        const sortedDates = Array.from(allDates).sort((a, b) => new Date(b) - new Date(a));

        // Ensure each date has an entry for each meal
        const groupedUser = {};
        sortedDates.forEach(date => {
            const getEntriesForMeal = meal => {
                const entries = user.tab[meal].filter(entry => moment(entry.timestamp).format('YYYY-MM-DD') === date);
                return entries.length ? entries[0] : { name: '', ate: '', reason: '', tablets: '', timestamp: '' };
            };

            groupedUser[date] = {
                name: user.name,
                wallpaper: user.wallpaper,
                tab: {
                    breakfast: getEntriesForMeal('breakfast'),
                    lunch: getEntriesForMeal('lunch'),
                    supper: getEntriesForMeal('supper')
                }
            
            };
            
        });
           // console.log(groupedUser)
            res.render('dataUser', { name: name ,groupedUser });
        
        
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal Server Error');
    }
});



// app.use(methodOverride("_method"))

// app.delete("/logout", (req, res) => {
//     req.session.destroy((err) => {
//         if (err) {
//             console.error('Error logging out:', err);
//             return res.status(500).send('Could not log out.');
//         }
//         res.redirect('/');
//     });
// });

// app.get('/logout', (req, res) => {
//     req.session.destroy((err) => {
//         if (err) {
//             return res.status(500).send('Could not log out.');
//         }
//         res.redirect('/');
//     });
// });

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/');
    });
});




app.listen(3000, () => {
    console.log("Port connected");
});
