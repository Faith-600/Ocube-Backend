import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import User from './Model/User.js';
import session from 'express-session'




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


      app.get('/',(req,res)=>{
        if(req.session.name){
      return res.json({valid:true,name:req.session.name})
        }else{
          return res.json({valid:false})
        }
      })  
      
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
      await newUser.save();
      
      res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
      res.status(500).json({ message: "Error registering user", error: err });
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

