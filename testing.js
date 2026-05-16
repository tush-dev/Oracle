 // Install the axios and fs-extra package by executing the command "npm install axios fs-extra"

 import axios from "axios";
 import fs from "fs-extra";
 
 const baseUrl = "https://api.assemblyai.com";
 
 const headers = {
   authorization: process.env.ASSEMBLY_API_KEY,
 };
 
//  You can upload a local file using the following code
 const path = "./speech.mp3";
 const audioData = await fs.readFile(path);
 const uploadResponse = await axios.post(`${baseUrl}/v2/upload`, audioData, {
   headers,
 });
 const audioUrl = uploadResponse.data.upload_url;
 
//  const audioUrl = "https://assembly.ai/wildfires.mp3";
 
 const data = {
   audio_url: audioUrl,
   "language_detection": true,
   // Uses universal-3-pro for en, es, de, fr, it, pt. Else uses universal-2 for support across all other languages
   "speech_models": ["universal-3-pro", "universal-2"]
 };
 
 const url = `${baseUrl}/v2/transcript`;
 const response = await axios.post(url, data, { headers: headers });
 
 const transcriptId = response.data.id;
 const pollingEndpoint = `${baseUrl}/v2/transcript/${transcriptId}`;
 
 while (true) {
   const pollingResponse = await axios.get(pollingEndpoint, {
     headers: headers,
   });
   const transcriptionResult = pollingResponse.data;
 
   if (transcriptionResult.status === "completed") {
     console.log(transcriptionResult.text);
     break;
   } else if (transcriptionResult.status === "error") {
     throw new Error(`Transcription failed: ${transcriptionResult.error}`);
   } else {
     await new Promise((resolve) => setTimeout(resolve, 3000));
   }
 }
 