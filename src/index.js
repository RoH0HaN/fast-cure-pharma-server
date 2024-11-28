import dotenv from "dotenv";
import { app } from "./app.js";
import connectDB from "../db/mongo.db.js";

dotenv.config({
  path: "./.env",
});

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(`Server is listening | PORT: ${process.env.PORT || 3000}`);
    });
  })
  .catch((error) => {
    console.error("MONGODB connection error | Error: ", error);
  });

app.all("/", (_, res) => {
  console.log("Just got a request on this server.");
  res.send(`
        <center>
          <b style="font-size: 42px;">
            FastCure Pharma's Backend API's are running!<br>
            Developer: Apparium Dev Team
          </b>
        </center>
      `);
});
