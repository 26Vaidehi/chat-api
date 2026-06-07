const express = require('express'); //imports express
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();  //creates server instance
const PORT = 3000;
const JWT_SECRET = 'your_secret_key_123';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

app.use(express.json());    //tells server to understand json requests

const users = [];   //temporary in-memory storage (like a python list)

app.get('/',(req,res)=>{    //when someone visits '/', send back the response
    res.json({message:'Chat API is running!'});
});

//async/await -> handles operations that take time
app.post('/register',async(req,res)=>{   //handles POST requests to '/register'
    //destructuring - same as 'username=req.body['username']' in python
    const {username, password} = req.body;  //the JSON data the user sends in the request

    if(!username || !password){
        return res.status(400).json({error:'Username and password required'});
    }

    const userExists = users.find(u=>u.username === username);  //checks if username already exists
    if(userExists){
        return res.status(400).json({error:'Username already taken'});  //'res.status(400)' -> sends back HTTP error code 400 = Bad Request
    }

    const hashedPassword = await bcrypt .hash(password,10); //scrambles the password - thw '10' is how many times it scrambles
    users.push({username, password:hashedPassword});

    res.status(201).json({message:`User ${username} registered successfully`}); //'res.status(201)' -> Created successfully
});

app.post('/login',async(req,res) => {
    const {username, password}=req.body;

    if(!username || !password){
        return res.status(400).json({error: 'Username and password required'});
    }

    const user = users.find(u => u.username === username);
    if(!user){
        return res.status(400).json({error : 'User not found'});
    }

    const isMatch = await bcrypt.compare(password, user.password);  //checks if the entered password matches the scrambled one
    if(!isMatch){
        return res.status(400).json({error : 'Invalid password'});
    }

    //jwt.sign(...) -> creates a token - like a temporary ID card valid for 24 hours
    //JWT_SECRET -> the secret key used to sign token - only your server knows this
    const token = jwt.sign({username}, JWT_SECRET, {expiresIn: '24h'});
    res.json({message : 'Login successful',token});
});

app.get('/profile', authenticateToken, (req,res) => {   //authenticateToken ->  this is the middleware being applied to this route
    res.json({message : `Welcome ${req.user.username}!`, user:req.user});
});

app.listen(PORT,()=>{   //start the port on 3000
    console.log(`Server running on port ${PORT}`);
});
