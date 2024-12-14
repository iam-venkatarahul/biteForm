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
const livereload = require("livereload");

const liveReloadServer = livereload.createServer();
liveReloadServer.watch(path.join(__dirname, 'public'));

// index.js

const { transporter, sendEmail } = require('./emailScheduler'); // Adjust the path as needed


dotenv.config();

const formLink = "https://biteform.onrender.com";

// Schedule email sending
cron.schedule('0 9,13,19 * * *', async () => { // Runs at 9 AM, 12 PM, and 7 PM IST
    const now = moment().tz('Asia/Kolkata');
    const users = await User.find({ role: { $ne: 'admin' } });

    users.forEach(user => {
        let subject, text, html;

        if (now.hours() === 9) {
            subject = "Breakfast Tab Submission Now Open!";
            text = `Hello ${user.name},\n\nWe're pleased to announce that the Breakfast Tab is now active.`;
            html = `<p>Hello ${user.name},</p><p>We're pleased to announce that the Breakfast Tab is now active. Please click the link below to submit the form:</p><p><a href="${formLink}">Submit Form Now</a></p><p>Thank you!</p><p>Best regards,<br>The BiteForm Team</p>`;
        } else if (now.hours() === 12) {
            subject = "Lunch Tab Submission Now Open!";
            text = `Hello ${user.name},\n\nWe're here to announce that the Lunch Tab is now active. Please click the link below to submit the form:\n${formLink}\n\nThank you!\n\nBest regards,\nThe BiteForm Team`;
            html = `<p>Hello ${user.name},</p><p>We're pleased to announce that the Lunch Tab is now active. Please click the link below to submit the form:</p><p><a href="${formLink}">Submit Form Now</a></p><p>Thank you!</p><p>Best regards,<br>The BiteForm Team</p>`;
        } else if (now.hours() === 19) {
            subject = "Supper Tab Submission Now Open!";
            text = `Hello ${user.name},\n\nWe're here to announce that the Supper Tab is now active. Please click the link below to submit the form:\n${formLink}\n\nThank you!\n\nBest regards,\nThe BiteForm Team`;
            html = `<p>Hello ${user.name},</p><p>We're pleased to announce that the Supper Tab is now active. Please click the link below to submit the form:</p><p><a href="${formLink}">Submit Form Now</a></p><p>Thank you!</p><p>Best regards,<br>The BiteForm Team</p>`;
        }

        // Send email with appropriate content (html or text)
        sendEmail(user.email, subject, text,html);
        console.log("Tab active mail");
    });
});

// Schedule email reminders
cron.schedule('45 11,15,21  * * *', async () => { // Runs at 11:45 AM, 3:45 PM, and 9:45 PM IST
    const now = moment().tz('Asia/Kolkata');
    const users = await User.find({ role: { $ne: 'admin' } });

    for (const user of users) {
        const hasSubmittedBreakfast = user.tab.breakfast.some(form => moment(form.timestamp).isSame(now, 'day'));
        const hasSubmittedLunch = user.tab.lunch.some(form => moment(form.timestamp).isSame(now, 'day'));
        const hasSubmittedSupper = user.tab.supper.some(form => moment(form.timestamp).isSame(now, 'day'));

        if (!hasSubmittedBreakfast && now.hours() === 9 && now.minutes() === 45) {
            sendEmail(user.email, 'Reminder: Fill the breakfast form', `Hello ${user.name}\n\nDon't forget to fill the breakfast form for today!\n\nBest regards,\nThe BiteForm Team`);
        }
        if (!hasSubmittedLunch && now.hours() === 15 && now.minutes() === 45) {
            sendEmail(user.email, 'Reminder: Fill the lunch form', `Hello ${user.name}\n\nDon't forget to fill the lunch form for today!\n\nBest regards,\nThe BiteForm Team`);
        }
        if (!hasSubmittedSupper && now.hours() === 21 && now.minutes() === 45) {
            sendEmail(user.email, 'Reminder: Fill the supper form', `Hello ${user.name}\n\nDon't forget to fill the supper form for today!\n\nBest regards,\nThe BiteForm Team`);
        }
        console.log("Reminder form email")
    }
});

// Log message to indicate the application is running
console.log('Node.js application running with cron jobs...');
const app = express();

const templatePath = path.join(__dirname, '../templates');
const uploadPath = path.join(__dirname, '../uploads');

const connectLivereload = require("connect-livereload");
app.use(connectLivereload());
app.use('/uploads', express.static(uploadPath)); 
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
    store: MongoStore.create({
        mongoUrl: 'mongodb+srv://vedhavarshiniy111:NkwsKNXYdpVzHsq9@people.vzfrxax.mongodb.net/LINKEDIN?retryWrites=true&w=majority&appName=People',
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
      sendEmail(email, "Password Reset Request for Your BiteForm Account", `Hello ${name}, \n\nIt looks like you requested a password reset for your BiteForm account. To reset your password, use the following code: \n\n${resetCode} \n\nThis code will expire in 5 minutes for security reasons. If you did not request a password reset, please ignore this email. If you need further assistance, contact our support team at vcareyou.biteform@gmail.com.\n\nStay safe,\nThe BiteForm Team`);
      console.log("Reset pwd request email")
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
    sendEmail(user.email,"Your BiteForm Password Has Been Successfully Reset",`Hello ${user.name}, \n\nWe wanted to let you know that your password for your BiteForm account associated with the email: ${user.email} has been successfully reset. You can now log in with your new password.\n\nIf you did not reset your password, please contact our support team immediately at vcareyou.biteform@gmail.com to secure your account.\n\nThank you for using BiteForm!\n\nBest regards,\nThe BiteForm Team`)
    console.log("Reset pwd email")
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
    else if(uname !== req.params.name){
        return res.redirect("/signin")
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
      sendEmail(user.email,"Your Phone Number Has Been Successfully Updated",`Hello ${user.name},\n\nWe wanted to let you know that your phone number for your BiteForm account has been successfully updated to ${user.phone}.\n\nIf you did not update your number, please contact our support team immediately at vcareyou.biteform@gmail.com to secure your account.\n\nThank you for using BiteForm!\n\nBest regards,\nThe BiteForm Team`)
      console.log("Phone num email")
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
  
      
      sendEmail(user.email,"Your BiteForm Password Has Been Successfully Updated",`Hello ${user.name}! \n\nWe wanted to let you know that the password for your BiteForm account associated with the email:  ${user.email} has been successfully updated.\n\nIf you did not reset your password, please contact our support team immediately at vcareyou.biteform@gmail.com to secure your account.\n\nThank you for using BiteForm!\n\nBest regards,\nThe BiteForm Team`)
      console.log("Updated pwd email")
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
        sendEmail("vcareyou.biteform@gmail.com","New user registration",`A new user with name ${name} and email ${email} is registered!`)
        sendEmail(email,"Registration successful",`Hello ${name},\nThank you for registering for this account. \n\nWe are excited to have you join our community.Your registration has been successfully completed, and you can now enjoy all the features and benefits we offer.🎉🎉\n\nAdditionally, please note our meal timings for filling the forms:\n\n▪️Breakfast: 9 AM to 12 PM\n▪️Lunch: 1 PM to 4 PM\n▪️Supper: 7 PM to 11 PM\n\nYou can fill the form during these timings.\n\nBest regards,\nThe BiteForm Team`)
        console.log("Registration mail")
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
            const msgs = await Message.find(
                { to: name, delivered: false });
                //console.log(msgs,"msgs User")
            const updateResult = await Message.updateMany(
                { to: name, delivered: false },
                { $set: { delivered: true } }
            );
            
            //console.log(`Updated ${updateResult} messages for admin`);
            // Emit event to notify clients (users) about message delivery update
            io.emit('UserLoggedIn',name);
            return res.redirect('/user');
        } else if (role === 'admin') {
            if (user.role !== 'admin') {
                return res.render('signin', { error: 'Invalid details' });
            }
            const msgs = await Message.find(
                { to: 'admin', delivered: false });
                console.log(msgs,"msgs")
            const updateResult = await Message.updateMany(
                { to: 'admin', delivered: false },
                { $set: { delivered: true } }
            );
            
            console.log(`Updated ${updateResult} messages for admin`);
            // Emit event to notify clients (users) about message delivery update
            io.emit('adminLoggedIn');
            const unreadCount = await User.countDocuments({to: "admin", read: false})
            io.emit('ur',unreadCount)
            
            return res.redirect('/admin');
        } else {
            return res.status(400).send('Invalid role');
        }
    } catch (error) {
        console.error('Error signing in:', error);
        return res.status(500).send('Internal server error');
    }
});

const isAuthenticated = (req, res, next) => {
    const userName = req.session.userName;
    if (!userName) {
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
        if (!user || user.role !=="user") {
            return res.status(404).send('User not found');
        }

        const storedTabStates = req.session.tabStates || {};
        const noCustomWallpaper = !user.wallpaper;

        // Example logic to count unread messages
        const unreadMessagesCount = await Message.countDocuments({
            from: "admin",
            to: user.name,
            read: false , // Assuming there's a 'read' field in Message schema
        });
        // Update lastLogout time
        user.lastLogin = new Date();
        await user.save();

        await Message.updateMany(
            { from: "admin",
                to: user.name,
                delivered: false 
            }, // Filter criteria: unread messages to 'username'
            { $set: { delivered: true } }      // Update: set 'read' to true
        );

        res.render('user', {
            name: user.name,
            feedbackSchema: user.tab,
            storedTabStates: storedTabStates,
            noCustomWallpaper: noCustomWallpaper,
          //  delivered:delivered,
            unreadCount: unreadMessagesCount===0 ? null:unreadMessagesCount
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal Server Error');
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

app.post('/userForm', async (req, res) => {
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

        // Get the current time in IST
        const currentTime = moment().tz('Asia/Kolkata');

        // Define time ranges for each tab
        const timeRanges = {
            breakfast: { start: '09:00', end: '12:00' },
            lunch: { start: '13:00', end: '16:00' },
            supper: { start: '19:00', end: '22:00' },
        };

        // Check if the current time is within the allowed time range for the selected tab
        const { start, end } = timeRanges[tab];
        const startTime = moment.tz(start, 'HH:mm', 'Asia/Kolkata');
        const endTime = moment.tz(end, 'HH:mm', 'Asia/Kolkata');

        if (!currentTime.isBetween(startTime, endTime)) {
            //return res.status(400).send(`Form for ${tab} can only be submitted between ${start} and ${end} IST`);
            return res.render('user',{error:`Form for ${tab} can only be submitted between ${start} and ${end} IST`})
        }

        // Check if the user has already submitted the form for the given tab today
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
            timestamp: currentTime.format() // Store the timestamp in IST
        };
        console.log(newFormEntry);

        // Push the new form entry to the appropriate tab array in the user's profile
        user.tab[tab].push(newFormEntry);
        await user.save();

        sendEmail(user.email, "Submission status", `Hello ${user.name},\n\nYour form for ${tab} is successfully submitted!\n\nThank you for taking time to fill out this form\n\nHave a great day:)\n\nBest regards,\nThe BiteForm Team`);
        console.log("Submission status")
        return res.render('user', { name, userData: JSON.stringify(user), feedbackForms: user.tab[tab], success: 'Form submitted successfully!' });
    } catch (error) {
        console.error('Error submitting form:', error);
        return res.status(500).send('Internal Server Error');
    }
});

const { GridFsStorage } = require('multer-gridfs-storage');
const mongoURI="mongodb+srv://vedhavarshiniy111:NkwsKNXYdpVzHsq9@people.vzfrxax.mongodb.net/LINKEDIN?retryWrites=true&w=majority&appName=People";
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
let gfsAvatars;

mongoose.connection.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'li_wallpapers'
  });
  gfsAvatars = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'li_avatars'
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
        
        bucketName: 'li_wallpapers' // Store wallpapers in a separate collection
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
      const wallpaperPath = `/li_wallpapers/${filename}`; // Path accessible from the frontend
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


// GridFSStorage configuration for avatars
const storageAvatars = new GridFsStorage({
  url: mongoURI,
  file: async (req, file) => {
    const username = req.params.username;
    const fileExtension = path.extname(file.originalname);
    const filename = `${username}_avatar${fileExtension}`;
    console.log(username, filename);

    try {
      // Check if a file with the same filename exists in GridFS (avatars)
      const existingFiles = await gfsAvatars.find({ filename: new RegExp(`^${username}_avatar`) }).toArray();
      for (const existingFile of existingFiles) {
        await gfsAvatars.delete(existingFile._id);
      }
    } catch (error) {
      console.error('Error deleting existing avatar files:', error);
    }

    return {
      filename: filename,
      bucketName: 'li_avatars', // Store avatars in 'avatars' collection
      metadata: {
        username: username, // Store username in metadata
      },
    };
  }
});

const uploadAvatar = multer({ storage: storageAvatars });

// POST endpoint for uploading avatar
app.post('/uploadProfilePhoto/:username', uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const extension = path.extname(req.file.originalname);
    const filename = `${req.params.username}_avatar${extension}`;
    console.log(req.params.username, "post", filename);

    // Handle file upload to GridFS (avatars)
    const writeStream = gfsAvatars.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        username: req.params.username, // Store username in metadata
      },
    });

    writeStream.end(req.file.buffer);

    writeStream.on('finish', async () => {
      try {
        // Update user with new avatar filename
        const user = await User.findOneAndUpdate(
          { name: req.params.username },
          { avatar: filename }, // Store filename or metadata instead of fileId
          { new: true }
        );

        if (!user) {
          return res.status(404).json({ error: 'User not found.' });
        }

        console.log('User details:', user);

        // Find and delete files with the same username and zero length
        const zeroLengthFiles = await gfsAvatars.find({ 
          'metadata.username': req.params.username, 
          length: { $eq: 0 } 
        }).toArray();

        for (const file of zeroLengthFiles) {
          await gfsAvatars.delete(file._id);
          console.log(`Deleted zero-length file: ${file.filename}`);
        }

        res.json({ fileId: writeStream.id });
      } catch (err) {
        console.error('Error updating user with avatar:', err);
        res.status(500).json({ error: err.message });
      }
    });
  } catch (err) {
    console.error('Error uploading avatar:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/deleteProfilePhoto/:username', async (req, res) => {
    try {
      const username = req.params.username;
  
      // Find the avatar file by username
      const avatarFiles = await gfsAvatars.find({ 'metadata.username': username }).toArray();
  
      if (!avatarFiles || avatarFiles.length === 0) {
        return res.status(404).json({ error: 'Avatar not found.' });
      }
  
      // Delete all found avatar files
      for (const file of avatarFiles) {
        await gfsAvatars.delete(file._id);
        console.log(`Deleted avatar file: ${file.filename}`);
      }
  
      // Update user document to remove avatar reference
      const user = await User.findOneAndUpdate(
        { name: username },
        { $unset: { avatar: "" } }, // Remove avatar field from user document
        { new: true }
      );
  
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
  
      console.log('User details updated:', user);
      res.json({ message: 'Avatar deleted successfully.' });
    } catch (err) {
      console.error('Error deleting avatar:', err);
      res.status(500).json({ error: err.message });
    }
  });

// GET endpoint for retrieving avatar by username
app.get('/avatar/:username', async (req, res) => {
    try {
      const username = req.params.username;
  
      // Find all avatar files with matching username and non-zero length
      const avatarFiles = await gfsAvatars.find({ 'metadata.username': username }).toArray();
      //console.log(avatarFiles.length)
      if (avatarFiles && avatarFiles.length > 0) {
        // Assuming there's only one avatar per username, retrieve the first one
        const readStream = gfsAvatars.openDownloadStream(avatarFiles[0]._id);
        readStream.pipe(res);
        console.log("Avatar found!");
        }
        else{
            //console.error('Error retrieving avatar: No avatar found for username', username);
            res.status(500).json({ error: 'No avatar found' });
        }
    }catch (err) {
        console.log("Error")
      console.error('Error retrieving avatar:', err);
      res.status(500).json({ error: err.message });
    }
});
  
// Register Handlebars helper function to format date
hbs.registerHelper('formatDateTS', function (timestamp) {
    if(timestamp)
    {
        return moment(timestamp).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    }
    return null;
});

// Register Handlebars helper function for equality check
hbs.registerHelper('eq', function (a, b) {
    return a === b;
});

app.get('/admin', async (req, res) => {
    const name = req.session.userName;
    
    const user = await User.findOne({name: name,role:"admin"})
    if(!user){
        return res.redirect("/signin")
    }
    if(name !== user.name){
        return res.redirect("/signin")
    }
    user.lastLogin = new Date()
    await user.save()

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
                    return entries.length ? entries : null;
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

        // Example logic to count unread messages
        const unreadMessagesCount = await Message.countDocuments({
            to: "admin",
            read: false  // Assuming there's a 'read' field in Message schema
        });

        res.render('admin', { admin:name, groupedUsers,
            unreadCount: unreadMessagesCount === 0 ? null : unreadMessagesCount
         });
         
    } catch (error) {
        console.error('Error fetching non-admin users:', error);
        res.status(500).send('Internal Server Error');
    }
});

const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server);


const CryptoJS = require('crypto-js');

function encryptMessage(message) {
    const ciphertext = CryptoJS.AES.encrypt(message, 'd916ffebd9a2f453e288cb201037592ccb58c1ba9a40b12b3dbe79e05d232a7d').toString();
    return ciphertext;
}

function decryptMessage(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, 'd916ffebd9a2f453e288cb201037592ccb58c1ba9a40b12b3dbe79e05d232a7d');
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    //console.log("Original text: ",originalText)
    return originalText;
}


// Route to handle sending messages
app.post('/sendMessage', async (req, res) => {
    try {
        let { sender, recipient, content ,timestamp } = req.body;
        let user
        console.log(recipient)
        //console.log("recipient: ",recipient)
        if(recipient === "admin")
        {
            user = await User.findOne({role: "admin"});
        }
        else{
            user = await User.findOne({name: recipient});
        }
        //console.log(user)
        const presentTime = new Date()
        const loginTime = new Date(user.lastLogin)
        const logoutTime = new Date(user.lastLogout)
        // const delivered = ((login < presentTime) && (logout > presentTime)) ? true: false;
        // console.log(`${presentTime} ${user.lastLogin} ${user.lastLogout} ${login} ${logout}`)
        // console.log("Delivered: ",delivered)
        let delivered = false;

            if (loginTime && logoutTime || loginTime) {
                delivered = loginTime > logoutTime && loginTime < presentTime;
            } else {
                console.log("No login and logout timings ")
            }

            console.log(`Present Time: ${presentTime}`);
            console.log(`User's Last Login: ${loginTime}`);
            console.log(`User's Last Logout: ${logoutTime}`);
            console.log(`Message Delivered: ${delivered}`);

        // Save the encrypted message to MongoDB
        const message = new Message({
            from: sender,
            to: recipient,
            content:  content,
            delivered: delivered,
            timestamp:timestamp
        });

        await message.save();
        //console.log(`Sender: ${sender} To: ${recipient} Msg: ${decryptMessage(content)}`)
        // Emit the message to the recipient via Socket.IO
        if(recipient==="admin"){
            const adminUser = await User.findOne({ role: "admin" });
            
            if (adminUser) {
                recipient = adminUser.name; // You can assign adminUser directly if needed
                console.log(`Admin: ${adminUser.name}`);
            } else {
                console.log('Admin user not found');
                return; // Optionally, handle the case when no admin user is found
            }
        }
        const admin = await User.findOne({role:"admin"})
        let unreadCount
        if(recipient === admin.name)
        {
            unreadCount = await Message.countDocuments({to:"admin", read: false})
        }
        else{
            unreadCount = await Message.countDocuments(({to:recipient, read:false}))
        }
        //console.log(recipient,unreadCount)
        io.to(recipient).emit('receiveMessage', {
            sender: sender,
            to:recipient,
            content: content,
            timestamp: message.timestamp,
            unreadCount :unreadCount === 0 ? null : unreadCount
        });
        
        res.status(200).send('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send('Internal server error');
    }
});

// Socket.IO handling for user connection
io.on('connection', async (socket) => {
    console.log('A user connected');

    // Join user's own room (assuming userName is available)
    const { userName } = socket.handshake.query; // Assuming you pass userName as a query parameter
    socket.join(userName);
    console.log(`${userName} connected`);
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`${userName} disconnected`);
    });
});
app.get('/userMessages/:username', async (req, res) => {
    try {
        const sname  = req.session.userName;
         const   uname   = await User.findOne({role:"admin"})
         if(!sname){
             return res.redirect('/signin')
         }
        else if(sname !== uname.name)
        {
            return res.redirect("/signin")
        }
       //console.log("Username: ",`${username}`)
        const username = req.params.username;
        // Check for exact match with potential trailing spaces
        const user = await User.findOne({ name: username });

        if (!user) {
            console.log("User not found:", `"${username}"`);
            return res.status(404).send('User not found');
        }
       // console.log("Msgs name: ",username,"ll")
        const presentTime = new Date()
        const loginTime = new Date(user.lastLogin)
        const logoutTime = new Date(user.lastLogout)
        // const delivered = ((login < presentTime) && (logout > presentTime)) ? true: false;
       // console.log(`${presentTime} ${user.lastLogin} ${user.lastLogout} ${loginTime} ${logoutTime}`)
        //console.log("Delivered: ",delivered)
        
            if (loginTime && logoutTime || loginTime) {
                delivered = loginTime > logoutTime && loginTime < presentTime;
               // console.log("Delivered: ",delivered)
            } else {
                console.log("No login and logout timings ")
            }
        // Find all messages where the sender is the specified user and recipient is 'Admin'
        const messages = await Message.find({ $or: [{ from: username, to: 'admin' }, { from: 'admin', to: username }] });
        console.log(messages,"msgs")
        const unreadMessages = await Message.find({to: "admin", read : "false"})
        console.log(unreadMessages)
        await Message.updateMany(
            { from: username, to: 'admin', read: false }, // Filter criteria: unread messages to 'username'
            { $set: { read: true } }      // Update: set 'read' to true
        );
        const admin =  await User.findOne({role:"admin"})
        //console.log(admin.name,"AN")
        // Emit 'AdminRead' to the user and the admin
        io.to(username).emit('AdminRead', username, unreadMessages, { unreadCount: unreadMessages.length });
        io.to(admin.name).emit('AdminRead', username, unreadMessages, { unreadCount: unreadMessages.length });


        //console.log("Messages read by admin")
      //  console.log("Messages: ",messages)
        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/userChatMessages/:username', async (req, res) => {
     const sname  = req.session.userName
        const   username   = req.params.username;
        if(!sname){
            return res.redirect('/signin')
        }
        else if(sname !== username)
        {
            return res.redirect("/signin")
        }
        

    //console.log("Username: ",username)
    try {
        const user =  User.findOne({name: username })
        {
            if(!user)
            {
                return res.status(404).send('User not found');
            }
        }
        const adminUser = await User.findOne({role: "admin"})
        const presentTime = new Date()
        const loginTime = new Date(adminUser.lastLogin)
        const logoutTime = new Date(adminUser.lastLogout)
        
        if (loginTime && logoutTime || loginTime) {
            delivered = loginTime > logoutTime && loginTime < presentTime;
        } else {
            console.log("No login and logout timings ")
        }
        const unreadMessages = await Message.find({from: "admin", read : "false"})
        //console.log(unreadMessages)
        // Find all messages where the sender is the specified user and recipient is 'Admin'
        const messages = await Message.find({ $or: [{ from: username, to: 'admin' }, { from: 'admin', to: username }] });

        if(username){
           // console.log("Messages updated")
        await Message.updateMany(
            { from: "admin", to: username, read: false }, // Filter criteria: unread messages to 'username'
            { $set: { read: true } }      // Update: set 'read' to true
        );
        io.emit('UserRead',username,unreadMessages)
    }
        //console.log(`Messages read by ${username}`)
    
      //  console.log("Messages: ",messages)
        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Internal server error');
    }
});

// Route to render admin chat page
app.get('/adminChat/:username', async (req, res) => {

    const { username } = req.params;
    //console.log(username);

    try {
        const admin = await User.findOne({ name: username });
       console.log("admin: ", admin);
        const sname = req.session.userName;
        console.log(sname)
        if (!sname)
        {
            return res.redirect('/signin')
        }
        else if(sname !== admin.name)
        {
            return res.redirect('/signin')
        }
        if (!admin) {
            return res.status(404).send('Admin not found');
        }


        // Check if the user has admin role
        if (admin.role !== 'admin') {
            return res.status(403).send('Access denied');
        }

        // Find all regular users (not admins)
        const users = await User.find({ role: { $ne: 'admin' } }, { name: 1 });

        // Prepare array to hold users with their last messages
        const usersWithLastMessages = [];

        // Fetch last messages for each user
        for (const user of users) {
          //  console.log("User:",user.name)
           // console.log("Admin: ",admin.name)
            const lastMessage = await Message.findOne({
                $or: [
                    { from: user.name, to: "admin" },
                    { from: "admin", to: user.name }
                ]
            })
            .sort({ timestamp: -1 });
            //console.log("Last msg: ",lastMessage);

            // Example logic to count unread messages
            const unreadMessagesCount = await Message.countDocuments({
                from: user.name,
                to: "admin",
                read: false  // Assuming there's a 'read' field in Message schema
            });
            
            
          //  console.log(unreadMessagesCount)
            usersWithLastMessages.push({
                name: user.name,
                status: user.status || 'Online',
                unreadMessages: unreadMessagesCount === 0 ? null : unreadMessagesCount, // Update this as per your logic
                read: lastMessage && lastMessage.read !== undefined ? lastMessage.read : null,
                delivered : lastMessage && lastMessage.delivered !== undefined ? lastMessage.delivered : null,
                lastMessage: lastMessage ? {
                    content: decryptMessage(lastMessage.content),
                    timestamp: lastMessage.timestamp,
                    from: lastMessage.from
                } : null
            });
        }
        // Sort usersWithLastMessages based on the most recent message timestamp
        usersWithLastMessages.sort((a, b) => {
            if (a.lastMessage && b.lastMessage) {
                return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
            } else if (a.lastMessage) {
                return -1; // a has a message but b doesn't
            } else if (b.lastMessage) {
                return 1; // b has a message but a doesn't
            } else {
                return 0; // both don't have messages
            }
        });
       // console.log(usersWithLastMessages)
        // Render admin chat page with users and their last messages
        res.render('adminChat', {
            name: username,
            users: usersWithLastMessages 
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

// Register a Handlebars helper to truncate message content
hbs.registerHelper('truncateMessage', function(content, maxLength) {
    if (content.length > maxLength) {
        return content.substring(0, maxLength) + '...';
    } else {
        return content;
    }
});
// Assuming you have an instance of Handlebars named `hbs`
hbs.registerHelper('isAdminMessage', function(sender) {
    //console.log("Sender: ",sender);
    if (sender === 'admin')
    {
        return true
    }
    else{
    return false
    }
});

app.post("/tick", async (req, res) => {
    try {
        const { content, sender, recipient, timestamp } = req.body;
        const presentTime = new Date();
        const adminUser = await User.findOne({ role: "admin" });
        
        console.log(`${encryptMessage(content)} ${sender} ${recipient} ${timestamp}`)
        let actualSender = sender;
        let actualRecipient = recipient;
        
        // Adjust actualSender and actualRecipient if sender or recipient is 'admin'
        if (sender === "admin") {
            actualSender = adminUser.name;
        } 
        if (recipient === "admin") {
            actualRecipient = adminUser.name;
        }
        
        // Fetch recipient's login and logout times
        const recipientInfo = await User.findOne({ name: actualRecipient });
        console.log(actualRecipient, "ko",recipientInfo)
        if (!recipientInfo) {
           console.log("one",actualRecipient)
            return res.status(404).json({ error: "Recipient not found" });
        }
        
        const loginTime = recipientInfo.lastLogin ? new Date(recipientInfo.lastLogin) : null;
        const logoutTime = recipientInfo.lastLogout ? new Date(recipientInfo.lastLogout) : null;
        
        // Check if the recipient has necessary login/logout times
        if (loginTime && !logoutTime) {
           // console.log("false")
            return res.json({ delivered: false, read: false });
        }
        
        // Find the message based on sender, recipient, content, and timestamp
        const msg = await Message.findOne({ from: sender, to: recipient, content: content, timestamp: timestamp });
       // console.log("msg",msg)
        // If message not found, return 404 error
        if (!msg) {
            return res.status(404).json({ error: "Message not found" });
        }
        
        // Update delivered status if necessary
        if (loginTime && logoutTime) {
          //  console.log("iii",msg.delivered,msg.read)
            if(msg.delivered=== false){
                msg.delivered = loginTime > logoutTime && loginTime < presentTime;
            await msg.save();
            }
        }
        console.log(msg.delivered,msg.read)
        // Return the delivery and read status of the message
        return res.json({ delivered: msg.delivered, read: msg.read });
        
    } catch (err) {
        console.log("Error (delivery): ", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

hbs.registerHelper('formatDate', function (dateStr) {
    if (dateStr === null) {
        return "";
    }
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // Convert all dates to UTC
    const dateUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const yesterdayUTC = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()));

    console.log("Date: ", dateUTC.toDateString());
    console.log("Today: ", todayUTC.toDateString());
    console.log("Yesterday: ", yesterdayUTC.toDateString());

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (dateUTC.toDateString() === todayUTC.toDateString()) {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
        });
    } else if (dateUTC.toDateString() === yesterdayUTC.toDateString()) {
        return 'Yesterday';
    } else if (date >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)) {
        // For dates within the last 7 days
        return daysOfWeek[date.getUTCDay()];
    } else {
        // Format date as DD-MM-YYYY
        return date.toLocaleDateString('en-GB');
    }
});


app.get("/userChat/:name", async (req, res) => {
    const username = req.params.name;
    const sname = req.session.userName;
    if(!username || ! sname ||(username !== sname))
    {
        return res.redirect('/signin')
    }
    try {
        // Assuming you have a User model defined with Mongoose
        const user = await User.findOne({ name: username });

        if (!user || user.role === "admin") {
            // Handle case where user is not found in the database
            return res.status(404).send('User not found');
        }
        
        // Example logic to count unread messages
        const unreadMessagesCount = await Message.countDocuments({
            from: "admin",
            to: username,
            read: false  // Assuming there's a 'read' field in Message schema
        });

        // Example: Fetching messages associated with the user
        // Adjust this based on your schema structure
        const messages = user.messages; // Assuming messages is an array of messages

        // Render the userChat view and pass data to it
        res.render("userChat", { name: username, messages, unreadCount: unreadMessagesCount });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/users', async (req, res) => {
    const username = await User.findOne({role: "admin"});
    const sname = req.session.userName;
    if(!username || ! sname ||(username.name !== sname))
    {
        return res.redirect('/signin')
    }
    try {
        const users = await User.find({ role: { $ne: 'admin' } });
        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});



app.get("/profile/:name", async (req, res) => {
    const uname = req.session.userName;
    console.log(req.session.userName,"s",req.params.name)
    if (!uname) {
        
           console.log("hi")
            return res.redirect('/signin');
        
    }
    else if(uname !== req.params.name){
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
         
        res.render('profile', { user });

    } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).send('Internal Server Error');
    }
});

// User route
app.get('/dataUser/:name', async (req, res) => {
    const uname = req.session.userName;
    console.log(req.session.userName,"s",req.params.name)
    if (!uname) {
        
           console.log("hi")
            return res.redirect('/signin');
        
    }
    else if(uname !== req.params.name){
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

app.get('/logout', async (req, res) => {

    const username = req.session.userName;

    try {
        const user = await User.findOne({ name: username });

        if (!user) {
            return res.status(404).send('User not found.');
        }

        // Update lastLogout time
        user.lastLogout = new Date();

        await user.save();

        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).send('Could not log out.');
            }
            res.redirect('/');
        });
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

// in app.js (or similar)
liveReloadServer.server.once("connection", () => {
  setTimeout(() => {
    liveReloadServer.refresh("/");
  }, 100);
});

server.listen(3000, () => {
    console.log("Port 3000 connected");
});
