const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    text: String,
});

module.exports = mongoose.model('Questions', QuestionSchema);
