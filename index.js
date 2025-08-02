import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import User from './Model/User.js';
import session from 'express-session'
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import bcryptjs from 'bcryptjs';
import MongoStore from 'connect-mongo';
import { courses } from './courses.js'; 
import multer from 'multer';
import {v2 as cloudinary} from 'cloudinary'




dotenv.config();
const app = express();

app.set('trust proxy', 1); 

app.use(cors({
    origin: true, 
    credentials: true 
}));

app.use(express.urlencoded({ extended: true }));

const mongoUrl = process.env.MONGO_URL;
const port =process.env.PORT || 3001;
const jwtSecret = process.env.JWT_SECRET;
const emailUser = process.env.EMAIL_USER;
const emailPass =  process.env.EMAIL_PASS

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const upload = multer({ storage: multer.memoryStorage() });

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, 
    store: MongoStore.create({
      mongoUrl,
      ttl: 14 * 24 * 60 * 60, 
    }),
    cookie: {
      secure: true,
      httpOnly:true,
      sameSite:"none",
      maxAge: 1000 * 60 * 60 * 24 * 7
      
    },
  }),
);



const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: emailUser, pass: emailPass },
});

// Verify the SMTP connection when the server starts
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});


mongoose.connect(mongoUrl,{
    serverSelectionTimeoutMS: 5000,
  }).then(() => {
      console.log('Connected to MongoDB')
      app.listen(port, ()=>{
        console.log("server is running on port " + port)
      });
    }).catch((err) => {
      console.error('MongoDB connection error:', err);
    });


    app.get('/', (req, res) => {
        res.json({ message: 'Hello from the serverless function!' });
      });


      // Add this temporary route for debugging purposes.
app.post('/api/debug-body', (req, res) => {
  // This will log everything to your Vercel logs.
  console.log('--- DEBUGGING /api/debug-body ---');
  console.log('Request Headers:', req.headers);
  console.log('Request Body:', req.body);
  console.log('---------------------------------');

  // This sends a response back to Postman.
  if (req.body && Object.keys(req.body).length > 0) {
    res.status(200).json({
      message: "SUCCESS: Your server received and parsed the JSON body.",
      bodyReceived: req.body
    });
  } else {
    res.status(400).json({
      message: "FAILURE: req.body was undefined or empty. The express.json() middleware did not run correctly.",
      headersTheServerSaw: req.headers // This will show us the headers that actually arrived.
    });
  }
});

// COURESES API
      app.get('/api/courses', (req, res) => {
        res.json(courses);
      });
      
      app.get('/api/courses/:id', (req, res) => {
        const course = courses.find(c => c.id == req.params.id);
        if (course) {
          res.json(course);
        } else {
          res.status(404).json({ message: 'Course not found' });
        }
      });
   
      
      app.post('/logout', (req, res) => {
        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({ message: "Logout failed" });
          }
          res.clearCookie('connect.sid');
          return res.status(200).json({ message: "Logout successful" });
        });
      });


      //  SIGN UP  
app.post('/signup', async (req, res) => {
  console.log(req.body); 
    const { name, email, password,phonenumber } = req.body;

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;


    if (!passwordPattern.test(password)) {
         return res.status(400).json({
        error: 'Password must be at least 8 characters long, include at least one uppercase letter, one lowercase letter, one number, and one special character.',
      });
    }
  
    if (!name || !email || !password|| !phonenumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }
  
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }

   
  
      const newUser = new User({ name, email, password ,phonenumber});

      // Generate Email Token 

      const token = jwt.sign({ userId: newUser._id }, jwtSecret, { expiresIn: '1h' });
      newUser.verificationToken = token;
      await newUser.save();


      const verificationUrl = `https://ocube-backend.vercel.app/verify-email/${token}`;
      const transporter = nodemailer.createTransport({
        service: 'gmail', 
        auth: {
          user: emailUser,
          pass: emailPass,
        }
      });
  
      const mailOptions = {
        from: emailUser,
        to: email,
        subject: 'Email Verification',
        text: `Please verify your email by clicking on the following link: ${verificationUrl}`,
      };
  
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully to:', email);
  
      res.status(201).json({ message: "User registered successfully. Please check your email to verify your account." });
    } catch (err) {
      console.error('Error during registration or email sending:', err);
      res.status(500).json({ message: "Error registering user or sending email", error: err.message });
    }
  });

// Email verification route
app.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(400).json({ message: "Invalid token or user not found" });
    }

    if (user.isVerified) {
 return res.status(400).send('<h1>Already Verified</h1><p>This email address has already been verified.</p>');
    }

    // Set the user as verified
    user.isVerified = true;
    user.verificationToken = '';  
    await user.save();
  
    // res.send('<h1>Email verified successfully!</h1>');
//     const frontendLoginUrl = 'http://localhost:5173/login?verified=true'; // Change this to your actual frontend URL

// // Redirect the user's browser to that page
// res.redirect(frontendLoginUrl);
 res.status(200).send('<h1>Success!</h1><p>Your email has been verified. You can now close this tab and log in to the application.</p>');
  } catch (err) {
 res.status(400).send('<h1>Error</h1><p>This verification link is invalid or has expired.</p>');  }
});



  // LOGINS 
app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(401).json({ login: false, message: "Invalid credentials" });
    }
    if (!user.isVerified) {
      return res.status(403).json({ login: false, message: "Please verify your email before logging in." });
    }

    const isValid = await bcryptjs.compare(req.body.password, user.password);
    if (!isValid) {
      return res.status(401).json({ login: false, message: "Invalid credentials" });
    }

    req.session.userId = user._id;

    const userProfile = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phonenumber: user.phonenumber
    };

    res.status(200).json({ login: true, user: userProfile });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next(); 
  }
  res.status(401).json({ message: 'Unauthorized: You must be logged in.' });
};


app.get('/api/profile/me', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;

    const userProfile = await User.findById(userId).select('-password -verificationToken');

    if (!userProfile) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    res.status(200).json(userProfile);

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/profile/me', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const { name, phonenumber } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (phonenumber) updates.phonenumber = phonenumber;

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true })
          .select('-password -verificationToken');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.put('/api/profile/picture', isAuthenticated, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { 
            folder: 'profile_pictures', 
            resource_type: 'image'
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        uploadStream.end(req.file.buffer);
      });
    };

    const result = await uploadToCloudinary();
    
    const profilePictureUrl = result.secure_url;
    const userId = req.session.userId;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePictureUrl: profilePictureUrl },
      { new: true }
    ).select('-password -verificationToken');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json({ message: 'Profile picture updated successfully', user: updatedUser });

  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ message: 'Server error while updating picture.' });
  }
});

  export default app;

