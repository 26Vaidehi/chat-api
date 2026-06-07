const express = require('express'); //imports express

const app = express();  //creates server instance
const PORT = 3000;

app.use(express.json());    //tells server to understand json requests

app.get('/',(req,res)=>{    //when someone visits '/', send back the response
    res.json({message:'Chat API is running!'});
});

const users = [];   //temporary in-memory storage (like a python list)

app.post('/register',(req,res)=>{   //handles POST requests to '/register'
    //destructuring - same as 'username=req.body['username']' in python
    const {username, password} = req.body;  //the JSON data the user sends in the request

    if(!username || !password){
        return res.status(400).json({error:'Username and password required'});
    }

    const userExists = users.find(u=>u.username === username);  //checks if username already exists
    if(userExists){
        return res.status(400).json({error:'Username already taken'});  //'res.status(400)' -> sends back HTTP error code 400 = Bad Request
    }

    users.push({username, password});
    res.status(201).json({message:`User ${username} registered successfully`}); //'res.status(201)' -> Created successfully
});

app.get('/users',(req,res)=>{
    res.json({users:users.map(u=>u.username)});
});

app.listen(PORT,()=>{   //start the port on 3000
    console.log(`Server running on port ${PORT}`);
});
