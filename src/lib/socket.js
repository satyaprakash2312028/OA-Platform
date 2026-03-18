const {Server} = require('socket.io')
const http = require("http")
const express = require("express")
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
   cors:{
    origin: ["http://localhost:5173", "http://localhost:5174"],
   } 
});
function getReceiverSocketId(userId){
   return userSocketMap[userId];
}
const userSocketMap = {
};
io.on("connection", (socket)=>{
   console.log("A user connected", socket.id);
   const userId = socket.handshake.query.userId;
   if(userId){
      userSocketMap[userId] = socket.id;
   }
   socket.on("disconnect", ()=>{
      console.log("A user disconnected", socket.id);
      delete userSocketMap[userId];
   });
});
module.exports = {io, app, server, getReceiverSocketId};