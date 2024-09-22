const express = require('express');
const http = require('http');
const cors = require('cors'); 
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Question = require('./models/Question');
const { createRoom, addPlayerToRoom, getRoom, resetRoomVotes, assignQuestionsToRoom } = require('./rooms');
const dotenv =  require('dotenv');
const bodyParser = require('body-parser');
dotenv.config()
const app = express();
app.use(bodyParser.json());
// const questionRoutes = require('./routes/questions.js');
// app.use('/api/questions', questionRoutes);
// const router = express.Router();
const server = http.createServer(app);
const io = new Server(server,{
    cors:{
        origin: process.env.FRONT_URL, // Frontend URL
        methods: ["GET", "POST"],
        credentials: true
    }
});
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.error("Error connecting to MongoDB:", err);
});

app.post('/api/questions/add', async (req, res) => {
    try {
        const { text } = req.body;
        const newQuestion = new Question({ text });
        await newQuestion.save();
        
        res.status(200).json({ success: true, message: 'Question added successfully' });
    } catch (error) {
        console.error('Error adding question:', error);
        res.status(500).json({ success: false, error: 'Failed to add question' });
    }
});

app.get('/api/questions', async (req, res) => {
    try {
        const allQuestions = await Question.find({});
        res.status(200).json(allQuestions);
    } catch (error) {
    }
});
// Socket.io logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Create or Join a room
    socket.on('joinRoom', async ({ roomCode, username }, callback) => {
        let room = getRoom(roomCode);

        if (!room) {
            // Fetch all questions from MongoDB and create a new room
            const allQuestions = await Question.find({});
            if (allQuestions.length === 0) {
                callback({ success: false, message: 'No questions available' });
                return;
            }

            room = createRoom(roomCode, allQuestions);
        }

        const updatedRoom = addPlayerToRoom(roomCode, username, socket.id);
        if (updatedRoom) {
            socket.join(roomCode);
            callback({ success: true, room: updatedRoom });
            io.to(roomCode).emit('playerJoined', updatedRoom.players);
        } else {
            callback({ success: false, message: 'Room not found' });
        }
    });

    // Start Game Round
    socket.on('startGame', async ({ roomCode }, callback) => {
        const room = getRoom(roomCode);
        if (!room || room.players.length <= 1) {
            callback({ success: false, message: 'Not enough players' });
            return;
        }

        // Assign new questions for the round
        let questionsAssigned = assignQuestionsToRoom(room);

        if (!questionsAssigned) {
            // Not enough questions, refetch from the DB
            const newQuestions = await Question.find({});
            if (newQuestions.length === 0) {
                callback({ success: false, message: 'Not enough questions available' });
                return;
            }

            room.allQuestions = newQuestions; // Refill the questions
            assignQuestionsToRoom(room); // Assign questions after refilling
        }

        // Notify each player of their question
        room.players.forEach((player, index) => {
            const question = player.imposter ? room.imposterQuestion : room.commonQuestion;
            io.to(player.socketId).emit('question', {questionText: question, room: room});
        });

        callback({ success: true, room:room });
    });

    // Submit Vote
    socket.on('submitQuestionVote', ({ roomCode, vote }) => {
        const room = getRoom(roomCode);
        if (room) {
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                player.questionVote = vote;

                const allVoted = room.players.every(p => p.questionVote);
                if (allVoted) {
                    handleVotingResults(roomCode);
                }
            }
        }
    });
    socket.on('submitImposterVote', ({ roomCode, vote }) => {
        const room = getRoom(roomCode);
        if (room) {
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                player.imposterVote = vote;

                const allVoted = room.players.every(p =>p.imposterVote);
                if (allVoted) {
                    // After 2 minutes, determine the majority vote for imposter
                    let voteCounts = {};
                    room.players.forEach(p => {
                        voteCounts[p.imposterVote] = (voteCounts[p.imposterVote] || 0) + 1;
                    });

                    // Determine the player with the most votes
                    const majorityVote = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
                    const trueImposter = room.players[room.differentPlayerIndex].username;

                    const isCorrect = majorityVote === trueImposter;

                    io.to(roomCode).emit('finalResult', {
                        trueImposter,
                        majorityVote,
                        isCorrect
                    });

                    // Reset room for the next game
                    resetRoomVotes(roomCode);
                }
            }
        }
    });

    // Handle Voting Results
    const handleVotingResults = (roomCode) => {
        const room = getRoom(roomCode);
        if (!room) return;

        // Countdown before revealing the common question
        setTimeout(() => {
            io.to(roomCode).emit('revealCommonQuestion', room.commonQuestion);

            // After 3 seconds, reveal who voted for whom
            setTimeout(() => {
                const votes = room.players.map(p => ({
                    username: p.username,
                    questionVote: p.questionVote,
                }));
                io.to(roomCode).emit('revealVotes', votes);
            }, 3000); // 3 seconds after showing the common question
        }, 1000);
    };

    // Handle Disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
