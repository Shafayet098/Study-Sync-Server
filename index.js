const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 3000;

//middleWare
app.use(cors({
    origin: ['http://localhost:5173',"https://study-sync-project-2d35a.web.app"],
    credentials: true
}));
app.use(express.json())
app.use(cookieParser())

//verify Token
const verifyToken=(req,res,next)=>{
    const token = req?.cookies?.token;
    console.log('cookie in the middleware ',token)
    if(!token){
        return res.status(401).send({message:'unauthorized Access'})
    }
    //verify token
    jwt.verify(token, process.env.JWT_Access_Secret,(err,decoded)=>{
        if(err){
            return res.status(401).send({message:'unauthorized Access'})
        }
        req.decoded = decoded
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4qasang.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const assignmentCollection = client.db('StudySync').collection('assignment')
        const usersCollection = client.db('StudySync').collection('users')

        //jwt token related API
        app.post('/jwt', (req, res) => {
            const userData = req.body
            const token = jwt.sign(userData, process.env.JWT_Access_Secret, { expiresIn: '1d' })

            //set token in the cookies
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
            })
            res.send({ success: true })
        })
        //Clear token on logout
        app.get('/logout', (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                maxAge: 0
            })
            res.send({ success: true })
        })

        app.get('/assign', async (req, res) => {
            const cursor = assignmentCollection.find();
            const result = await cursor.toArray()
            res.send(result);
        })
        app.get('/cards', async (req, res) => {
            const page = parseInt(req.query.page) - 1;
            const size = parseInt(req.query.size);
            const sort = req.query.sort;
            const search = req.query.search
            const filter = req.query.filter
            let query = { title: { $regex: search, $options: 'i' } }
            let options = {};
            if (filter) {
                query.category = { category: filter }
            }
            if (sort) {
                options = { sort: { deadline: sort === 'asc' ? '1' : '-1' } }
            }
            const result = await assignmentCollection.find(query, options).skip(page * size).limit(size).toArray()
            res.send(result)
        })
        app.get('/cards-count', async (req, res) => {
            const search = req.query.search;
            const filter = req.query.filter
            let query = {}
            if (search) {
                query = { title: { $regex: search, $options: 'i' } }
            }
            if (filter) {
                query.category = { category: filter }
            }
            const result = await assignmentCollection.countDocuments(query);
            res.send(result)
        })

        app.get('/assignment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await assignmentCollection.findOne(query);
            console.log(result)
            res.send(result);
        })

        app.post('/assign', async (req, res) => {
            const newAssign = req.body;
            console.log(newAssign)
            const result = await assignmentCollection.insertOne(newAssign)
            res.send(result)
        })

        //Users API
        app.post('/user', async (req, res) => {
            const data = req.body;
            // console.log(data)
            const result = await usersCollection.insertOne(data)
            res.send(result)
        })

        app.get('/userData/:email',verifyToken, async(req,res)=>{
            const email = req.params.email;
            if(email !== req.decoded.email){
                 return res.status(403).send({message:'Forbidden Access'})
            }
            const query = {userEmail: email}
            result = await usersCollection.find(query).toArray()
            res.send(result)

        })
        app.get('/user', async (req, res) => {
            const id = req.query.id;
            const status = req.query.status
            
            let query = {};
            // console.log(email,id, status)
            if (id) {
                query._id = new ObjectId(id)
            }
            
            if (status) {
                query.AssignmentStatus = status
            }
            const result = await usersCollection.find(query).toArray()
            res.send(result)
        })


        app.put('/user/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateData = req.body;
            const updatedDoc = {
                $set: updateData
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })

        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('User server is running')
})
app.listen(port, () => {
    console.log('Server is running on port ', port)
})