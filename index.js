const express = require('express')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
require('dotenv').config()
const supabase = require('./config/supabaseClient')
const { createClient } = require("@deepgram/sdk");
const app = express()
app.use(cors())
app.use(express.json())
const path = require('path')

app.use('/uploads', express.static(path.join(__dirname,'uploads')))
const PORT = process.env.PORT || 4000 
app.listen(PORT, () => {
    console.log(`server is running at port: ${PORT}`)
})


//multer config
const storage = multer.diskStorage({
    destination:(req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb)=> {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    } 
})
const upload = multer({storage:storage})


//deepgram api call seech to text
let transcript = ''
const transcribeFile = async (filePath) => {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    fs.readFileSync(filePath),
    {
      model: "nova-3",
      smart_format: true,
    }
  );
  if (error) throw error;
  // if (!error) console.dir(result, { depth: null });
  const finalTranscription = result.results.channels[0].alternatives[0].transcript;
  transcript = finalTranscription
  return finalTranscription
};


// insertion in supabase
app.post('/upload', upload.single('audio'), async (request, response) => {
    const filePath = path.join(__dirname,request.file.path)
    const transcibe = await transcribeFile(filePath)
    const {data, error} = await supabase
    .from("audiotext")
    .insert([{
        id:request.body.id,
        audiofile:request.file.path, 
        transcription:transcibe
    }])
    if (error){
        console.log(`supabase error : ${error.message}`)
    }
    response.send("file uploaded successfully")
});


//get transcript
app.get("/transcript", (request, response) => {
    response.send(transcript)
})

//history 
app.get("/history/" , async (request, response) => {
    const {data, error} = await supabase
    .from('audiotext')
    .select()
    if (error){
        console.log(`supabase error: ${error.message}`)
    }
    const transcriptionsList = data
    response.send(transcriptionsList)
}) 


//delete 
app.delete("/delete/:id" , async (request, response) => {
    const {id} = request.params
    const {data, error} = await supabase
    .from('audiotext')
    .delete()
    .eq('id',id)
    console.log(`error:${error}`)
    response.send("deleted successfully")
})


app.use('/', (req, res) =>{
    res.send("<h1> backend is running")
})