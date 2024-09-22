let rooms = [];

function createRoom(roomCode, questions) {
    const room = {
        roomCode,
        players: [],
        votes: [],
        commonQuestion: null,
        imposterQuestion: null,
        allQuestions: questions, // Store all questions in the room initially
        differentPlayerIndex: null,
    };
    rooms.push(room);
    return room;
}
function addPlayerToRoom(roomCode, username, socketId) {
    let room = rooms.find(r => r.roomCode === roomCode);
    if (!room) return null;

    const player = {
        username,
        socketId,
        imposter: false, // We'll set this later when assigning questions
        questionVote: null,  // Vote for who they think had the common question
        imposterVote: null,  // Vote for who they think is the imposter
    };

    room.players.push(player);
    return room;
}

function getRoom(roomCode) {
    return rooms.find(r => r.roomCode === roomCode);
}

function resetRoomVotes(roomCode) {
    const room = getRoom(roomCode);
    if (room) {
        room.votes = [];
        room.commonQuestion = null;
        room.differentPlayerIndex = null;
    }
}
function resetRoomVotes(roomCode) {
    const room = getRoom(roomCode);
    if (room) {
        room.votes = [];
        room.commonQuestion = null;
        room.imposterQuestion = null;
        room.differentPlayerIndex = null;
        room.players.forEach(player => {
            player.questionVote = null;
            player.imposterVote = null;
            player.imposter = false
        });
    }
}

function assignQuestionsToRoom(room) {
    if (room.allQuestions.length < 2) {
        return false; // Let the caller handle fetching more questions
    }
    const commonQuestionIndex = Math.floor(Math.random() * room.allQuestions.length);
    const commonQuestion = room.allQuestions.splice(commonQuestionIndex, 1)[0]; 
    const imposterQuestionIndex = Math.floor(Math.random() * room.allQuestions.length);
    const imposterQuestion = room.allQuestions.splice(imposterQuestionIndex, 1)[0]; 

    const differentPlayerIndex = Math.floor(Math.random() * room.players.length);

    room.commonQuestion = commonQuestion.text;
    room.imposterQuestion = imposterQuestion.text;
    room.differentPlayerIndex = differentPlayerIndex;

    // Mark the imposter in the players list
    room.players.forEach((player, index) => {
        player.imposter = index === differentPlayerIndex;
    });

    return true;
}

module.exports = { createRoom, addPlayerToRoom, getRoom, resetRoomVotes, assignQuestionsToRoom };
