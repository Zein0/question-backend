router.post('/add', async (req, res) => {
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