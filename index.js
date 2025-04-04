import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import User from './Model/User.js';
import session from 'express-session'
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer'




dotenv.config();
const app = express();

app.use(express.json());
app.use(cors())


app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }, 
    })
  );

const mongoUrl = process.env.MONGO_URL;
const port =process.env.PORT || 3001;
const jwtSecret = process.env.JWT_SECRET;
const emailUser = process.env.EMAIL_USER;
const emailPass =  process.env.EMAIL_PASS

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


      // app.get('/',(req,res)=>{
      //   if(req.session.name){
      // return res.json({valid:true,name:req.session.name})
      //   }else{
      //     return res.json({valid:false})
      //   }
      // })  
      
      app.post('/logout', (req, res) => {
        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({ message: "Logout failed" });
          }
          res.clearCookie('connect.sid');
          return res.status(200).json({ message: "Logout successful" });
        });
      });


      //  POSTING USERS 
app.post('/users', async (req, res) => {
    const { name, email, password,phonenumber } = req.body;
  
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


      const verificationUrl = `http://localhost:3001/verify-email/${token}`;
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
      return res.status(400).json({ message: "Email already verified" });
    }

    // Set the user as verified
    user.isVerified = true;
    user.verificationToken = '';  
    await user.save();
  
    // res.send('<h1>Email verified successfully!</h1>');
    res.status(200).json({ message: "Email verified successfully!" });
  } catch (err) {
    res.status(400).json({ message: "Invalid or expired token" });
  }
});



  // LOGINS 
app.post('/login', async (req, res) => {
    try {
      const user = await User.findOne({ email: req.body.email });
      if (!user) return res.json({ Login: false });
  
      const isValid = await bcrypt.compare(req.body.password, user.password);
      if (!isValid) return res.json({ Login: false });
  
      req.session.name = user.name;
      res.json({ Login: true, user });
    } catch (err) {
      res.status(500).json({ message: 'Error inside server' });
    }
  });


  export default app;

